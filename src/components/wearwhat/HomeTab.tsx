// 首页：天气 + 今日推荐入口 + 快速记录 + 衣橱速览

'use client'

import { useMemo } from 'react'
import { ChevronRight, MessageCircleQuestion, RefreshCcw, Sparkles, Wand2 } from 'lucide-react'
import { COPY, OCCASIONS, SEASONS, occasionLabel } from './constants'
import { parseList, todayStr, type OccasionKey } from './types'
import { useWW } from './store'
import { EmptyHint, ItemThumb, SectionTitle, WWSkeleton } from './ui-bits'
import { cn } from '@/lib/utils'

export function HomeTab() {
  const { items, outfits, stats, weather, season, openSheet, loadWeather } = useWW()

  const today = todayStr()
  const todayOutfit = useMemo(() => outfits.find((o) => o.date === today), [outfits, today])

  const activeCount = items.filter((i) => i.storageStatus === 'wearing').length

  return (
    <div className="space-y-5 md:grid md:grid-cols-2 md:gap-5 md:space-y-0">
      {/* 天气卡（桌面端通栏） */}
      <div className="md:col-span-2">
        <WeatherHero />
      </div>

      {/* 衣橱问答入口（桌面端与“今日已穿”同排；无当日记录时通栏） */}
      <button
        type="button"
        onClick={() => openSheet({ type: 'ask' })}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-orange-300 active:scale-[0.99] dark:hover:border-orange-500/40',
          !todayOutfit && 'md:col-span-2',
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600/10 dark:bg-orange-500/10">
          <MessageCircleQuestion className="h-5 w-5 text-orange-600 dark:text-orange-500" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">问一问衣橱</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground/70">
            我有几件白衬衫？哪件最久没穿？
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
      </button>

      {/* 今日记录状态 / 快速记录 */}
      {todayOutfit ? (
        <section>
          <SectionTitle
            title="今天穿了这套"
            right={
              <button
                type="button"
                className="flex items-center gap-0.5 text-xs text-muted-foreground/70 transition-colors hover:text-orange-600 dark:hover:text-orange-500"
                onClick={() => openSheet({ type: 'day', date: today })}
              >
                查看 <ChevronRight className="h-3.5 w-3.5" />
              </button>
            }
          />
          <TodayOutfitCard occasion={todayOutfit.occasion} itemIds={todayOutfit.items.map((i) => i.id)} items={todayOutfit.items} />
        </section>
      ) : null}

      {/* 今日推荐（桌面端通栏突出） */}
      <section className="md:col-span-2">
        <SectionTitle title="今日推荐" />
        <div className="rounded-2xl border border-orange-200/70 bg-gradient-to-br from-orange-50 via-white to-amber-50/60 p-4 shadow-sm md:p-5 dark:border-orange-500/20 dark:from-orange-500/10 dark:via-card dark:to-amber-500/10">
          <div className="flex flex-col md:flex-row md:items-center md:gap-6">
            <div className="flex flex-wrap gap-1.5 md:flex-1">
              {OCCASIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => openSheet({ type: 'recommend', occasion: o.key as OccasionKey })}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-orange-300 hover:text-orange-600 active:scale-95 dark:hover:border-orange-500/40 dark:hover:text-orange-500"
                >
                  {o.icon} {o.label}
                </button>
              ))}
            </div>
            <div className="mt-3 md:mt-0 md:w-64 md:shrink-0">
              <button
                type="button"
                onClick={() => openSheet({ type: 'recommend' })}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-stone-800 active:scale-[0.98] dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                <Sparkles className="h-4 w-4" />
                {todayOutfit ? '再换一批搭配' : '生成今日搭配'}
              </button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
                {todayOutfit ? COPY.resultCta[1] : '按天气和场合，推荐 3 套可穿的'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 换季提示（桌面端通栏） */}
      <div className="md:col-span-2">
        <SeasonBanner season={season} />
      </div>

      {/* 衣橱速览（桌面端通栏） */}
      <section className="md:col-span-2">
        <SectionTitle
          title="衣橱速览"
          right={
            <button
              type="button"
              className="flex items-center gap-0.5 text-xs text-muted-foreground/70 transition-colors hover:text-orange-600 dark:hover:text-orange-500"
              onClick={() => useWW.getState().setTab('closet')}
            >
              去看看 <ChevronRight className="h-3.5 w-3.5" />
            </button>
          }
        />
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="全部衣物" value={String(items.length)} sub={`${activeCount} 件在穿`} />
          <MiniStat label="本月利用率" value={stats ? `${stats.utilization}%` : '—'} sub="近 30 天穿过" />
          <MiniStat label="总价值" value={stats && stats.totalValue > 0 ? `¥${formatNum(stats.totalValue)}` : '—'} sub="录入衣物合计" />
        </div>
      </section>

      {items.length === 0 ? (
        <div className="md:col-span-2">
          <EmptyHint lines={COPY.emptyCloset} />
        </div>
      ) : null}
    </div>
  )
}

