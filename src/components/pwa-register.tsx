'use client'

import { useEffect } from 'react'

// 注册 Service Worker（App 壳缓存）。仅在 HTTPS/生产环境生效；
// 注册失败不影响任何功能（PWA 只是增强）。
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 忽略：SW 不可用不影响使用 */
    })
  }, [])
  return null
}
