# 今天穿什么 WearWhat

> 别问，问就是它。

四季衣物管理 + AI 穿搭推荐的 Web 应用，移动优先设计，适配手机浏览器，可一键部署到 Cloudflare Workers + D1。

## 功能

- **衣物录入**：手机拍照后 AI 自动识别品类、颜色、材质等属性，也可手动填写
- **衣橱管理**：分类 / 季节 / 收纳状态筛选，支持换季收纳、洗涤中、维修中等状态流转
- **AI 搭配推荐**：结合实时天气与场合，每日生成 3 套搭配（规则引擎打分 + LLM 推荐理由），支持单件替换
- **穿着日历**：月视图记录每天穿搭，自动累计穿着次数与最近穿着时间
- **语义搜索**：「那件蓝色条纹衬衫」这类自然语言直接搜（LLM 解析 + 宽松降级）
- **衣橱洞察**：总价值、利用率、最常穿 / 最闲置、颜色分布、30 天穿着热度
- **愿望清单**：想买的单品先记录，含优先级与预期价格

## 技术栈

- Next.js 16（App Router）+ TypeScript + Tailwind CSS 4 + shadcn/ui
- Prisma ORM：本地开发用 SQLite，线上 Cloudflare D1（同一套 SQL 方言，见 `migrations/0001_init.sql`）
- 天气：Open-Meteo（免 Key，带内存缓存）
- AI：z-ai-web-dev-sdk（VLM 衣物识别 / LLM 搭配理由与搜索解析），均带超时降级

## 本地开发

```bash
bun install
bun run db:push           # 创建 SQLite 表
bun scripts/seed.ts       # 可选：导入 12 件种子衣物（图片在 public/seed）
bun run dev               # 启动开发服务器 http://localhost:3000
```

## 部署到 Cloudflare（Workers + D1）

配置已就绪：`wrangler.jsonc`、`open-next.config.ts`、D1 适配层 `src/lib/db-cf.ts`。

完整步骤（创建 D1、回填 database_id、应用迁移、构建部署）见 [DEPLOY.md](./DEPLOY.md)。

产品方案与需求背景见 [开发文档.md](./开发文档.md)。
