/**
 * D1 版 Prisma Client 工厂（生产环境专用，本地开发【不要】调用本文件）
 * =====================================================================
 *
 * 背景：
 * - 本地开发走 `bun run dev` + Prisma + SQLite（见 src/lib/db.ts），不需要本文件。
 * - 生产部署到 Cloudflare Workers 时，数据库是 Cloudflare D1（SQLite 方言）。
 *   Workers 运行时无法直接用文件型 SQLite，必须通过 Prisma 的 Driver Adapter
 *   把 D1 的 HTTP/RPC 绑定接入 Prisma Client。
 *
 * 使用前安装依赖（一次性）：
 *   bun run cf:install
 *   # 等价于： bun add -d @opennextjs/cloudflare wrangler @prisma/adapter-d1
 *
 * Prisma driverAdapters 说明：
 * - Prisma 6 起 driverAdapters 已正式内置支持，无需任何 preview flag。
 * - 如果你的 Prisma 版本较老（< 6）报错提示需要 preview feature，可在
 *   prisma/schema.prisma 的 generator client 中追加：
 *     previewFeatures = ["driverAdapters"]
 *
 * 对应 schema 与迁移：
 * - schema：prisma/schema.prisma（纯 SQLite 方言，D1 兼容）
 * - 迁移：  migrations/0001_init.sql（由 `prisma migrate diff` 生成）
 * - 应用：  bun run db:d1:migrate（远程）/ bun run db:d1:migrate:local（本地预览）
 *
 * 典型用法（在 API 路由中按需替换现有 db 导入）：
 *   import { getPrismaForCloudflare } from "@/lib/db-cf";
 *   const db = getPrismaForCloudflare();   // 返回与 src/lib/db.ts 相同形状的 PrismaClient
 *   await db.clothingItem.findMany();
 *
 * 注意：本模块所有依赖都用动态 import 引入，因为 @prisma/adapter-d1 与
 * @opennextjs/cloudflare 属于部署期可选依赖（未安装时本地 lint/dev 也不会报错）。
 */

// 单例缓存：Workers 全局作用域中复用同一个 PrismaClient，避免每次请求重建连接开销
let cachedClient: any = null;

/**
 * 获取绑定 Cloudflare D1 的 Prisma Client（生产用）。
 *
 * 工作原理：
 * 1. getCloudflareContext() 来自 @opennextjs/cloudflare，
 *    在 Worker 运行时返回当前请求的 Cloudflare 环境（env）。
 * 2. env.DB 是 wrangler.jsonc 中 d1_databases 配置的绑定（binding: "DB"），
 *    即 wearwhat-db 数据库的 D1Database 实例。
 * 3. PrismaD1 适配器把 D1Database 适配成 Prisma 的 driver adapter 协议，
 *    PrismaClient 由此把 SQL 发给 D1 执行。
 */
export async function getPrismaForCloudflare(): Promise<any> {
  // 命中缓存直接返回（同一 Worker 实例内只建一次）
  if (cachedClient) return cachedClient;

  // 动态 import：避免在未安装可选依赖的本地环境构建/开发时报错
  const [{ PrismaClient }, { PrismaD1 }, { getCloudflareContext }] = await Promise.all([
    // Prisma Client（已安装，prisma generate 生成）
    import("@prisma/client"),
    // D1 适配器：bun add -d @prisma/adapter-d1
    import("@prisma/adapter-d1"),
    // Cloudflare 上下文：bun add -d @opennextjs/cloudflare（opennextjs-cloudflare build 注入）
    import("@opennextjs/cloudflare"),
  ]);

  // 取得 D1 绑定；若 wrangler.jsonc 未配置 d1_databases 或 database_id 未填会在这里抛错
  const { env } = getCloudflareContext();
  const d1 = (env as { DB?: unknown }).DB;
  if (!d1) {
    throw new Error(
      "未找到 D1 绑定 env.DB —— 请检查 wrangler.jsonc 的 d1_databases 配置，" +
        "并确认 database_id 已替换为 `bunx wrangler d1 create wearwhat-db` 输出的真实 ID。"
    );
  }

  const adapter = new PrismaD1(d1);
  // 如需显式指定输出位置/引擎类型，可在 prisma/schema.prisma 中调整 generator 配置
  const prisma = new PrismaClient({ adapter });

  cachedClient = prisma;
  return prisma;
}
