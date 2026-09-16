// 日期详情：查看 / 删除 / 手动记录当天穿搭

'use client'

import { useMemo, useState } from 'react'
import { Loader2, Sparkles, Trash2 } from 'lucide-react'
import { api } from './api'
import { COPY, OCCASIONS, categoryIcon, categoryLabel, occasionLabel } from './constants'
import { todayStr, type OccasionKey } from './types'
import { useWW } from './store'
import { Chip, EmptyHint } from './ui-bits'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export function DaySheet({ date }: { date: string }) {
  const { outfits, items, closeSheet, loadOutfits, loadStats, loadItems, openSheet } = useWW()
  const dayRecords = useMemo(() => outfits.filter((o) => o.date === date), [outfits, date])
  const [mode, setMode] = useState<'view' | 'pick'>(dayRecords.length > 0 ? 'view' : 'pick')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [occ, setOcc] = useState<OccasionKey>('casual')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const activeItems = useMemo(
    () =>
      items
        .filter((i) => i.storageStatus === 'wearing' || i.storageStatus === 'laundry')
        .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category)),
    [items],
  )

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const save = async () => {
    if (picked.size === 0) return
    setSaving(true)
    try {
      await api.createOutfit({ date, occasion: occ, itemIds: [...picked], source: 'manual' })
      await Promise.all([loadOutfits(), loadStats(), loadItems()])
      toast({ title: '已记录', description: '又记住一天。' })
      setPicked(new Set())
      setMode('view')
    } catch (e) {
      toast({ title: '记录失败', description: e instanceof Error ? e.message : '' })
    } finally {
      setSaving(false)
    }
  }

  const removeRecord = async (id: string) => {
    try {
      await api.deleteOutfit(id)
      await Promise.all([loadOutfits(), loadStats(), loadItems()])
      toast({ description: '记录已删除' })
    } catch (e) {
      toast({ title: '删除失败', description: e instanceof Error ? e.message : '' })
    }
  }

  const isToday = date === todayStr()
  const { year, month, day, week } = parseDate(date)

  return (
    <Drawer open onOpenChange={(v) => !v && closeSheet()}>
      <DrawerContent className="max-h-[92vh]">
        <div className="mx-auto w-full max-w-md overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          <DrawerHeader className="px-0 pb-2 pt-1 text-left">
            <DrawerTitle className="text-base font-black">
              {isToday ? '今天' : year !== new Date().getFullYear() ? `${year}年${month}月${day}日` : `${month}月${day}日`}
              <span className="ml-1.5 text-sm font-medium text-stone-400">周{week}</span>
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {dayRecords.length > 0 ? '这天穿了这些。' : '这天还没记录，补上？'}
            </DrawerDescription>
          </DrawerHeader>

          {mode === 'view' ? (
            <div className="space-y-3">
              {dayRecords.map((rec) => (
                <div key={rec.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="rounded-full bg-orange-600/10 px-2.5 py-1 text-[11px] font-bold text-orange-600">
                      {rec.occasion ? occasionLabel(rec.occasion) : '日常'}
                    </span>
                    <button
                      type="button"
                      aria-label="删除该记录"
                      onClick={() => setDeleting(rec.id)}
                      className="text-stone-300 transition-colors hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rec.items.map((it) => (
                      <div key={it.id} className="w-20">
                        <div className="aspect-[3/4] overflow-hidden rounded-lg border border-stone-100 bg-stone-50">
                          {it.imageData ? (
                            <img src={it.imageData} alt={it.name ?? ''} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xl">
                              {categoryIcon(it.category)}
                            </div>
                          )}
                        </div>
                        <p className="mt-1 truncate text-center text-[10px] text-stone-400">{it.name ?? categoryLabel(it.category)}</p>
                      </div>
                    ))}
                  </div>
                  {rec.notes && <p className="mt-2 text-[11px] leading-relaxed text-stone-400">{rec.notes}</p>}
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('pick')}
                  className="h-11 flex-1 rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-600 active:scale-[0.98]"
                >
                  再记一套
                </button>
                {isToday && (
                  <button
                    type="button"
                    onClick={() => openSheet({ type: 'recommend' })}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-900 text-sm font-bold text-white active:scale-[0.98]"
                  >
                    <Sparkles className="h-4 w-4" /> AI 搭配
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[11px] font-bold text-stone-400">场合</p>
                <div className="flex flex-wrap gap-1.5">
                  {OCCASIONS.map((o) => (
                    <Chip key={o.key} active={occ === o.key} onClick={() => setOcc(o.key as OccasionKey)}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-bold text-stone-400">
                  选单品 <span className="font-normal text-stone-300">（已选 {picked.size} 件）</span>
                </p>
                {activeItems.length === 0 ? (
                  <EmptyHint lines={COPY.emptyCloset} />
                ) : (
                  <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50/50 p-2 ww-scroll">
                    {activeItems.map((it) => {
                      const checked = picked.has(it.id)
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => toggle(it.id)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition-colors',
                            checked ? 'border-orange-400 bg-orange-50' : 'border-transparent bg-white hover:border-stone-200',
                          )}
                        >
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-stone-100">
                            {it.imageData ? (
                              <img src={it.imageData} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-base">
                                {categoryIcon(it.category)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-stone-700">{it.name || '未命名'}</p>
                            <p className="text-[10px] text-stone-400">
                              {categoryLabel(it.category)}
                              {it.color ? ` · ${it.color}` : ''}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                              checked ? 'border-orange-600 bg-orange-600 text-white' : 'border-stone-300 text-transparent',
                            )}
                          >
                            ✓
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {dayRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMode('view')}
                    className="h-11 flex-1 rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-500"
                  >
                    返回
                  </button>
                )}
                <button
                  type="button"
                  disabled={picked.size === 0 || saving}
                  onClick={() => void save()}
                  className="flex h-11 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-stone-900 text-sm font-bold text-white disabled:opacity-40"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  记录这身（{picked.size} 件）
                </button>
              </div>
            </div>
          )}
        </div>

        <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
          <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>删除这条记录？</AlertDialogTitle>
              <AlertDialogDescription>衣服的穿着次数也会同步减回去。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>留着</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={(e) => {
                  e.preventDefault()
                  if (deleting) void removeRecord(deleting)
                  setDeleting(null)
                }}
              >
                删掉
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  )
}

function categoryOrder(c: string): number {
  const order = ['top', 'pants', 'skirt', 'outer', 'shoes', 'bag', 'accessory']
  return order.indexOf(c)
}

function parseDate(date: string): { year: number; month: number; day: number; week: string } {
  const [y, m, d] = date.split('-').map(Number)
  const week = ['日', '一', '二', '三', '四', '五', '六'][new Date(y, m - 1, d).getDay()]
  return { year: y, month: m, day: d, week }
}
