// 图片读取：把 R2 里的对象回给浏览器
// 地址形如 /api/images/<uuid>.jpg，由 src/lib/storage.ts 的 saveImage 生成并写进库
import { NextRequest, NextResponse } from 'next/server'
import { getImage, mimeFromKey } from '@/lib/storage'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params
  const path = (key ?? []).join('/')

  // 键只可能是「uuid.ext」这种单段名字；挡掉穿越与多段路径，避免拿它当通用文件读取口
  if (!path || path.includes('..') || path.includes('/')) {
    return NextResponse.json({ error: '无效的图片路径' }, { status: 400 })
  }

  const object = await getImage(path)
  if (!object) {
    return NextResponse.json({ error: '图片不存在' }, { status: 404 })
  }

  return new NextResponse(object.body as unknown as ReadableStream, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? mimeFromKey(path),
      // 键是随机 UUID、内容永不变，可以放心让浏览器和边缘长期缓存
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
