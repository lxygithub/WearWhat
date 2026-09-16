// WearWhat 数据库客户端 —— 本地 SQLite / 线上 Cloudflare D1 双后端
//
// 【后端选择】
//   - 本地开发（next dev，Node/Bun）：Prisma + SQLite 文件，走 prisma/schema.prisma
//   - 线上（Cloudflare Workers）：Prisma + D1，走 prisma/schema.workers.prisma 生成的
//     runtime=workerd 客户端（见 scripts/gen-workers-schema.mjs）
//
// 【为什么两个后端都用动态 import】
// Workers 那份产物内部是 `import('./query_engine_bg.wasm?module')`（wrangler 的 wasm
// 约定），Node 下无法解析；反之 Node 版 client 依赖原生引擎，workerd 下也没有。
// 动态 import 让本地 dev 永远不会去解析 Workers 那份产物，两边互不干扰。
//
// 【为什么是 Proxy】
// db 的用法是 `await db.clothingItem.findMany(...)`——属性访问必须同步返回，
// 而动态 import 是异步的。这里用两层 Proxy：属性访问返回「等 Promise 解析后再取值」
// 的包装函数，真正调用时才 await 客户端。全项目无 $transaction 数组式用法，
// 因此纯 await 语义完全兼容。
import type { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
// 子路径是自包含模块（读取 worker 入口预埋在 globalThis 的上下文），
// 本地 Node 侧仅被解析、从不执行
import { getCloudflareContext } from '@opennextjs/cloudflare/cloudflare-context'

const isWorkers =
  typeof navigator !== 'undefined' &&
  (navigator as { userAgent?: string }).userAgent === 'Cloudflare-Workers'

let clientPromise: Promise<PrismaClient> | null = null

async function createWorkerClient(): Promise<PrismaClient> {
  const { PrismaClient: WorkerPrisma } = await import('../generated/prisma-worker/client')

  const { env } = getCloudflareContext()
  const d1 = (env as unknown as { DB?: unknown }).DB
  if (!d1) {
    throw new Error(
      '未找到 D1 绑定 env.DB —— 请检查 wrangler.jsonc 的 d1_databases 配置与 database_id'
    )
  }
  // D1 binding 是 RPC stub，不绑定具体请求，可在同一个 isolate 内复用
  return new WorkerPrisma({ adapter: new PrismaD1(d1 as never) }) as unknown as PrismaClient
}

async function createNodeClient(): Promise<PrismaClient> {
  const { PrismaClient: NodePrisma } = await import('@prisma/client')
  return new NodePrisma({ log: ['query'] }) as PrismaClient
}

function resolveClient(): Promise<PrismaClient> {
  if (!clientPromise) {
    clientPromise = (isWorkers ? createWorkerClient() : createNodeClient()).catch((err) => {
      // 失败后清空，让下一次访问可以重试（否则一个瞬时错误会永久毒化整个 isolate）
      clientPromise = null
      throw err
    })
  }
  return clientPromise
}

/** 延迟解析节点：属性访问继续下钻，被调用时才 await 真实客户端 */
function lazyProxy(resolveTarget: () => Promise<unknown>): unknown {
  return new Proxy(function () {} as unknown as object, {
    get(_target, prop) {
      // 防止被当作 thenable，否则 await 一个中间节点会直接触发调用
      if (prop === 'then') return undefined
      return lazyProxy(() =>
        resolveTarget().then((owner) => {
          const value = Reflect.get(owner as object, prop, owner)
          return typeof value === 'function'
            ? (value as (...args: unknown[]) => unknown).bind(owner)
            : value
        })
      )
    },
    apply(_target, _thisArg, args: unknown[]) {
      return resolveTarget().then((fn) =>
        typeof fn === 'function' ? (fn as (...args: unknown[]) => unknown)(...args) : fn
      )
    },
  })
}

export const db = lazyProxy(() => resolveClient()) as PrismaClient
