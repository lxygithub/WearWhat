// AI 搭配推荐面板：3 套推荐 + 单件替换 + 一键记录

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCcw, RotateCcw, Sparkles } from 'lucide-react'
import { api } from './api'
import { CITIES, COPY, OCCASIONS, categoryIcon } from './constants'
import { todayStr, type ClothingItem, type OccasionKey, type RecommendResponse, type RecOutfit, type WeatherData } from './types'
import { useWW } from './store'
import { Chip } from './ui-bits'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Candidates {
  tops: ClothingItem[]
  bottoms: ClothingItem[]
  shoes: ClothingItem[]
  outers: ClothingItem[]
}

const EMPTY_CANDIDATES: Candidates = { tops: [], bottoms: [], shoes: [], outers: [] }

function groupOf(item: ClothingItem): keyof Candidates | null {
  if (item.category === 'top') return 'tops'
  if (item.category === 'pants' || item.category === 'skirt') return 'bottoms'
  if (item.category === 'shoes') return 'shoes'
  if (item.category === 'outer') return 'outers'
  return null
}

export function RecommendPanel({ initialOccasion }: { initialOccasion?: OccasionKey }) {
  const { closeSheet, loadItems, loadOutfits, loadStats, season, city } = useWW()
  const [occasion, setOccasion] = useState<OccasionKey>(initialOccasion ?? 'commute')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RecommendResponse | null>(null)
  const [candidates, setCandidates] = useState<Candidates>(EMPTY_CANDIDATES)
  const [cursor, setCursor] = useState({ tops: 0, bottoms: 0, shoes: 0, outers: 0 })
  const [confirming, setConfirming] = useState(false)
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor

  const generate = useCallback(
    async (occ: OccasionKey) => {
      setLoading(true)
      try {
        const meta = CITIES.find((c) => c.name === city)
        const r = await api.recommend(
          occ,
          meta ? { lat: meta.lat, lon: meta.lon, city: meta.name } : undefined,
        )
        setData(r)
        setCandidates((r as RecommendResponse & { candidates?: Candidates }).candidates ?? EMPTY_CANDIDATES)
        setCursor({ tops: 0, bottoms: 0, shoes: 0, outers: 0 })
      } catch (e) {
        toast({ title: '推荐失败', description: e instanceof Error ? e.message : '稍后再试' })
      } finally {
        setLoading(false)
      }
    },
    [city],
  )

  useEffect(() => {
    void generate(occasion)
  }, [generate, occasion])

  /** 单件替换：从候选池轮转 */
  const swapItem = (outfit: RecOutfit, item: ClothingItem) => {
    const group = groupOf(item)
    if (!group) {
      toast({ description: '这件不在搭配链路里，不用换。' })
      return
    }
    const pool = candidates[group]
    if (pool.length === 0) {
      toast({ description: '没有别的可换了，就它吧。' })
      return
    }
    const idx = cursorRef.current[group] % pool.length
    const next = pool[idx]
    if (next.id === item.id) {
      toast({ description: '没有别的可换了，就它吧。' })
      return
    }
    // 替换该单品，并把旧单品放回候选池末尾
    setCandidates((c) => ({ ...c, [group]: [...c[group].filter((x) => x.id !== next.id), item] }))
    setCursor((c) => ({ ...c, [group]: c[group] + 1 }))
    setData((d) => {
      if (!d) return d
      return {
        ...d,
        outfits: d.outfits.map((o) =>
          o.key === outfit.key
            ? { ...o, items: o.items.map((it) => (it.id === item.id ? next : it)) }
            : o,
        ),
      }
    })
  }

  const confirmWear = async (outfit: RecOutfit) => {
    setConfirming(true)
    try {
      await api.createOutfit({
        date: todayStr(),
        occasion,
        itemIds: outfit.items.map((i) => i.id),
        source: 'recommend',
        notes: outfit.reason,
        weather: data?.weather ?? undefined,
      })
      await Promise.all([loadOutfits(), loadStats(), loadItems()])
      toast({ title: COPY.recorded.split('。')[0] + '。', description: COPY.resultCta[1] })
      closeSheet()
    } catch (e) {
      toast({ title: '记录失败', description: e instanceof Error ? e.message : '' })
    } finally {
      setConfirming(false)
    }
  }

  const weather: WeatherData | null = data?.weather ?? null

  return (
    <Drawer open onOpenChange={(v) => !v && closeSheet()}>
      <DrawerContent className="max-h-[94vh]">
        <div className="mx-auto w-full max-w-md overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          <DrawerHeader className="px-0 pb-1 pt-1 text-left">
            <DrawerTitle className="flex items-center gap-2 text-base font-black">
              <Sparkles className="h-4 w-4 text-orange-600" />
              今日推荐
              {weather && (
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                  {weather.icon} {Math.round(weather.temp)}° {weather.condition}
                </span>
              )}
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {COPY.resultCta[0]}
              {COPY.resultCta[1]}
            </DrawerDescription>
          </DrawerHeader>

          {/* 场合选择 */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {OCCASIONS.map((o) => (
              <Chip
                key={o.key}
                active={occasion === o.key}
                onClick={() => setOccasion(o.key as OccasionKey)}
                disabled={loading}
              >
                {o.icon} {o.label}
              </Chip>
            ))}
          </div>

          {loading ? (
            <LoadingState />
          ) : !data || data.outfits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center">
              <span className="text-3xl">🤷</span>
              <p className="mt-2 text-sm text-stone-500">{data?.message ?? COPY.full[0]}</p>
              <p className="mt-1 text-xs text-stone-400">{COPY.full[1]}</p>
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {data.outfits.map((outfit, i) => (
                <OutfitCard
                  key={outfit.key + i}
                  outfit={outfit}
                  index={i}
                  confirming={confirming}
                  onSwap={(item) => swapItem(outfit, item)}
                  onConfirm={() => void confirmWear(outfit)}
                />
              ))}
              <button
                type="button"
                onClick={() => void generate(occasion)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white py-3 text-sm font-bold text-stone-600 shadow-sm active:scale-[0.98]"
              >
                <RefreshCcw className="h-4 w-4" /> 换一批
              </button>
              <p className="pb-1 text-center text-[11px] text-stone-300">
                当前季节：{season === 'spring' ? '春' : season === 'summer' ? '夏' : season === 'autumn' ? '秋' : '冬'} ·
                单品图上点 ↺ 可以单独替换
              </p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function OutfitCard({
  outfit,
  index,
  confirming,
  onSwap,
  onConfirm,
}: {
  outfit: RecOutfit
  index: number
  confirming: boolean
  onSwap: (item: ClothingItem) => void
  onConfirm: () => void
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-black text-stone-700">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-[10px] font-black text-white">
            {index + 1}
          </span>
          方案 {index + 1}
        </span>
        <span className="rounded-full bg-orange-600/10 px-2 py-0.5 text-[10px] font-bold text-orange-600">
          匹配 {Math.min(99, Math.round(outfit.score))} 分
        </span>
      </div>

      {/* 单品链 */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {outfit.items.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-1">
            {idx > 0 && <span className="text-stone-300">+</span>}
            <div className="group relative shrink-0">
              <div className="h-24 w-[72px] overflow-hidden rounded-lg border border-stone-100 bg-stone-50">
                {item.imageData ? (
                  <img src={item.imageData} alt={item.name ?? ''} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">
                    {categoryIcon(item.category)}
                  </div>
                )}
              </div>
              <button
                type="button"
                aria-label={`替换 ${item.name ?? '单品'}`}
                onClick={() => onSwap(item)}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-white shadow-md transition-transform hover:rotate-[-90deg] active:scale-90"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
              <p className="mt-1 w-[72px] truncate text-center text-[9px] text-stone-400">
                {item.color ?? ''}{item.name || categoryIcon(item.category)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 风格标签 + 理由 */}
      {outfit.styleTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {outfit.styleTags.map((t) => (
            <span key={t} className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">
              {t}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs leading-relaxed text-stone-500">{outfit.reason}</p>

      <button
        type="button"
        disabled={confirming}
        onClick={onConfirm}
        className={cn(
          'mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-stone-900 py-3 text-sm font-bold text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50',
          index === 0 && 'bg-orange-600 hover:bg-orange-700',
        )}
      >
        {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        就穿这套
      </button>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3 pb-2">
      <div className="flex items-center justify-center gap-2 rounded-xl bg-orange-50 py-3 text-xs font-medium text-orange-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {COPY.splash}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex gap-2">
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-24 w-[72px] animate-pulse rounded-lg bg-stone-200/70" />
            ))}
          </div>
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-stone-200/70" />
        </div>
      ))}
    </div>
  )
}
