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

本地开发的数据（`db/custom.db`、种子衣物）**不会**自动同步到线上，生产数据从空库开始。
需要导入种子数据的话，`scripts/seed.ts` 走的是本地 SQLite，线上要另想办法（数据量小，手动补即可）。

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

## 相关文件清单

| 文件 | 作用 |
| --- | --- |
| `wrangler.jsonc` | Workers + 静态资产 + D1 + R2 绑定配置 |
| `open-next.config.ts` | `@opennextjs/cloudflare` 适配器配置 |
| `src/lib/db.ts` | 数据库客户端（本地 SQLite / 线上 D1 双后端） |
| `src/lib/storage.ts` | 图片对象存储（R2 上传 / 删除 / 读取） |
| `src/app/api/images/[...key]/route.ts` | 图片读取路由 |
| `src/lib/ww-ai.ts` | AI 能力层（OpenAI 兼容端点） |
| `scripts/gen-workers-schema.mjs` | 派生 Workers 专用 Prisma schema（构建时自动跑） |
| `prisma/schema.prisma` | 数据模型（SQLite 方言，本地与 D1 通用） |
| `migrations/0001_init.sql` | D1 初始化迁移（4 张表 + 1 个索引） |
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
