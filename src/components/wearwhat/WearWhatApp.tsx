// WearWhat 主框架：Header + 四 Tab + 底部导航 + 弹层调度

'use client'

import { useEffect } from 'react'
import { CalendarDays, Home, Shirt, User } from 'lucide-react'
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
    <div className="min-h-screen bg-stone-200/50">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-xl sm:border-x sm:border-stone-300/60">
        {/* 顶部栏 */}
        <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-background/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.8rem)] backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black leading-tight tracking-tight text-stone-900">
                {COPY.brand}
                <span className="ml-2 align-middle text-[10px] font-medium text-orange-600">
                  {COPY.slogan}
                </span>
              </h1>
              <p className="mt-0.5 text-[11px] text-stone-400">
                {dateText} · {city}
              </p>
            </div>
            <WeatherChip />
          </div>
        </header>

        {/* 内容区 */}
        <main className="flex-1 px-4 pb-32 pt-3">
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

        {/* 底部导航（固定，含安全区） */}
        <nav
          aria-label="主导航"
          className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-stone-200 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
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
                    active ? 'text-orange-600' : 'text-stone-400 hover:text-stone-600',
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

function WeatherChip() {
  const { weather, weatherLoading } = useWW()
  if (weatherLoading && !weather) {
    return <div className="h-10 w-16 animate-pulse rounded-xl bg-stone-200/70" />
  }
  if (!weather) return null
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-right shadow-sm">
      <span className="text-xl leading-none">{weather.icon}</span>
      <div className="leading-none">
        <div className="text-sm font-bold text-stone-800">{Math.round(weather.temp)}°</div>
        <div className="mt-0.5 text-[10px] text-stone-400">{weather.condition}</div>
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
      <p className="text-sm font-medium text-stone-500">{COPY.splash}</p>
      <p className="text-xs text-stone-400">{COPY.sub}</p>
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
