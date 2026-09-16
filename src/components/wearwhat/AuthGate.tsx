// 会话网关：未登录显示 AuthScreen，已登录进入主应用
// 挂载时校验一次会话；运行中任何业务 API 返回 401 都会回到登录界面

'use client'

import { useEffect } from 'react'
import { api, setUnauthorizedHandler } from './api'
import { useWW } from './store'
import { AuthScreen } from './AuthScreen'
import { WearWhatApp } from './WearWhatApp'

export function AuthGate() {
  const user = useWW((s) => s.user)
  const authChecked = useWW((s) => s.authChecked)

  // 注册 401 处理：清空本地数据并回到登录界面
  useEffect(() => {
    setUnauthorizedHandler(() => {
      const s = useWW.getState()
      s.resetData()
      s.setUser(null)
      useWW.setState({ authChecked: true })
    })
  }, [])

  // 挂载时检查会话
  useEffect(() => {
    if (authChecked) return
    void (async () => {
      try {
        const { user } = await api.authMe()
        useWW.getState().setUser(user)
      } catch {
        useWW.getState().setUser(null)
      } finally {
        useWW.setState({ authChecked: true })
      }
    })()
  }, [authChecked])

  if (!authChecked) {
    return <AuthSplash />
  }
  if (!user) {
    return <AuthScreen />
  }
  return <WearWhatApp />
}

function AuthSplash() {
  return (
    <div className="min-h-screen bg-stone-200/50 dark:bg-black/40">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-background px-8 shadow-xl sm:border-x sm:border-border/60">
        <div className="flex h-16 w-16 animate-bounce items-center justify-center rounded-2xl bg-orange-600 text-3xl shadow-lg shadow-orange-600/20">
          👕
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">正在打开你的衣橱…</p>
      </div>
    </div>
  )
}
