// 登录 / 注册 / 找回密码（邮箱 + 验证码）
// 开发模式（服务端未配置邮件服务）时，验证码会直接返回并自动填入，方便本地联调

'use client'

import { useEffect, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { api } from './api'
import { useWW } from './store'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register' | 'forgot'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthScreen() {
  return (
    <div className="min-h-screen bg-stone-200/50">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background px-6 pb-10 pt-[calc(env(safe-area-inset-top)+3rem)] shadow-xl sm:border-x sm:border-stone-300/60">
        {/* 品牌 */}
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-600 text-3xl shadow-lg shadow-orange-600/20">
            👕
          </div>
          <h1 className="mt-4 text-xl font-black tracking-tight text-stone-900">今天穿什么</h1>
          <p className="mt-1 text-xs text-stone-400">别问，问就是它 · 每天替你把衣服搭好</p>
        </div>

        <AuthCard />
      </div>
    </div>
  )
}

function AuthCard() {
  const [mode, setMode] = useState<Mode>('login')

  return (
    <div className="mt-8 flex-1">
      {mode !== 'forgot' ? (
        <>
          {/* 模式切换 */}
          <div className="grid grid-cols-2 rounded-2xl bg-stone-100 p-1" role="tablist">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'min-h-[40px] rounded-xl text-sm font-bold transition-all',
                  mode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400',
                )}
              >
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>
          {mode === 'login' ? (
            <LoginForm onForgot={() => setMode('forgot')} />
          ) : (
            <RegisterForm />
          )}
        </>
      ) : (
        <ForgotForm onBack={() => setMode('login')} />
      )}

      <p className="mt-8 text-center text-[11px] leading-relaxed text-stone-300">
        衣橱数据按账号隔离，只属于你自己
        <br />
        登录即代表同意：衣服再多也不算浪费
      </p>
    </div>
  )
}

