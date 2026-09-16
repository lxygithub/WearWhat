// 图片对象存储（Cloudflare R2）
//
// 【为什么不再往库里塞 base64】
// 原先衣服照片以 base64 data URL 整条存进 ClothingItem.imageData。D1 单行上限约
// 2MB、免费版整库 500MB，手机拍的原图一张就 3-5MB，生产上第一张照片就会失败。
// 现在改为上传 R2，库里只留一个相对 URL。
//
// 【为什么前端不用改】
// 组件里都是 <img src={item.imageData}>，而 data URL 和普通 URL 都能直接当 src 用，
// 所以只要服务端把「进来的 base64」换成「出去的 URL」，组件层零改动。
//
// 【为什么走本 Worker 的 /api/images/<key> 而不是 R2 的 r2.dev 公共域名】
// r2.dev 需要单独开启、有速率限制，且将来换域名时库里的 URL 会全部失效。
// 走自家路由则完全不依赖额外域名，还能在响应上挂 Cache-Control 交给边缘缓存。
import { getCloudflareContext } from '@opennextjs/cloudflare/cloudflare-context'

interface R2ObjectLike {
  body: ReadableStream<Uint8Array>
  httpMetadata?: { contentType?: string }
}

interface R2BucketLike {
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<unknown>
  get(key: string): Promise<R2ObjectLike | null>
  delete(key: string): Promise<unknown>
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

/** 库里存的就是这个前缀开头的相对地址，前端同源直接取得到 */
const IMAGE_URL_PREFIX = '/api/images/'

/** 取 R2 绑定；本地 next dev（无 Cloudflare 上下文）返回 null，走降级 */
function bucket(): R2BucketLike | null {
  try {
    const { env } = getCloudflareContext()
    return (env as unknown as { BUCKET?: R2BucketLike }).BUCKET ?? null
  } catch {
    return null
  }
}

/** 单张图片上限。前端压缩后正常只有 100-200KB，这里只是挡住绕过前端的大请求 */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024

/** 图片超出上限。调用方据此回 413 而不是 500 —— 这是请求的问题，不是服务端故障 */
export class ImageTooLargeError extends Error {
  constructor() {
    super(`图片超过 ${MAX_IMAGE_BYTES / 1024 / 1024}MB 上限，请压缩后再传`)
    this.name = 'ImageTooLargeError'
  }
}

function base64ToBytes(base64: string): Uint8Array {
  // nodejs_compat 下 Buffer 可用，比 atob + 逐字节循环快得多、也省内存
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

export function isManagedImage(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(IMAGE_URL_PREFIX)
}

/**
 * 把 data URL 存进 R2，返回可直接放进 <img src> 的地址。
 *
 * 两种情况原样返回入参（即继续用 base64），保证降级可用：
 *   - 没有 R2 绑定（本地 next dev）
 *   - 不是能识别的图片 data URL
 */
export async function saveImage(value: string | null | undefined): Promise<string | null> {
  if (typeof value !== 'string') return value ?? null
  if (!value.startsWith('data:')) return value // 已经是 URL，不重复处理

  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(value)
  if (!match) return value

  const mimeType = match[1].toLowerCase()
  const ext = MIME_EXT[mimeType]
  const r2 = bucket()
  if (!ext || !r2) return value

  const bytes = base64ToBytes(match[2])
  if (bytes.length === 0) return value
  if (bytes.length > MAX_IMAGE_BYTES) {
    // 前端有同样的限制，这里是防止绕过前端直接打接口
    throw new ImageTooLargeError()
  }

  // 随机 UUID 做键：无冲突、不可枚举、内容永不变（因此可以长缓存）
  const key = `${crypto.randomUUID()}.${ext}`
  await r2.put(key, bytes, { httpMetadata: { contentType: mimeType } })
  return IMAGE_URL_PREFIX + key
}

/** 删除库里某个图片地址对应的 R2 对象；不是本系统管的地址则忽略 */
export async function deleteImage(value: string | null | undefined): Promise<void> {
  if (!isManagedImage(value)) return
  const r2 = bucket()
  if (!r2) return

  const key = (value as string).slice(IMAGE_URL_PREFIX.length)
  if (!key || key.includes('/') || key.includes('..')) return

  try {
    await r2.delete(key)
  } catch (e) {
    // 删图失败不该让业务请求失败：对象最多变成无人引用的孤儿，不影响正确性
    console.error('[storage] 删除图片失败', key, e)
  }
}

export async function getImage(key: string): Promise<R2ObjectLike | null> {
  const r2 = bucket()
  if (!r2) return null
  return r2.get(key)
}

export function mimeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MIME[ext] ?? 'application/octet-stream'
}
