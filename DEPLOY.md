# WearWhat 部署指南（Cloudflare Workers + D1 + R2）

本指南描述如何把「今天穿什么 (WearWhat)」从本地开发环境部署到 Cloudflare Workers。
线上数据库用 D1、图片用 R2、AI 走 OpenAI 兼容端点（默认 DeepSeek）。

## 架构总览

| 环境 | 命令 | 运行时 | 数据库 | 图片 |
| --- | --- | --- | --- | --- |
| 本地开发 | `bun run dev` | Next.js Dev Server (Node/Bun) | SQLite 文件 | 无 R2 绑定，降级为 base64 存库 |
| 生产 | `bun run cf:deploy` | Cloudflare Workers（OpenNext 适配） | D1（绑定 `DB`） | R2（绑定 `BUCKET`） |

部署链路：Next.js → `@opennextjs/cloudflare` 打包成 Worker（`.open-next/worker.js`）
+ 静态资产（`.open-next/assets`）→ `wrangler.jsonc` 定义绑定 → Workers Assets + D1 + R2。

### 数据访问层：一个 `db`，两个后端

`src/lib/db.ts` 对外只导出 `db`，内部按运行时切换实现：

- **本地**（Node/Bun）：`@prisma/client` + SQLite
- **线上**（Workers）：`src/generated/prisma-worker` + `@prisma/adapter-d1`

两份客户端都用**动态 import** 加载，因此本地 dev 永远不会去解析 Workers 那份产物
（它内部是 `import('./query_engine_bg.wasm?module')`，Node 解析不了），反之亦然。
`db` 本身是惰性 Proxy，所以 29 处 `await db.xxx.yyy(...)` 调用点完全不用感知这层切换。

> **为什么 Workers 上不能直接用 `prisma-client-js`**：它生成的客户端用
> `#wasm-engine-loader` 动态导入 wasm 引擎，该写法在 OpenNext 的 esbuild 打包下不可用。
> 必须用新一代 `prisma-client` 生成器 + `runtime = "workerd"`。这一步由
> `scripts/gen-workers-schema.mjs` 在构建时自动完成（见下文），**不要手改**
> `prisma/schema.workers.prisma` 与 `src/generated/`，它们是构建产物。

### 图片：存 R2，库里只留地址

`src/lib/storage.ts` 在写入衣物时把进来的 base64 data URL 转存 R2，库里只保留
`/api/images/<uuid>.<ext>` 这样的**相对地址**。因为组件里都是 `<img src={item.imageData}>`，
data URL 与普通 URL 都能直接渲染，所以前端组件无需改动。

读取走本 Worker 的 `/api/images/<key>` 转发，而不是 R2 的 r2.dev 公共域名 ——
这样不依赖任何额外域名，将来换域名时库里存的地址也不会失效。

## 前置条件

1. 一个 Cloudflare 账号（免费版即可，Workers / D1 / R2 免费额度都够个人使用）。
2. 已安装 bun。
3. 安装部署工具链（一次性）：

   ```bash
   bun run cf:install
   # 等价于： bun add -d @opennextjs/cloudflare wrangler @prisma/adapter-d1
   ```

4. 登录 Cloudflare：

   ```bash
   bunx wrangler login
   ```

## 第 1 步：创建 D1 数据库

```bash
bunx wrangler d1 create wearwhat-db
```

把输出的 `database_id` 填进 `wrangler.jsonc` 的 `d1_databases[0].database_id`。

## 第 2 步：创建 R2 存储桶

```bash
bunx wrangler r2 bucket create wearwhat-images
```

绑定名固定为 `BUCKET`（见 `wrangler.jsonc` 的 `r2_buckets`），`src/lib/storage.ts` 按这个名字取。

> 不需要开启 R2 的公共访问（r2.dev）—— 图片经 Worker 路由转发，不依赖公网域名。

## 第 3 步：配置 AI 凭证

三层 AI（衣物识别 / 搭配理由 / 搜索解析）都走 OpenAI 兼容接口，凭证以 secret 形式下发：

