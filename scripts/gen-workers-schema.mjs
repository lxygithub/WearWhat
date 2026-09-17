#!/usr/bin/env bun
// 从 prisma/schema.prisma 派生 Workers 专用 schema（单一事实源，防漂移）：
//  - 换用新一代 prisma-client 生成器，runtime=workerd
//    （wasm 引擎经 `import('./query_engine_bg.wasm?module')` 静态加载，
//     与 wrangler 的 wasm 约定和 OpenNext 的 Turbopack wasm 补丁兼容；
//     旧 prisma-client-js 的 #wasm-engine-loader 动态导入在 OpenNext esbuild 上不可用）
//  - 输出到 src/generated/prisma-worker-pg（已 gitignore，cf:build 时自动重新生成）
//  - 数据模型与主 schema 完全一致（本脚本仅替换 generator 块）
//
// 2026-09：线上数据层由 D1 迁到内网 PostgreSQL（经 SQL Gateway），因此额外派生一份
// PostgreSQL 方言的 schema —— Prisma 的 SQL 方言由 datasource.provider 决定，
// 光换 adapter 不够。本地 dev 仍用主 schema（SQLite），互不影响。
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'prisma/schema.prisma';
const DST_D1 = 'prisma/schema.workers.prisma';       // D1 方言（回退用，保留）
const DST_PG = 'prisma/schema.worker-pg.prisma';     // PostgreSQL 方言（当前线上）

const PG_SCHEMA = 'wearwhat';

const WORKER_GENERATOR = `generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma-worker-pg"
  runtime      = "workerd"
  moduleFormat = "esm"
}`;

const D1_GENERATOR = `generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma-worker"
  runtime      = "workerd"
  moduleFormat = "esm"
}`;

const src = readFileSync(SRC, 'utf8');
if (!/generator client \{[\s\S]*?\n\}/.test(src)) {
  console.error('[gen-workers-schema] 主 schema 缺少 generator client 块');
  process.exit(1);
}

// PostgreSQL 版：换 generator、datasource 改 postgresql + schemas，并给每个 model 注入 @@schema
// （Prisma 默认发 "public"."User"，而本项目在同一个库里用独立 schema 与 ForgotIt / daohang 隔离）
let pg = src
  .replace(/generator client \{[\s\S]*?\n\}/, WORKER_GENERATOR)
  .replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"')
  .replace(/(datasource db \{[\s\S]*?url\s*=\s*env\("DATABASE_URL"\))/, `$1\n  schemas  = ["${PG_SCHEMA}"]`);

// 每个 model 块末尾插入 @@schema("wearwhat")（若已有 attributes 行则追加在后）
pg = pg.replace(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g, (whole, name, body) => {
  if (body.includes('@@schema(')) return whole;
  return `model ${name} {${body}\n\n  @@schema("${PG_SCHEMA}")\n}`;
});

if (!/provider = "postgresql"/.test(pg)) {
  console.error('[gen-workers-schema] 未能把 datasource.provider 改成 postgresql');
  process.exit(1);
}
if ((pg.match(/@@schema\("wearwhat"\)/g) || []).length === 0) {
  console.error('[gen-workers-schema] 未能注入 @@schema');
  process.exit(1);
}
writeFileSync(DST_PG, pg);
console.log('[gen-workers-schema] wrote', DST_PG);

// D1 版：仅换 generator（保留 SQLite 方言），供回退与对照
writeFileSync(DST_D1, src.replace(/generator client \{[\s\S]*?\n\}/, D1_GENERATOR));
console.log('[gen-workers-schema] wrote', DST_D1);
