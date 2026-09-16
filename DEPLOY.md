# WearWhat 部署指南（Cloudflare Workers + D1）

本指南描述如何把「今天穿什么 (WearWhat)」从本地开发环境部署到 Cloudflare Workers，
数据库由本地 SQLite 切换到 Cloudflare D1（同为 SQLite 方言，schema 1:1 兼容）。

## 架构总览

| 环境 | 命令 | 运行时 | 数据库 |
| --- | --- | --- | --- |
| 本地开发 | `bun run dev` | Next.js Dev Server (Node/Bun) | SQLite 文件（`prisma db push`，`src/lib/db.ts`） |
| 生产 | `bun run cf:deploy` | Cloudflare Workers（OpenNext 适配） | Cloudflare D1（`src/lib/db-cf.ts`，绑定名 `DB`） |

部署链路：Next.js → `@opennextjs/cloudflare` 打包成 Worker（`.open-next/worker.js`）
+ 静态资产（`.open-next/assets`）→ `wrangler.jsonc` 定义绑定 → Workers Assets + D1。

## 前置条件

1. 一个 Cloudflare 账号（免费版即可，Workers 免费额度足够个人使用）。
2. 已安装 bun。
3. 安装部署工具链（一次性）：

   ```bash
   bun run cf:install
   # 等价于： bun add -d @opennextjs/cloudflare wrangler @prisma/adapter-d1
   ```

4. 登录 Cloudflare（会打开浏览器授权）：

   ```bash
   bunx wrangler login
   ```

## 第 1 步：创建 D1 数据库

```bash
bunx wrangler d1 create wearwhat-db
```

命令会输出类似：

```text
✅ Successfully created DB 'wearwhat-db'
database_id = 3f2a8c9e-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**把 `database_id` 粘贴进 `wrangler.jsonc`**，替换占位符：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "wearwhat-db",
    "database_id": "3f2a8c9e-xxxx-xxxx-xxxx-xxxxxxxxxxxx" // ← 替换这里
  }
]
```

## 第 2 步：应用数据库迁移

迁移文件 `migrations/0001_init.sql`（包含 ClothingItem / Outfit / OutfitItem /
WishlistItem 四张表，由 `prisma migrate diff` 生成）需要应用到 D1：

```bash
bun run db:d1:migrate          # 应用到远程 D1（生产）
bun run db:d1:migrate:local    # 应用到本地 miniflare 里的 D1（cf:preview 用）
```

> 想看表结构是否正确：`bunx wrangler d1 execute wearwhat-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`

## 第 3 步：本地预览（可选但推荐）

```bash
bun run cf:preview
```

会先执行 `opennextjs-cloudflare build`（内含 `next build`），再在本地 miniflare 中
起一个和生产完全一致的 Worker 环境，可提前发现兼容性问题。

## 第 4 步：部署上线

```bash
bun run cf:deploy
```

成功后输出 `https://wearwhat.<你的子域>.workers.dev`，直接用手机浏览器打开即可。

## 生产环境行为说明

### 数据存储

- 本地开发的数据（`db/custom.db`、种子衣物）**不会**自动同步到 D1；
  生产数据从空库开始，存放在 D1 中。
- 衣物图片目前以 **base64 data URL 存库**（`ClothingItem.imageData`）。
  ⚠️ D1 单行大小有限制（约 2MB 级别，且整个数据库免费版上限 500MB），
  大图会迅速膨胀。**建议后续迁移到 Cloudflare R2**：上传后只在库里存 URL/key。

### AI 能力

- `src/lib/ww-ai.ts`（VLM 识别 / LLM 推荐理由 / 搜索解析）依赖
  `z-ai-web-dev-sdk`，该 SDK 只在当前沙箱/开发环境可用。
- 部署到 Cloudflare 后此 SDK 无法访问，**需要替换为公网可访问的
  LLM/VLM API**（如 OpenAI 兼容接口、DeepSeek、智谱开放平台等）。
  只需修改 `src/lib/ww-ai.ts` 内的调用实现，保持函数签名不变，
  引擎层（`src/lib/ww-engine.ts`）与 API 路由无需改动。
- 三层 AI 均有降级策略：不替换也不会 500，只是识别/理由/语义搜索退化为规则结果。

## 常见问题（FAQ）

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 部署后接口报 `D1_ERROR` 或 500，日志出现 `REPLACE_WITH_YOUR_D1_ID` | `wrangler.jsonc` 的 `database_id` 占位符没替换 | 执行 `bunx wrangler d1 create wearwhat-db`，把真实 ID 填进去，重新 `cf:deploy` |
| 页面能开，但首次读数据报 `no such table: ClothingItem` | 迁移未应用 | `bun run db:d1:migrate`，本地预览还要跑 `db:d1:migrate:local` |
| 构建或运行时报 `nodejs_compat` 相关错误 / `The 'nodejs_compat' compatibility flag` | `wrangler.jsonc` 的 `compatibility_flags` 缺 `nodejs_compat` | 确认配置含 `"nodejs_compat"` 且 `compatibility_date` ≥ 2024-09-23，重新构建部署 |
| `wrangler d1 migrations` 报找不到迁移 | 迁移文件不在 `migrations/` 或不是 `.sql` | 确认 `migrations/0001_init.sql` 存在 |
| `bun run dev` 启动变慢或报 miniflare 相关警告 | 本地装了 `@opennextjs/cloudflare` 后 `next.config.ts` 会尝试初始化 Cloudflare dev 绑定 | 属预期行为，失败会静默跳过，不影响 SQLite 本地开发 |

## 相关文件清单

- `wrangler.jsonc` —— Workers + 静态资产 + D1 绑定配置（含中文注释）
- `open-next.config.ts` —— @opennextjs/cloudflare 适配器配置
- `next.config.ts` —— 追加了 `initOpenNextCloudflareForDev()`（静默失败，不影响本地 dev）
- `migrations/0001_init.sql` —— D1 初始化迁移（4 张表 + 1 个索引）
- `src/lib/db-cf.ts` —— 生产用 D1 版 Prisma Client 工厂（本地开发不调用）
- `package.json` —— 新增 `cf:*`、`db:d1:*` 脚本
