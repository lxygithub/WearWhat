import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // SQL Gateway 模式用 pg 驱动（src/lib/gateway-pg.ts 把 pg.Pool 映射成网关请求）。
  // pg 在 Workers 下会 require('pg-cloudflare')，而其 exports 带 workerd 条件指向
  // dist/index.js；Next 的文件追踪默认只复制 dist/empty.js，esbuild 打包时便会
  // 「Could not resolve "pg-cloudflare"」。整包纳入追踪即可（体积很小）。
  outputFileTracingIncludes: {
    "*": ["./node_modules/pg-cloudflare/**"],
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

// ---- Cloudflare 部署支持（@opennextjs/cloudflare）----
// initOpenNextCloudflareForDev() 在本地 `next dev` 时通过 miniflare 启动一个
// 模拟的 Cloudflare 环境，让 getCloudflareContext() 在开发模式也能访问绑定
// （例如 D1 的 env.DB）。仅执行 `bun run cf:install` 安装依赖后才会生效。
// 用「动态 import + try/catch」包裹：依赖未安装时静默跳过，
// 保证 `bun run dev`（纯 SQLite 本地开发）完全不受影响。
(async () => {
  try {
    const mod = await import("@opennextjs/cloudflare");
    mod.initOpenNextCloudflareForDev();
  } catch {
    // 未安装 @opennextjs/cloudflare（未跑 bun run cf:install）时静默忽略
  }
})();

export default nextConfig;