function WeatherHero() {
  const { weather, weatherLoading, loadWeather, season } = useWW()
  const seasonMeta = SEASONS.find((s) => s.key === season)

  let line2 = ''
  if (weather) {
    if (weather.temp < 5) line2 = COPY.cold(weather.temp)[1]
    else if (weather.precipProb >= 50) line2 = COPY.rain[1]
    else if (weather.temp >= 28) line2 = '热得很诚实，穿凉快点。'
    else line2 = `体感 ${Math.round(weather.apparent)} 度，出门前看一眼。`
  }

  return (
    <section aria-label="今日天气">
      <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-gradient-to-br from-orange-50 via-stone-50 to-amber-100/50 p-4 shadow-sm dark:border-orange-500/20 dark:from-orange-500/10 dark:via-muted/40 dark:to-amber-500/10">
        {weatherLoading && !weather ? (
          <div className="flex items-center gap-4">
            <WWSkeleton className="h-14 w-14 rounded-2xl" />
            <div className="space-y-2">
              <WWSkeleton className="h-8 w-24" />
              <WWSkeleton className="h-3 w-40" />
            </div>
          </div>
        ) : weather ? (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black leading-none text-foreground">
                  {Math.round(weather.temp)}
                  <span className="text-xl">°C</span>
                </span>
                <span className="pb-0.5 text-sm text-muted-foreground">
                  {weather.tempMin}° / {weather.tempMax}°
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {weather.condition} · 湿度 {weather.humidity}% · 降水概率 {weather.precipProb}%
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-orange-700/80 dark:text-orange-400/80">{line2}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-4xl">{weather.icon}</span>
              <button
                type="button"
                aria-label="刷新天气"
                onClick={() => void loadWeather()}
                className="text-stone-300 transition-colors hover:text-orange-600 dark:hover:text-orange-500"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">天气暂时拿不到，凭感觉穿。</p>
        )}
        <span className="absolute -right-3 -top-3 text-[10px] font-bold uppercase tracking-widest text-stone-300">
          {seasonMeta?.label ?? ''}季
        </span>
      </div>
    </section>
  )
}

function TodayOutfitCard({
  occasion,
  items,
}: {
  occasion: string | null
  itemIds: string[]
  items: { id: string; imageData: string | null; category: string; name: string | null }[]
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-orange-600/10 px-2 py-0.5 text-[11px] font-bold text-orange-600 dark:bg-orange-500/10 dark:text-orange-500">
          {occasion ? occasionLabel(occasion) : '日常'}
        </span>
        <span className="text-[11px] text-muted-foreground/70">{COPY.recorded.split('。')[0]} ✓</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 md:gap-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <div key={it.id} className="h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 md:h-24 md:w-20">
            <ItemThumb item={it} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SeasonBanner({ season }: { season: string }) {
  const tips: Record<string, string> = {
    spring: '换季了。厚毛衣可以先收一收。',
    summer: '短袖的主场。防晒别忘了。',
    autumn: '风衣可以拿出来了。',
    winter: '羽绒服该上场了。',
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 text-[12px] text-muted-foreground">
      <Wand2 className="h-3.5 w-3.5 shrink-0 text-orange-500" />
      <span>{tips[season] ?? ''}</span>
    </div>
  )
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="text-[10px] text-muted-foreground/70">{label}</div>
      <div className={cn('mt-1 text-base font-black text-foreground')}>{value}</div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground/70">{sub}</div>
    </div>
  )
}

function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  return Math.round(n).toLocaleString()
}
