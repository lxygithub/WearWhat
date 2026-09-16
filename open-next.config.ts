// @opennextjs/cloudflare 适配器配置
// defineCloudflareConfig 会注入 Cloudflare 平台的缓存/队列等默认实现。
// 当前应用未使用 ISR / PPR / tag 缓存等高级特性，保持空配置即可。
// 文档：https://opennext.js/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