```bash
printf '%s' 'https://api.deepseek.com' | bunx wrangler secret put ZAI_BASE_URL --name wearwhat
printf '%s' 'sk-你的key'                | bunx wrangler secret put ZAI_API_KEY  --name wearwhat
printf '%s' 'deepseek-flash'            | bunx wrangler secret put ZAI_MODEL    --name wearwhat
```

| 变量 | 说明 |
| --- | --- |
| `ZAI_BASE_URL` | 端点根地址，不带 `/chat/completions` |
| `ZAI_API_KEY` | API Key |
| `ZAI_MODEL` | 模型名。DeepSeek 要求必传 `model`，其他兼容端点若由服务端定模型可不设 |

任何 OpenAI 兼容端点都可以用（DeepSeek / 智谱 / OpenAI…），只要支持多模态即可用于衣物识别。

## 第 4 步：应用数据库迁移

```bash
bun run db:d1:migrate          # 应用到远程 D1（生产）
bun run db:d1:migrate:local    # 应用到本地 miniflare 里的 D1（cf:preview 用）
```

迁移文件是 `migrations/0001_init.sql`（ClothingItem / Outfit / OutfitItem / WishlistItem 四张表）。

## 第 5 步：部署

```bash
bun run cf:deploy
```

`cf:deploy` 会依次执行：

1. `scripts/gen-workers-schema.mjs` —— 从主 schema 派生 Workers 专用 schema
2. `prisma generate --schema prisma/schema.workers.prisma` —— 生成 `src/generated/prisma-worker`
3. `opennextjs-cloudflare build` —— Next.js 构建 + 打包成 Worker
4. `opennextjs-cloudflare deploy` —— 上传

成功后输出 `https://wearwhat.<你的子域>.workers.dev`，用手机浏览器打开即可。

本地预览（在 miniflare 里跑与生产一致的 Worker 环境）：

```bash
bun run cf:preview
```

## 已部署实例

| 资源 | 名称 / 值 |
| --- | --- |
| Worker | `wearwhat` → https://wearwhat.mewlxyy666.workers.dev |
| D1 | `wearwhat-db`（`d5215dfd-0972-4152-97c0-94c861b48e9a`） |
| R2 | `wearwhat-images` |

## 生产环境行为说明

### 图片

- 手机拍照后**先在浏览器端压缩**（`src/components/wearwhat/api.ts` 的 `compressImage`）：
  长边 720px、JPEG 质量 0.72。实测 4032×3024 的高细节照片压完约 150KB（base64 约 205KB）。
- 压缩后的 data URL 随表单上传，服务端转存 R2 并把地址写回库。
- 单张上限 20MB（前端 + 服务端各有一道），正常路径远远够用，只是防止绕过前端的异常请求。
- 换图或删除衣物时，旧图会从 R2 一并清掉，不留孤儿对象。
- 图片响应带 `Cache-Control: immutable`（键是随机 UUID、内容不变），可放心让浏览器与边缘长期缓存。

### AI

| 能力 | 入口 | 失败时的降级 |
| --- | --- | --- |
| 衣物识别（VLM） | `POST /api/clothing/recognize` | 抛错，前端提示手动填写 |
| 搭配理由（LLM） | `POST /api/outfits/recommend` | 返回 null，回落到模板文案 |
| 搜索解析（LLM） | `GET /api/search` | 返回 null，回落到整句关键词匹配 |

识别接口对图片体积另有 4.5MB 上限（`src/app/api/clothing/recognize/route.ts`），
比存储上限严格 —— 因为大图发给 VLM 又慢又贵，没必要。

### 数据

> **2026-09-17 起数据层已迁到内网 PostgreSQL**（经 SQL Gateway），D1 仅作历史备份，详见文末
> 「SQL Gateway 与 PostgreSQL 数据层」。

本地开发的数据（`db/custom.db`、种子衣物）**不会**自动同步到线上，生产数据从空库开始。
需要导入种子数据的话，`scripts/seed.ts` 走的是本地 SQLite，线上要另想办法（数据量小，手动补即可）。

### 账号系统（邮箱注册 / 登录 / 找回密码）

- 会话：JWT（`jose`，HS256，30 天）存在 httpOnly cookie `ww_session`；
  密码用 `bcryptjs` 哈希。两个库均为纯 JS / Web Crypto 实现，Workers 兼容。
