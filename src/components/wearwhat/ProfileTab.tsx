// 我的：统计 + 设置 + 愿望清单 + 关于

'use client'

import { useState } from 'react'
import { Bot, Eye, EyeOff, Heart, KeyRound, LogOut, MapPin, Monitor, Moon, Plus, Save, Sun, SunMoon, Trash2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from '@/hooks/use-toast'
import { api } from './api'
import { CITIES, categoryIcon, categoryLabel, colorHex } from './constants'
import type { ClothingItem } from './types'
import { useWW } from './store'
import { EmptyHint, SectionTitle, WWSkeleton, useMounted } from './ui-bits'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { clearAISettings, getAISettings, saveAISettings, type AISettings } from './ai-settings'
import { Input } from '@/components/ui/input'

export function ProfileTab() {
  const { stats, items, city, setCity, user, setUser, resetData } = useWW()

  const logout = async () => {
    try {
      await api.authLogout()
    } catch {
      /* 就算请求失败也本地退出 */
    }
    resetData()
    setUser(null)
    toast({ title: '已退出登录，衣橱帮你锁好了' })
  }

  return (
    <div className="space-y-5">
      {/* 账号卡片 */}
      {user ? (
        <section>
          <div
            className="flex items-center gap-3.5 rounded-2xl p-4 shadow-sm"
            style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 55%, #c2410c 100%)' }}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/95 text-lg font-black text-orange-600 shadow-inner">
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{user.name || '时髦的人'}</p>
              <p className="truncate text-[11px] text-white/70">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex min-h-[36px] items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-white/25"
            >
              <LogOut className="h-3.5 w-3.5" />
              退出
            </button>
          </div>
        </section>
      ) : null}

      {/* 统计总览 */}
      <section>
        <SectionTitle title="衣橱统计" />
        {stats ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <StatBig label="全部衣物" value={String(stats.totalItems)} unit="件" sub={`${stats.activeItems} 件在穿`} />
            <StatBig
              label="总价值"
              value={stats.totalValue > 0 ? `¥${Math.round(stats.totalValue).toLocaleString()}` : '—'}
              unit=""
              sub="按录入价格合计"
            />
            <StatBig label="30 天利用率" value={`${stats.utilization}`} unit="%" sub="近期穿过的比例" />
            <StatBig
              label="待清洗"
              value={String(items.filter((i) => i.storageStatus === 'laundry').length)}
              unit="件"
              sub="洗完记得放回去"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <WWSkeleton key={i} className="h-20" />
            ))}
          </div>
        )}
      </section>

      {/* 最常穿 / 最闲置 */}
      {stats && (stats.topWorn.length > 0 || stats.mostIdle.length > 0) ? (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RankCard title="最常穿 Top 3" badge="🔥" items={stats.topWorn} valueFn={(i) => `穿过 ${i.wearCount} 次`} />
          <RankCard
            title="最闲置 Top 3"
            badge="💤"
            items={stats.mostIdle}
            valueFn={(i) => {
              if (!i.lastWornAt) return '从未穿过'
              const days = Math.floor((Date.now() - new Date(i.lastWornAt).getTime()) / 86400000)
              return `${days} 天没穿`
            }}
          />
        </section>
      ) : null}

      {/* 颜色分布 */}
      {stats && stats.colorDist.length > 0 ? (
        <section>
          <SectionTitle title="颜色分布" />
          <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
            {stats.colorDist.slice(0, 6).map((c) => {
              const max = stats.colorDist[0]?.count || 1
              return (
                <div key={c.name} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-border/60"
                    style={{ backgroundColor: colorHex(c.name) }}
                  />
                  <span className="w-12 shrink-0 text-xs text-muted-foreground">{c.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-orange-500/80"
                      style={{ width: `${Math.max(6, Math.round((c.count / max) * 100))}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-[10px] text-muted-foreground/70">{c.count}</span>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* 穿着热度（近 30 天） */}
      {stats && stats.wearLast30.some((d) => d.count > 0) ? (
        <section>
          <SectionTitle title="穿着热度 · 近 30 天" />
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex h-16 items-end gap-[3px]">
              {stats.wearLast30.map((d) => {
                const max = Math.max(...stats.wearLast30.map((x) => x.count), 1)
                const h = d.count === 0 ? 4 : Math.max(12, Math.round((d.count / max) * 56))
                return (
                  <div
                    key={d.date}
                    title={`${d.date}：${d.count} 套`}
                    className={cn('flex-1 rounded-sm', d.count === 0 ? 'bg-muted' : 'bg-orange-500/85')}
                    style={{ height: `${h}px` }}
                  />
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* 类别分布 */}
      {stats && stats.categoryDist.length > 0 ? (
        <section>
          <SectionTitle title="类别分布" />
          <div className="flex flex-wrap gap-1.5">
            {stats.categoryDist.map((c) => (
              <span
                key={c.category}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm"
              >
                {categoryIcon(c.category)} {categoryLabel(c.category)} · {c.count}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <WishlistSection />

      <AISettingsSection />

      <AppearanceSection />

      {/* 设置 */}
      <section>
        <SectionTitle title="设置" />
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-orange-500" />
              天气城市
            </div>
            <Select value={city} onValueChange={(v) => void setCity(v)}>
              <SelectTrigger className="w-28 h-9" aria-label="选择天气城市">
                <SelectValue placeholder="选择城市" />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* 关于 */}
      <section>
        <div className="rounded-2xl border border-border bg-muted/50 p-4 text-center">
          <p className="text-sm font-black text-foreground">今天穿什么 · WearWhat</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">
            v0.2.0 · Web 端（手机适配）· 邮箱账号
            <br />
            数据库 SQLite / Cloudflare D1 Ready · AI 识别与搭配由大模型驱动
            <br />
            本地模式：衣服数据在你手里。云端模式：也只是多把锁。
          </p>
        </div>
      </section>
    </div>
  )
}

function AISettingsSection() {
  const [settings, setSettings] = useState<AISettings>(() => getAISettings())
  const [showKey, setShowKey] = useState(false)

  const update = (key: keyof AISettings, value: string) => {
    setSettings((previous) => ({ ...previous, [key]: value }))
  }

  const save = () => {
    const baseUrl = settings.baseUrl.trim()
    const apiKey = settings.apiKey.trim()
    if (!baseUrl || !apiKey) {
      toast({ title: '服务地址和 API Key 都要填', variant: 'destructive' })
      return
    }
    try {
      const url = new URL(baseUrl)
      if (url.protocol !== 'https:') throw new Error()
    } catch {
      toast({ title: '服务地址需要是 HTTPS URL', variant: 'destructive' })
      return
    }
    const next = { ...settings, baseUrl, apiKey, model: settings.model.trim() }
    saveAISettings(next)
    setSettings(next)
    toast({ title: '模型配置已保存', description: '下一次 AI 请求会使用这套配置。' })
  }

  const clear = () => {
    clearAISettings()
    setSettings({ baseUrl: '', apiKey: '', model: '' })
    toast({ title: '已清除自定义模型', description: '后续会使用部署方配置的默认模型。' })
  }

  return (
    <section>
      <SectionTitle title="AI 模型" />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">自带云端大模型</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/70">
              支持 OpenAI 兼容接口，如 DeepSeek、OpenAI、智谱。用于识图、搭配理由和智能搜索。
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">服务地址</span>
            <Input
              value={settings.baseUrl}
              onChange={(event) => update('baseUrl', event.target.value)}
              placeholder="https://api.deepseek.com"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-10 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">API Key</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                value={settings.apiKey}
                onChange={(event) => update('apiKey', event.target.value)}
                type={showKey ? 'text' : 'password'}
                placeholder="sk-..."
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                className="h-10 pl-8 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey((visible) => !visible)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground/70 transition-colors hover:text-foreground"
                aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">模型名 <span className="font-normal text-muted-foreground/60">（可选）</span></span>
            <Input
              value={settings.model}
              onChange={(event) => update('model', event.target.value)}
              placeholder="deepseek-chat / gpt-4o-mini"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-10 text-sm"
            />
          </label>
        </div>

        <div className="mt-3 rounded-xl bg-muted px-3 py-2 text-[10px] leading-relaxed text-muted-foreground/70">
          API Key 只保存在此浏览器，不写入账号或数据库；调用 AI 时通过 HTTPS 临时转发到你填写的服务。
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={save}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-900 text-xs font-bold text-white transition-colors hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
          >
            <Save className="h-3.5 w-3.5" />
            保存并启用
          </button>
          <button
            type="button"
            onClick={clear}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold text-muted-foreground transition-colors hover:border-red-200 hover:text-red-500 dark:hover:border-red-500/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清除
          </button>
        </div>
      </div>
    </section>
  )
}

const THEME_OPTIONS = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
] as const

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  return (
    <section>
      <SectionTitle title="外观" />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SunMoon className="h-4 w-4 text-orange-500" />
          界面主题
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="界面主题">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = mounted && theme === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-1 text-xs font-bold transition-all',
                  selected
                    ? 'bg-card text-orange-600 shadow-sm dark:text-orange-500'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">
          跟随系统会随设备的深浅色自动切换。
        </p>
      </div>
    </section>
  )
}

function StatBig({ label, value, unit, sub }: { label: string; value: string; unit: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
      <div className="text-[10px] text-muted-foreground/70">{label}</div>
      <div className="mt-1 text-xl font-black text-foreground">
        {value}
        <span className="ml-0.5 text-[11px] font-medium text-muted-foreground/70">{unit}</span>
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground/70">{sub}</div>
    </div>
  )
}

function RankCard({
  title,
  badge,
  items,
  valueFn,
}: {
  title: string
  badge: string
  items: ClothingItem[]
  valueFn: (i: ClothingItem) => string
}) {
  const openSheet = useWW((s) => s.openSheet)
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-xs font-bold text-muted-foreground">
        {badge} {title}
      </h3>
      {items.length === 0 ? (
        <p className="py-2 text-[11px] text-muted-foreground/60">还没有数据</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => openSheet({ type: 'detail', item: it })}
              className="flex w-full items-center gap-2 text-left"
            >
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-muted">
                {it.imageData ? (
                  <img src={it.imageData} alt={it.name ?? ''} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm">
                    {categoryIcon(it.category)}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">
                  {it.name || '未命名'}
                </span>
                <span className="block text-[10px] text-muted-foreground/70">{valueFn(it)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function WishlistSection() {
  const { wishlist, loadWishlist } = useWW()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [adding, setAdding] = useState(false)

  const add = async () => {
    if (!name.trim()) return
    setAdding(true)
    try {
      await api.createWishlist({ name: name.trim(), expectedPrice: price ? Number(price) : undefined })
      setName('')
      setPrice('')
      setOpen(false)
      await loadWishlist()
    } finally {
      setAdding(false)
    }
  }

  const entries = wishlist

  return (
    <section>
      <SectionTitle
        title="愿望清单"
        right={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 rounded-full bg-stone-900 px-3 py-1.5 text-[11px] font-bold text-white dark:bg-stone-100 dark:text-stone-900"
          >
            <Plus className="h-3 w-3" /> 想买的
          </button>
        }
      />
      {entries.length === 0 ? (
        <EmptyHint lines={['想买但还没买的，先记下来。', '买之前它会提醒你：白衬衫你已经有三件了。']} />
      ) : (
        <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 shadow-sm"
            >
              <Heart className="h-4 w-4 shrink-0 text-orange-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{e.name}</p>
                {e.expectedPrice ? (
                  <p className="text-[11px] text-muted-foreground/70">预期 ¥{e.expectedPrice}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="删除愿望"
                onClick={async () => {
                  await api.deleteWishlist(e.id)
                  await loadWishlist()
                }}
                className="text-muted-foreground/60 transition-colors hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">记一个想买的</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="比如：百搭风衣"
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-orange-400 focus:outline-none dark:focus:border-orange-500/60"
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="预算（可选）"
              inputMode="decimal"
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-orange-400 focus:outline-none dark:focus:border-orange-500/60"
            />
            <button
              type="button"
              disabled={!name.trim() || adding}
              onClick={() => void add()}
              className="h-10 w-full rounded-xl bg-stone-900 text-sm font-bold text-white disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900"
            >
              记下来
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
