// WearWhat 数据库客户端 —— 本地 SQLite / 线上 内网 PostgreSQL（经 SQL Gateway）
//
// 【后端选择】
//   - 本地开发（next dev，Node/Bun）：Prisma + SQLite 文件，走 prisma/schema.prisma
//   - 线上（Cloudflare Workers）：Prisma + PostgreSQL 方言客户端（prisma/schema.worker-pg.prisma
//     生成，runtime=workerd），连接经内网 SQL Gateway —— Worker 不直连数据库端口，
//     协议与排错见 sql-gateway 仓库《使用与接入指南》
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
import { createGatewayPrismaAdapter } from './gateway-pg'
// 子路径是自包含模块（读取 worker 入口预埋在 globalThis 的上下文），
// 本地 Node 侧仅被解析、从不执行
import { getCloudflareContext } from '@opennextjs/cloudflare/cloudflare-context'

const isWorkers =
  typeof navigator !== 'undefined' &&
  (navigator as { userAgent?: string }).userAgent === 'Cloudflare-Workers'

let nodeClientPromise: Promise<PrismaClient> | null = null
// Workers 禁止跨请求复用 I/O 对象，因此以请求上下文为键缓存（ctx 回收即随之释放）
const workerClients = new WeakMap<object, Promise<PrismaClient>>()

async function createWorkerClient(): Promise<PrismaClient> {
  const { ctx, env } = getCloudflareContext()
  const cached = workerClients.get(ctx)
  if (cached) return cached

  const promise = (async () => {
    const { PrismaClient: WorkerPrisma } = await import('../generated/prisma-worker-pg/client')
    const vars = env as unknown as { SQL_GATEWAY_URL?: string; SQL_GATEWAY_TARGET?: string }
    if (!vars.SQL_GATEWAY_URL) {
      throw new Error(
        '未配置 SQL_GATEWAY_URL —— 生产库经内网 SQL Gateway 访问，请检查 wrangler.jsonc 的 [vars]'
      )
    }
    // 网关模式下 pg.Pool 只是 Prisma 的兼容外观，真实连接与池化都在内网网关侧
    return new WorkerPrisma({
      adapter: createGatewayPrismaAdapter(vars.SQL_GATEWAY_URL, vars.SQL_GATEWAY_TARGET || 'forgotit-postgres'),
    }) as unknown as PrismaClient
  })().catch((err) => {
    workerClients.delete(ctx) // 失败即失效，避免瞬时错误毒化整个 isolate
    throw err
  })

  workerClients.set(ctx, promise)
  return promise
}

async function createNodeClient(): Promise<PrismaClient> {
  const { PrismaClient: NodePrisma } = await import('@prisma/client')
  return new NodePrisma({ log: ['query'] }) as PrismaClient
}

function resolveClient(): Promise<PrismaClient> {
  if (isWorkers) return createWorkerClient()
  if (!nodeClientPromise) {
    nodeClientPromise = createNodeClient().catch((err) => {
      nodeClientPromise = null
      throw err
    })
  }
  return nodeClientPromise
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