/* ---------- 登录 ---------- */

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const setUser = useWW((s) => s.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      toast({ title: '邮箱格式不正确', variant: 'destructive' })
      return
    }
    if (!password) {
      toast({ title: '请输入密码', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const { user } = await api.authLogin(email.trim().toLowerCase(), password)
      setUser(user)
      toast({ title: '欢迎回来' })
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : '登录失败', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="邮箱"
        className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm focus:border-orange-400 focus:outline-none"
      />
      <div className="relative">
        <input
          type={showPw ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="密码"
          className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 pr-14 text-sm focus:border-orange-400 focus:outline-none"
        />
        <button
          type="button"
          aria-label={showPw ? '隐藏密码' : '显示密码'}
          onClick={() => setShowPw((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-stone-400"
        >
          {showPw ? '隐藏' : '显示'}
        </button>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => void submit()}
        className="h-12 w-full rounded-xl bg-orange-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50"
      >
        {loading ? '登录中…' : '登录'}
      </button>

      <div className="flex items-center justify-between pt-1 text-xs">
        <button type="button" onClick={onForgot} className="text-stone-400 hover:text-orange-600">
          忘记密码？
        </button>
        <span className="text-stone-300">新用户请切换到顶部「注册」</span>
      </div>
    </div>
  )
}

/* ---------- 注册 ---------- */

function RegisterForm() {
  const setUser = useWW((s) => s.setUser)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cd, setCd] = useState(0)

  useEffect(() => {
    if (cd <= 0) return
    const t = setTimeout(() => setCd((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [cd])

  const sendCode = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      toast({ title: '先填一个正确的邮箱', variant: 'destructive' })
      return
    }
    setSending(true)
    try {
      const r = await api.authSendCode(email.trim().toLowerCase(), 'register')
      setCd(60)
      if (r.devCode) {
        setCode(r.devCode)
        setDevCode(r.devCode)
      } else {
        toast({ title: '验证码已发送，查收邮箱' })
      }
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : '发送失败', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      toast({ title: '邮箱格式不正确', variant: 'destructive' })
      return
    }
    if (password.length < 6) {
      toast({ title: '密码至少 6 位', variant: 'destructive' })
      return
    }
    if (!/^\d{6}$/.test(code.trim())) {
      toast({ title: '请输入 6 位数字验证码', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const { user } = await api.authRegister({
        email: email.trim().toLowerCase(),
        password,
        code: code.trim(),
        name: name.trim() || undefined,
      })
      setUser(user)
      toast({ title: '衣橱开张！种子衣物已就位' })
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : '注册失败', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="邮箱"
        className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm focus:border-orange-400 focus:outline-none"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        placeholder="昵称（选填）"
        className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm focus:border-orange-400 focus:outline-none"
      />
      <input
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码（至少 6 位）"
        className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm focus:border-orange-400 focus:outline-none"
      />

      {/* 验证码 */}
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="验证码"
          className="h-12 min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 text-sm tracking-[0.4em] focus:border-orange-400 focus:outline-none"
        />
        <button
          type="button"
          disabled={sending || cd > 0}
          onClick={() => void sendCode()}
          className="h-12 w-28 shrink-0 rounded-xl border border-orange-500 bg-orange-50 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-100 disabled:opacity-50"
        >
          {cd > 0 ? `${cd}s 后重发` : sending ? '发送中…' : '获取验证码'}
        </button>
      </div>
      {devCode ? (
        <div className="rounded-xl border border-dashed border-orange-300 bg-orange-50/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-orange-700">
          开发模式：未配置邮件服务，验证码已自动填入 <b className="tracking-widest">{devCode}</b>
          <br />
          线上部署时配置 RESEND_API_KEY 即改为真实发信（见 DEPLOY.md）
        </div>
      ) : null}

      <button
        type="button"
        disabled={loading}
        onClick={() => void submit()}
        className="h-12 w-full rounded-xl bg-orange-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50"
      >
        {loading ? '注册中…' : '注册并进入衣橱'}
      </button>

      <p className="pt-1 text-center text-[11px] text-stone-400">注册成功后会自动登录，直接进入衣橱</p>
    </div>
  )
}

/* ---------- 找回密码 ---------- */

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cd, setCd] = useState(0)

  useEffect(() => {
    if (cd <= 0) return
    const t = setTimeout(() => setCd((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [cd])

  const sendCode = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      toast({ title: '先填一个正确的邮箱', variant: 'destructive' })
      return
    }
    setSending(true)
    try {
      const r = await api.authSendCode(email.trim().toLowerCase(), 'reset')
      setCd(60)
      if (r.devCode) {
        setCode(r.devCode)
        setDevCode(r.devCode)
      } else {
        toast({ title: '若邮箱已注册，验证码已发出' })
      }
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : '发送失败', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      toast({ title: '邮箱格式不正确', variant: 'destructive' })
      return
    }
    if (newPassword.length < 6) {
      toast({ title: '新密码至少 6 位', variant: 'destructive' })
      return
    }
    if (!/^\d{6}$/.test(code.trim())) {
      toast({ title: '请输入 6 位数字验证码', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      await api.authResetPassword({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
      })
      toast({ title: '密码已重置，用新密码登录吧' })
      onBack()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : '重置失败', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="rounded-xl bg-stone-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-stone-400">
        输入注册邮箱，我们会发送 6 位验证码；验证通过后设置新密码。
      </div>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="注册邮箱"
        className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm focus:border-orange-400 focus:outline-none"
      />

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="验证码"
          className="h-12 min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 text-sm tracking-[0.4em] focus:border-orange-400 focus:outline-none"
        />
        <button
          type="button"
          disabled={sending || cd > 0}
          onClick={() => void sendCode()}
          className="h-12 w-28 shrink-0 rounded-xl border border-orange-500 bg-orange-50 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-100 disabled:opacity-50"
        >
          {cd > 0 ? `${cd}s 后重发` : sending ? '发送中…' : '获取验证码'}
        </button>
      </div>
      {devCode ? (
        <div className="rounded-xl border border-dashed border-orange-300 bg-orange-50/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-orange-700">
          开发模式：验证码已自动填入 <b className="tracking-widest">{devCode}</b>
        </div>
      ) : null}

      <input
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="新密码（至少 6 位）"
        className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm focus:border-orange-400 focus:outline-none"
      />

      <button
        type="button"
        disabled={loading}
        onClick={() => void submit()}
        className="h-12 w-full rounded-xl bg-orange-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50"
      >
        {loading ? '重置中…' : '重置密码'}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full pt-1 text-center text-xs text-stone-400 hover:text-orange-600"
      >
        返回登录
      </button>
    </div>
  )
}
