// 衣橱：搜索 + 分类/季节/状态筛选 + 网格 + 添加按钮

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { api, compressImage } from './api'
import { CATEGORIES, COPY, SEASONS, STORAGE_STATUS, colorHex } from './constants'
import { parseList, type ClothingItem } from './types'
import { useWW } from './store'
import { Chip, EmptyHint, ItemThumb } from './ui-bits'
import { cn } from '@/lib/utils'

export function ClosetTab() {
  const storeItems = useWW((s) => s.items)
  const itemsLoading = useWW((s) => s.itemsLoading)
  const openSheet = useWW((s) => s.openSheet)

  const [cat, setCat] = useState('')
  const [season, setSeason] = useState('')
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [searchMode, setSearchMode] = useState(false)
  const [searchItems, setSearchItems] = useState<ClothingItem[] | null>(null)
  const [hint, setHint] = useState('')
  const [searching, setSearching] = useState(false)
  const [list, setList] = useState<ClothingItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchList = useCallback(async () => {
    setListLoading(true)
    try {
      const { items } = await api.getItems({
        category: cat || undefined,
        season: season || undefined,
        status: status || undefined,
      })
      setList(items)
    } catch {
      setList([])
    } finally {
      setListLoading(false)
    }
  }, [cat, season, status])

  useEffect(() => {
    if (!searchMode) void fetchList()
  }, [fetchList, searchMode])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of storeItems) m.set(it.category, (m.get(it.category) ?? 0) + 1)
    return m
  }, [storeItems])

  const display = searchMode ? (searchItems ?? []) : list
  const loading = searchMode ? searching : listLoading

  const doSearch = async () => {
    const text = q.trim()
    if (!text) return
    setSearching(true)
    try {
      const r = await api.search(text)
      setSearchItems(r.items)
      setHint(r.hint)
      setSearchMode(true)
    } catch {
      setHint('搜索出错了，换个说法试试。')
      setSearchItems([])
      setSearchMode(true)
    } finally {
      setSearching(false)
    }
  }

  const clearSearch = () => {
    setQ('')
    setSearchMode(false)
    setSearchItems(null)
    setHint('')
  }

  /** 快速添加：选图 → AI 识别 → 打开表单 */
  const quickAdd = async (file: File) => {
    try {
      const dataUrl = await compressImage(file)
      openSheet({ type: 'form', item: null })
      // 将图片暂存到 sessionStorage，供表单读取
      sessionStorage.setItem('ww.pendingImage', dataUrl)
    } catch {
      openSheet({ type: 'form', item: null })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="relative space-y-3">
      {/* 搜索 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doSearch()
            }}
            placeholder="那件蓝色条纹衬衫在哪？"
            className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-8 text-sm text-stone-700 placeholder:text-stone-300 focus:border-orange-400 focus:outline-none"
            aria-label="搜索衣物"
          />
          {q && (
            <button
              type="button"
              aria-label="清空搜索"
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 搜索提示 */}
      {searchMode && hint ? (
        <div className="rounded-lg bg-orange-50 px-3 py-2 text-[11px] leading-relaxed text-orange-700">
          🤖 {hint} · 共 {searchItems?.length ?? 0} 件
        </div>
      ) : null}

      {/* 分类筛选（横向滚动） */}
      {!searchMode && (
        <>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip active={cat === ''} onClick={() => setCat('')}>
              全部 {storeItems.length > 0 && <span className="opacity-60">{storeItems.length}</span>}
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>
                {c.icon} {c.label}{' '}
                {(counts.get(c.key) ?? 0) > 0 && <span className="opacity-60">{counts.get(c.key)}</span>}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium text-stone-400">季节</span>
            {SEASONS.map((s) => (
              <Chip key={s.key} active={season === s.key} onClick={() => setSeason(season === s.key ? '' : s.key)} className="px-2.5 py-1">
                {s.label}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium text-stone-400">状态</span>
            {STORAGE_STATUS.map((s) => (
              <Chip key={s.key} active={status === s.key} onClick={() => setStatus(status === s.key ? '' : s.key)} className="px-2.5 py-1">
                {s.label}
              </Chip>
            ))}
          </div>
        </>
      )}

      {/* 衣物网格 */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-stone-200/70" />
          ))}
        </div>
      ) : display.length === 0 ? (
        searchMode ? (
          <EmptyHint lines={['没找到。', '试试换个描述，或者加几件新的。']} />
        ) : cat || season || status ? (
          <EmptyHint lines={['这个筛选下没有衣物。', '换个条件看看。']} />
        ) : (
          <EmptyHint lines={COPY.emptyCloset}>
            <button
              type="button"
              onClick={() => openSheet({ type: 'form', item: null })}
              className="mt-2 rounded-full bg-stone-900 px-5 py-2.5 text-xs font-bold text-white"
            >
              扔第一件进来
            </button>
          </EmptyHint>
        )
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {display.map((item) => (
            <ClothingCard key={item.id} item={item} onClick={() => openSheet({ type: 'detail', item })} />
          ))}
        </div>
      )}

      {/* 悬浮添加按钮 */}
      <button
        type="button"
        aria-label="添加衣物"
        onClick={() => fileRef.current?.click()}
        className="fixed bottom-24 right-[max(1rem,calc(50%-13rem))] z-20 flex h-12 items-center gap-1.5 rounded-full bg-orange-600 px-4 text-sm font-bold text-white shadow-lg shadow-orange-600/30 transition-transform active:scale-95"
      >
        <Plus className="h-4 w-4" />
        拍照添加
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void quickAdd(f)
        }}
      />
    </div>
  )
}

function ClothingCard({ item, onClick }: { item: ClothingItem; onClick: () => void }) {
  const seasons = parseList(item.seasons)
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left transition-transform active:scale-[0.97]"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-stone-100 bg-stone-50 shadow-sm">
        <ItemThumb item={item} rounded="rounded-none" />
        {item.storageStatus !== 'wearing' && (
          <span className="absolute left-1 top-1 rounded-md bg-stone-900/70 px-1.5 py-0.5 text-[9px] font-medium text-white">
            {STORAGE_STATUS.find((s) => s.key === item.storageStatus)?.label}
          </span>
        )}
        {seasons.length > 0 && (
          <span className="absolute bottom-1 right-1 rounded-md bg-white/85 px-1 py-0.5 text-[9px] font-bold text-stone-500">
            {seasons
              .map((s) => SEASONS.find((x) => x.key === s)?.label ?? '')
              .filter(Boolean)
              .join('')}
          </span>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="truncate text-xs font-medium text-stone-700">{item.name || '未命名'}</p>
        <div className="mt-0.5 flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-full border border-stone-200"
            style={{ backgroundColor: colorHex(item.color) }}
          />
          <span className="truncate text-[10px] text-stone-400">
            {item.color ?? '—'}
            {item.wearCount > 0 && <span className="ml-1">· 穿过{item.wearCount}次</span>}
          </span>
        </div>
      </div>
    </button>
  )
}