- 生产环境**必须**设置 JWT 签名密钥（泄露即全员可伪造登录，务必随机）：

  ```bash
  # 生成随机密钥
  openssl rand -base64 32
  # 写入 Worker secret
  bunx wrangler secret put AUTH_SECRET
  ```

- 邮件发送：走 Resend HTTP API（fetch 实现，Workers 友好）。生产环境需要：

  ```bash
  bunx wrangler secret put RESEND_API_KEY   # resend.com 申请，免费额度 100 封/天
  bunx wrangler secret put MAIL_FROM        # 如 WearWhat <noreply@你的域名>
  ```

  - 用 `onboarding@resend.dev` 默认发件人时只能发给自己注册的邮箱；正式使用需在 Resend
    验证自己的域名后更新 `MAIL_FROM`。
  - **未配置 RESEND_API_KEY 时**：开发模式（`bun run dev`）验证码直接返回给前端并自动填入、
    同时打印到服务端日志，方便联调；**生产模式会报「邮件服务未配置」**，注册/找回不可用。
- 验证码：6 位数字，10 分钟有效，单次使用；同邮箱 60s 冷却 + 每小时 8 次上限
  （进程内限流，Workers 多 isolate 下为尽力而为）。
- 数据隔离：所有业务表带 `userId`，API 层从会话取当前用户并按其过滤/写入；
  首个注册用户会自动接管种子演示数据（`userId=default`），生产空库不受影响。

## 常见问题

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 接口报 `D1_ERROR` / 500，日志出现 `REPLACE_WITH_YOUR_D1_ID` | `wrangler.jsonc` 的 `database_id` 是占位符 | 执行第 1 步，把真实 ID 填进去 |
| 报 `no such table: ClothingItem` | 迁移未应用 | `bun run db:d1:migrate` |
| 报 `未找到 D1 绑定 env.DB` | `wrangler.jsonc` 缺 `d1_databases` 或绑定名不是 `DB` | 检查绑定配置 |
| 报 `AI 凭证未配置` | `ZAI_*` secret 没设 | 执行第 3 步 |
| 图片存进去了但打不开（404） | R2 绑定名不是 `BUCKET`，或桶不存在 | 检查 `wrangler.jsonc` 的 `r2_buckets` |
| 构建报 `no local hyperdrive connection string` 之类的绑定缺失 | 本地 `.env` 与 `wrangler.jsonc` 不一致 | 本项目不用 Hyperdrive；确认没混入其它项目的配置 |
| 本地 `bun run dev` 报 `@prisma/client` 找不到 | 没生成主 schema 的客户端 | `bun run db:generate` |
| 注册/找回时报「邮件服务未配置」或收不到验证码 | 生产未配置 Resend，或 Resend 域名未验证 | 配置 `RESEND_API_KEY`/`MAIL_FROM`（见账号系统一节）；本地开发验证码直接回填 |
| 登录后刷新又变回未登录 / 提示「请先登录」 | 生产未配置 `AUTH_SECRET` 或多个 Worker 实例密钥不一致 | `wrangler secret put AUTH_SECRET` 后重新部署 |

## 相关文件清单

| 文件 | 作用 |
| --- | --- |
| `wrangler.jsonc` | Workers + 静态资产 + D1 + R2 绑定配置 |
| `open-next.config.ts` | `@opennextjs/cloudflare` 适配器配置 |
| `src/lib/db.ts` | 数据库客户端（本地 SQLite / 线上 D1 双后端） |
| `src/lib/storage.ts` | 图片对象存储（R2 上传 / 删除 / 读取） |
| `src/app/api/images/[...key]/route.ts` | 图片读取路由 |
| `src/lib/ww-ai.ts` | AI 能力层（OpenAI 兼容端点） |
| `src/lib/auth.ts` | 账号会话（JWT）/ 密码哈希 / 401 响应 |
| `src/lib/mailer.ts` | Resend 邮件发送 + 开发模式验证码回显 |
| `src/lib/rate-limit.ts` | 进程内限流（验证码冷却/频次） |
| `scripts/gen-workers-schema.mjs` | 派生 Workers 专用 Prisma schema（构建时自动跑） |
| `prisma/schema.prisma` | 数据模型（SQLite 方言，本地与 D1 通用） |
| `migrations/0001_init.sql` | D1 初始化迁移（4 张表 + 1 个索引） |
| `migrations/0002_auth.sql` | 账号系统迁移（User + VerificationCode） |
| `package.json` | `cf:*`、`db:d1:*` 脚本 |

