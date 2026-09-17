import type { MetadataRoute } from 'next'

// PWA 清单：让手机可以把站点「添加到主屏幕」当独立 App 用（无浏览器地址栏）。
// Next.js 会把 /manifest.webmanifest 自动挂到页面 head 上。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '今天穿什么 · WearWhat',
    short_name: '穿什么',
    description: '衣橱管理 + 每日穿搭推荐',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f5f4',
    theme_color: '#ea580c',
    lang: 'zh-CN',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      // maskable：满幅背景，交给 Android 自己裁形状
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // 桌面图标长按菜单（Android/Chrome 支持；iOS Safari 目前不支持 manifest.shortcuts）
    shortcuts: [
      {
        name: '添加衣物',
        short_name: '加一件',
        url: '/?action=add',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: '我的衣橱',
        short_name: '衣橱',
        url: '/?tab=closet',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: '穿搭日历',
        short_name: '日历',
        url: '/?tab=calendar',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  }
}
