// 穿搭日历：月视图 + 每日穿搭缩略图

'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { todayStr, type OutfitRecord } from './types'
import { useWW } from './store'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export function CalendarTab() {
  const { outfits, openSheet } = useWW()
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1) // 1-12

  const byDate = useMemo(() => {
    const m = new Map<string, OutfitRecord[]>()
    for (const o of outfits) {
      const arr = m.get(o.date) ?? []
      arr.push(o)
      m.set(o.date, arr)
    }
    return m
  }, [outfits])

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth - 1, 1)
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
    // Monday=0 ... Sunday=6
    let offset = first.getDay() - 1
    if (offset < 0) offset = 6
    const arr: ({ day: number; date: string } | null)[] = []
    for (let i = 0; i < offset; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      arr.push({ day: d, date })
    }
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [viewYear, viewMonth])

  const monthCount = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth).padStart(2, '0')}`
    return outfits.filter((o) => o.date.startsWith(prefix)).length
  }, [outfits, viewYear, viewMonth])

  const prev = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1)
      setViewMonth(12)
    } else setViewMonth(viewMonth - 1)
  }
  const next = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1)
      setViewMonth(1)
    } else setViewMonth(viewMonth + 1)
  }

  const today = todayStr()

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        {/* 月份切换 */}
        <div className="mb-4 flex items-center justify-between">
          <button type="button" aria-label="上个月" onClick={prev} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <div className="text-base font-black text-stone-800">
              {viewYear} 年 {viewMonth} 月
            </div>
            <div className="text-[10px] text-stone-400">记录了 {monthCount} 天穿搭</div>
          </div>
          <button type="button" aria-label="下个月" onClick={next} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* 星期表头 */}
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 text-center text-[10px] font-medium text-stone-400">
              {w}
            </div>
          ))}
        </div>

        {/* 日期网格 */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((cell, idx) => {
            if (!cell) return <div key={`e-${idx}`} className="h-14" />
            const recs = byDate.get(cell.date) ?? []
            const isToday = cell.date === today
            const thumbs = recs.flatMap((r) => r.items.slice(0, 3)).slice(0, 3)
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => openSheet({ type: 'day', date: cell.date })}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors',
                  isToday ? 'bg-orange-50 ring-1 ring-orange-300' : 'hover:bg-stone-50',
                )}
                aria-label={`${cell.day}日${recs.length > 0 ? `，${recs.length} 套穿搭` : ''}`}
              >
                <span
                  className={cn(
                    'text-xs font-semibold',
                    isToday ? 'text-orange-600' : recs.length ? 'text-stone-700' : 'text-stone-400',
                  )}
                >
                  {cell.day}
                </span>
                {thumbs.length > 0 ? (
                  <div className="flex -space-x-1.5">
                    {thumbs.map((it, i) => (
                      <span
                        key={`${cell.date}-${i}`}
                        className="block h-[18px] w-[18px] overflow-hidden rounded-full border border-white bg-stone-100"
                      >
                        {it.imageData ? (
                          <img src={it.imageData} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[8px]">👗</span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="h-[3px] w-[3px] rounded-full bg-stone-200" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-center text-[11px] leading-relaxed text-stone-400">
        点击日期查看 / 记录当天穿搭
        <br />
        记住你穿过什么，才不会天天穿同一件。
      </p>
    </div>
  )
}
