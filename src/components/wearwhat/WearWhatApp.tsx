// WearWhat 主框架：Header + 四 Tab + 底部导航 + 弹层调度

'use client'

import { useEffect } from 'react'
import { CalendarDays, Home, Moon, Shirt, Sun, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { COPY, occasionLabel } from './constants'
import { todayStr, type OutfitRecord } from './types'
import { useWW, type Tab } from './store'
import { HomeTab } from './HomeTab'
import { ClosetTab } from './ClosetTab'
import { CalendarTab } from './CalendarTab'
import { ProfileTab } from './ProfileTab'
import { ClothingFormSheet } from './ClothingFormSheet'
import { ClothingDetailSheet } from './ClothingDetailSheet'
import { RecommendPanel } from './RecommendPanel'
import { DaySheet } from './DaySheet'
import { AskSheet } from './AskSheet'
import { useMounted } from './ui-bits'

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'home', label: '首页', icon: Home },
  { key: 'closet', label: '衣橱', icon: Shirt },
  { key: 'calendar', label: '日历', icon: CalendarDays },
  { key: 'profile', label: '我的', icon: User },
]

export function WearWhatApp() {
  const { tab, setTab, init, ready, weather, city, sheet } = useWW()

  useEffect(() => {
    void init()
  }, [])

  const dateText = formatDateCN(new Date())

  return (
    <div className="min-h-screen bg-stone-200/50 dark:bg-black/40">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-xl sm:border-x sm:border-border/60 md:max-w-none md:flex-row md:border-x-0 md:bg-transparent md:shadow-none">
        {/* 侧边栏（md+ 固定左侧，移动端隐藏） */}
        <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:border-r md:border-border/60 md:bg-background md:px-4 md:py-6 lg:w-60">
          {/* 品牌区 */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-xl shadow-md shadow-orange-600/20">
              👕
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-tight text-foreground">{COPY.brand}</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">{COPY.slogan}</p>
            </div>
          </div>

          {/* 桌面导航 */}
          <nav aria-label="桌面导航" className="mt-8 flex flex-col gap-1">
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setTab(key)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors',
                    active
                      ? 'bg-orange-100/50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-500'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-[18px] w-[18px]', active && 'stroke-[2.5]')} />
                  <span>{label}</span>
                </button>
              )
            })}
          </nav>

          {/* 侧边栏底部：日期 + 城市 */}
          <div className="mt-auto px-2 text-[10px] leading-relaxed text-muted-foreground/70">
            <p className="font-medium text-muted-foreground">{dateText}</p>
            <p className="mt-0.5">{city}</p>
          </div>
        </aside>

        {/* 内容列（移动端整列，md+ 居中限宽） */}
        <div className="flex min-w-0 flex-1 flex-col md:mx-auto md:max-w-4xl lg:max-w-5xl xl:max-w-6xl">
          {/* 顶部栏 */}
          <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.8rem)] backdrop-blur md:px-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-black leading-tight tracking-tight text-foreground">
                  {COPY.brand}
                  <span className="ml-2 align-middle text-[10px] font-medium text-orange-600 dark:text-orange-500">
                    {COPY.slogan}
                  </span>
                </h1>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                  {dateText} · {city}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <WeatherChip />
              </div>
            </div>
          </header>

          {/* 内容区 */}
          <main className="flex-1 px-4 pb-32 pt-3 md:px-8 md:pb-12">
            {!ready ? (
              <SplashScreen />
            ) : (
              <>
                {tab === 'home' && <HomeTab />}
                {tab === 'closet' && <ClosetTab />}
                {tab === 'calendar' && <CalendarTab />}
                {tab === 'profile' && <ProfileTab />}
              </>
            )}
          </main>
        </div>

        {/* 底部导航（移动端固定，含安全区；md+ 隐藏） */}
        <nav
          aria-label="主导航"
          className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          <div className="grid grid-cols-4">
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setTab(key)}
                  className={cn(
                    'flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                    active ? 'text-orange-600 dark:text-orange-500' : 'text-muted-foreground/70 hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* 弹层调度 */}
        {sheet?.type === 'form' && <ClothingFormSheet item={sheet.item} />}
        {sheet?.type === 'detail' && <ClothingDetailSheet itemId={sheet.item.id} />}
        {sheet?.type === 'recommend' && <RecommendPanel initialOccasion={sheet.occasion} />}
        {sheet?.type === 'day' && <DaySheet date={sheet.date} />}
        {sheet?.type === 'ask' && <AskSheet />}
      </div>
    </div>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()

  // SSR/hydration 前渲染同尺寸占位，避免图标不一致
  if (!mounted) {
    return <div className="h-9 w-9 shrink-0" aria-hidden="true" />
  }

  const isDark = resolvedTheme === 'dark'
  return (
    <button
      type="button"
      aria-label="切换夜间模式"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground active:scale-95"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

function WeatherChip() {
  const { weather, weatherLoading } = useWW()
  if (weatherLoading && !weather) {
    return <div className="h-10 w-16 animate-pulse rounded-xl bg-muted/70" />
  }
  if (!weather) return null
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-right shadow-sm">
      <span className="text-xl leading-none">{weather.icon}</span>
      <div className="leading-none">
        <div className="text-sm font-bold text-foreground">{Math.round(weather.temp)}°</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground/70">{weather.condition}</div>
      </div>
    </div>
  )
}

function SplashScreen() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <div className="flex h-16 w-16 animate-bounce items-center justify-center rounded-2xl bg-orange-600 text-3xl shadow-lg shadow-orange-600/20">
        👕
      </div>
      <p className="text-sm font-medium text-muted-foreground">{COPY.splash}</p>
      <p className="text-xs text-muted-foreground/70">{COPY.sub}</p>
    </div>
  )
}

export function formatDateCN(d: Date): string {
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${week}`
}

export function findTodayOutfit(outfits: OutfitRecord[]): OutfitRecord | undefined {
  return outfits.find((o) => o.date === todayStr())
}

export function outfitOccasionText(o: OutfitRecord): string {
  return o.occasion ? occasionLabel(o.occasion) : '日常'
}
