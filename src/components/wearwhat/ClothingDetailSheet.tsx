// 衣物详情（底部抽屉）

'use client'

import { useState } from 'react'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { api } from './api'
import { categoryLabel, colorHex, occasionLabel, seasonLabel, statusLabel } from './constants'
import { parseList } from './types'
import { useWW } from './store'
import { Chip, ItemThumb } from './ui-bits'
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

function daysAgo(iso: string | null): string {
  if (!iso) return '从未穿过'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return '今天穿过'
  return `${days} 天前穿过`
}

export function ClothingDetailSheet({ itemId }: { itemId: string }) {
  const { items, closeSheet, openSheet, loadItems, loadStats, loadOutfits } = useWW()
  const item = items.find((i) => i.id === itemId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!item) return null

  const seasons = parseList(item.seasons)
  const occasions = parseList(item.occasions)

  const setStatus = async (status: string) => {
    setBusy(true)
    try {
      await api.updateItem(item.id, { storageStatus: status })
      await loadItems()
      toast({ title: '状态已更新', description: statusLabel(status) })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await api.deleteItem(item.id)
      await Promise.all([loadItems(), loadStats(), loadOutfits()])
      toast({ title: '已删除', description: '再见。' })
      closeSheet()
    } catch (e) {
      toast({ title: '删除失败', description: e instanceof Error ? e.message : '' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer open onOpenChange={(v) => !v && closeSheet()}>
      <DrawerContent className="max-h-[92vh]">
        <div className="mx-auto w-full max-w-md overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          <DrawerHeader className="px-0 pb-2 pt-1 text-left">
            <DrawerTitle className="text-base font-black">{item.name || '未命名衣物'}</DrawerTitle>
            <DrawerDescription className="text-xs">
              穿过 {item.wearCount} 次 · {daysAgo(item.lastWornAt)}
            </DrawerDescription>
          </DrawerHeader>

          <div className="mx-auto aspect-[4/3] w-full max-w-[300px] overflow-hidden rounded-2xl border border-stone-100 bg-stone-50">
            <ItemThumb item={item} rounded="rounded-2xl" />
          </div>

          {/* 标签 */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-stone-900 px-2.5 py-1 text-[11px] font-bold text-white">
              {categoryLabel(item.category)}
            </span>
            {item.color && (
              <span className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] text-stone-600">
                <span className="h-2.5 w-2.5 rounded-full border border-stone-200" style={{ backgroundColor: colorHex(item.color) }} />
                {item.color}
              </span>
            )}
            {seasons.map((s) => (
              <span key={s} className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] text-stone-600">
                {seasonLabel(s)}
              </span>
            ))}
            {occasions.map((o) => (
              <span key={o} className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] text-orange-700">
                {occasionLabel(o)}
              </span>
            ))}
            {item.pattern && (
              <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] text-stone-600">
                {item.pattern === 'solid' ? '纯色' : item.pattern === 'striped' ? '条纹' : item.pattern === 'plaid' ? '格子' : '印花'}
              </span>
            )}
          </div>

          {/* 属性 */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <Attr label="品牌" value={item.brand} />
            <Attr label="尺码" value={item.size} />
            <Attr label="价格" value={item.price != null ? `¥${item.price}` : null} />
            <Attr label="材质" value={item.material} />
            <Attr label="购买日期" value={item.purchaseDate ? item.purchaseDate.slice(0, 10) : null} />
            <Attr label="收纳位置" value={item.storageLocation} />
            <Attr label="状态" value={statusLabel(item.storageStatus)} />
            {item.notes ? <Attr label="备注" value={item.notes} /> : null}
          </div>

          {/* 状态快捷切换 */}
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-bold text-stone-400">快速换状态</p>
            <div className="flex flex-wrap gap-1.5">
              {['wearing', 'laundry', 'stored', 'repair', 'discarded'].map((s) => (
                <Chip key={s} active={item.storageStatus === s} onClick={() => void setStatus(s)} disabled={busy}>
                  {statusLabel(s)}
                </Chip>
              ))}
            </div>
          </div>

          {/* 操作 */}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
              className="flex h-12 w-14 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 transition-all active:scale-95"
              aria-label="删除"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => openSheet({ type: 'form', item })}
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-700 active:scale-[0.98]"
            >
              <Pencil className="h-4 w-4" /> 编辑
            </button>
          </div>
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>删掉这件？</AlertDialogTitle>
              <AlertDialogDescription>删除后无法恢复，相关穿搭记录会保留但缺一件。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>留着</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={(e) => {
                  e.preventDefault()
                  void remove()
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

function Attr({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2">
      <span className="block text-[10px] text-stone-400">{label}</span>
      <span className="mt-0.5 block font-medium text-stone-700">{value}</span>
    </div>
  )
}