> `prisma/schema.workers.prisma` 与 `src/generated/` 是构建产物，已在 `.gitignore` 中忽略，**不要手改**。

## 本地开发

```bash
bun install
bun run db:generate        # 生成 Prisma 客户端
bun run db:push            # 创建 SQLite 表
bun scripts/seed.ts        # 可选：导入 12 件种子衣物（图片在 public/seed）
bun run dev                # http://localhost:3000
```

本地需要一个 `.env`（已在 `.gitignore` 中忽略）：

```bash
DATABASE_URL="file:./db/custom.db"
# AI 功能可选；不配的话识别会报错、推荐与搜索走降级
ZAI_BASE_URL=https://api.deepseek.com
ZAI_API_KEY=sk-你的key
ZAI_MODEL=deepseek-flash
```

账号功能本地零配置：未配置邮件服务时，验证码会自动回填到表单（开发模式）。

---

## SQL Gateway 与 PostgreSQL 数据层（2026-09-17）

线上数据不再走 D1：Worker 经 WAF + Tunnel 调用家中 SQL Gateway，读写内网 PostgreSQL 的
**独立 `wearwhat` 库**（库级隔离，target `wearwhat-postgres`，账号 `sql_gateway_wearwhat_ro/rw`）。
本地开发仍是 SQLite（`prisma/schema.prisma`），两套互不影响。

### 建库（owner 执行一次）

```bash
# 在部署网关的那台机器上，把 __RO__/__RW__ 换成该 target 的只读/读写账号名
sed 's/__RO__/sql_gateway_wearwhat_ro/g; s/__RW__/sql_gateway_wearwhat_rw/g' scripts/pg-schema.sql > /tmp/wearwhat.sql
docker exec -i forgotit-postgres psql -U <owner> -d wearwhat -v ON_ERROR_STOP=1 -f - < /tmp/wearwhat.sql
```

### 部署链路（已内置在 cf:build 里）

```bash
bun run cf:deploy
# = scripts/gen-workers-schema.mjs（派生 worker-pg schema）
#   + prisma generate --schema prisma/schema.worker-pg.prisma
#   + opennextjs-cloudflare build + deploy
```

### 三个必须记住的坑

1. **Prisma 的方言由 schema 决定，不是由 adapter 决定**：所以 `gen-workers-schema.mjs` 额外派生一份
   `schema.worker-pg.prisma`（`provider = "postgresql"`）。同时因为表在独立 schema 里，还需要
   `schemas = ["wearwhat"]` + 每个 model 的 `@@schema("wearwhat")` —— 否则 Prisma 会发
   `"public"."User"` 而报 `relation "public.User" does not exist`。
2. **`pg-cloudflare` 必须整包进文件追踪**：`pg` 在 Workers 下会 `require('pg-cloudflare')`，其
   `exports` 的 `workerd` 条件指向 `dist/index.js`，而 Next 默认只复制 `dist/empty.js`，esbuild 打包会报
   `Could not resolve "pg-cloudflare"`。已在 `next.config.ts` 用
   `outputFileTracingIncludes: { '*': ['./node_modules/pg-cloudflare/**'] }` 解决。
3. **时间戳按 UTC 存、按 UTC 读**：网关侧已固定（`pgTypes.setTypeParser(1114, …)` + 连接
   `options: '-c timezone=UTC'`），应用侧无需特殊处理，但**不要**再往库里写本地时区的字符串。

### 回退

`wrangler.jsonc` 里的 D1 绑定（`wearwhat-db`）与 `prisma/schema.workers.prisma`（SQLite 方言 workers
客户端）都还在：把 `src/lib/db.ts` 的 worker 分支切回 `PrismaD1` 并部署即可回到 D1 形态（D1 里是
迁移前的快照，切换后的新数据不会回补）。
