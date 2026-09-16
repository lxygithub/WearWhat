// 添加 / 编辑衣物表单（底部抽屉，含拍照 + AI 识别）

'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { api, compressImage, type RecognizeResult } from './api'
import { CATEGORIES, COLORS, OCCASIONS, PATTERNS, SEASONS, STORAGE_STATUS } from './constants'
import { parseList, type ClothingItem } from './types'
import { useWW } from './store'
import { Chip } from './ui-bits'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface FormState {
  name: string
  category: string
  color: string
  pattern: string
  material: string
  seasons: string[]
  occasions: string[]
  brand: string
  size: string
  price: string
  purchaseDate: string
  storageStatus: string
  storageLocation: string
  notes: string
}

const emptyForm: FormState = {
  name: '',
  category: '',
  color: '',
  pattern: 'solid',
  material: '',
  seasons: [],
  occasions: [],
  brand: '',
  size: '',
  price: '',
  purchaseDate: '',
  storageStatus: 'wearing',
  storageLocation: '',
  notes: '',
}

export function ClothingFormSheet({ item }: { item: ClothingItem | null }) {
  const { closeSheet, loadItems, loadStats } = useWW()
  const isEdit = !!item

  const [form, setForm] = useState<FormState>(emptyForm)
  const [imageData, setImageData] = useState<string | null>(null)
  const [recognizing, setRecognizing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name ?? '',
        category: item.category,
        color: item.color ?? '',
        pattern: item.pattern ?? '',
        material: item.material ?? '',
        seasons: parseList(item.seasons),
        occasions: parseList(item.occasions),
        brand: item.brand ?? '',
        size: item.size ?? '',
        price: item.price != null ? String(item.price) : '',
        purchaseDate: item.purchaseDate ? item.purchaseDate.slice(0, 10) : '',
        storageStatus: item.storageStatus,
        storageLocation: item.storageLocation ?? '',
        notes: item.notes ?? '',
      })
      setImageData(item.imageData)
    } else {
      const pending = sessionStorage.getItem('ww.pendingImage')
      if (pending) {
        setImageData(pending)
        sessionStorage.removeItem('ww.pendingImage')
      }
    }
    return () => sessionStorage.removeItem('ww.pendingImage')
  }, [item])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const toggleIn = (key: 'seasons' | 'occasions', v: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v],
    }))

  const pickImage = async (file: File) => {
    try {
      const dataUrl = await compressImage(file)
      setImageData(dataUrl)
    } catch {
      toast({ title: '图片读取失败', description: '换一张试试' })
    }
    if (cameraRef.current) cameraRef.current.value = ''
    if (albumRef.current) albumRef.current.value = ''
  }

  const recognize = async () => {
    if (!imageData) return
    setRecognizing(true)
    try {
      const { result } = await api.recognize(imageData)
      applyRecognize(result)
      toast({ title: '识别完成', description: '看看对不对，不对就手动改改。' })
    } catch (e) {
      toast({ title: '识别失败', description: e instanceof Error ? e.message : '稍后再试' })
    } finally {
      setRecognizing(false)
    }
  }

  const applyRecognize = (r: RecognizeResult) => {
    setForm((f) => ({
      ...f,
      name: f.name || r.name || f.name,
      category: r.category && CATEGORIES.some((c) => c.key === r.category) ? r.category : f.category,
      color: r.color || f.color,
      pattern: r.pattern && PATTERNS.some((p) => p.key === r.pattern) ? r.pattern : f.pattern,
      material: r.material || f.material,
      seasons: r.seasons?.length ? r.seasons.filter((s) => SEASONS.some((x) => x.key === s)) : f.seasons,
      occasions: r.occasions?.length
        ? r.occasions.filter((o) => OCCASIONS.some((x) => x.key === o))
        : f.occasions,
    }))
  }

  const save = async () => {
    if (!form.category) {
      toast({ title: '选个类别', description: '它得知道这是什么。' })
      return
    }
    // 图片在 compressImage() 里已压到长边 720px / JPEG 0.72，实测最坏也就 200KB 上下，
    // 所以这里只是防呆兜底（正常永远碰不到），阈值放宽到 20MB
    if (imageData && imageData.length > 20 * 1024 * 1024) {
      toast({ title: '图片有点大', description: '超过 20MB 了，重新拍一张试试。' })
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim() || null,
        category: form.category,
        color: form.color || null,
        pattern: form.pattern || null,
        material: form.material.trim() || null,
        seasons: JSON.stringify(form.seasons),
        occasions: JSON.stringify(form.occasions),
        brand: form.brand.trim() || null,
        size: form.size.trim() || null,
        price: form.price ? Number(form.price) : null,
        purchaseDate: form.purchaseDate || null,
        storageStatus: form.storageStatus,
        storageLocation: form.storageLocation.trim() || null,
        notes: form.notes.trim() || null,
        imageData,
      }
      if (isEdit && item) {
        await api.updateItem(item.id, body)
        toast({ title: '已更新', description: '它记住了。' })
      } else {
        await api.createItem(body)
        toast({ title: '已入柜', description: '拍一张，它记住。' })
      }
      await Promise.all([loadItems(), loadStats()])
      closeSheet()
    } catch (e) {
      toast({ title: '保存失败', description: e instanceof Error ? e.message : '稍后再试' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open onOpenChange={(v) => !v && closeSheet()}>
      <DrawerContent className="max-h-[92vh]">
        <div className="mx-auto w-full max-w-md overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          <DrawerHeader className="px-0 pb-2 pt-1 text-left">
            <DrawerTitle className="text-base font-black">
              {isEdit ? '编辑衣物' : '添加衣物'}
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {isEdit ? '改完它就记住了。' : '拍一张，其他交给 AI。'}
            </DrawerDescription>
          </DrawerHeader>

          {/* 图片 + AI 识别 */}
          <div className="mb-4">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-muted">
              {imageData ? (
                <img src={imageData} alt="衣物照片" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-stone-300">
                  <Camera className="h-8 w-8" />
                  <span className="text-xs">拍一张，它记住</span>
                </div>
              )}
              {recognizing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-900/50 text-white">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs font-medium">AI 正在看图……</span>
                </div>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-xs font-bold text-muted-foreground active:scale-[0.98]"
              >
                <Camera className="h-3.5 w-3.5" /> 拍照
              </button>
              <button
                type="button"
                onClick={() => albumRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-xs font-bold text-muted-foreground active:scale-[0.98]"
              >
                <ImagePlus className="h-3.5 w-3.5" /> 相册
              </button>
              <button
                type="button"
                disabled={!imageData || recognizing}
                onClick={() => void recognize()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-40"
              >
                {recognizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                AI 识别
              </button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && void pickImage(e.target.files[0])}
            />
            <input
              ref={albumRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && void pickImage(e.target.files[0])}
            />
          </div>

          {/* 表单 */}
          <div className="space-y-4">
            <Field label="名称">
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="白色衬衫（可留空）"
                className="h-10 w-full rounded-xl border border-border px-3 text-sm focus:border-orange-400 focus:outline-none dark:focus:border-orange-500/60"
              />
            </Field>

            <Field label="类别 *">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <Chip key={c.key} active={form.category === c.key} onClick={() => set('category', c.key)}>
                    {c.icon} {c.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="主色">
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <Chip key={c.name} active={form.color === c.name} onClick={() => set('color', form.color === c.name ? '' : c.name)}>
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-border/60"
                      style={{ backgroundColor: c.hex }}
                    />
                    {c.name}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="图案">
              <div className="flex flex-wrap gap-1.5">
                {PATTERNS.map((p) => (
                  <Chip key={p.key} active={form.pattern === p.key} onClick={() => set('pattern', form.pattern === p.key ? '' : p.key)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="季节">
              <div className="flex flex-wrap gap-1.5">
                {SEASONS.map((s) => (
                  <Chip key={s.key} active={form.seasons.includes(s.key)} onClick={() => toggleIn('seasons', s.key)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="适合场合">
              <div className="flex flex-wrap gap-1.5">
                {OCCASIONS.map((o) => (
                  <Chip key={o.key} active={form.occasions.includes(o.key)} onClick={() => toggleIn('occasions', o.key)}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="收纳状态">
              <div className="flex flex-wrap gap-1.5">
                {STORAGE_STATUS.map((s) => (
                  <Chip key={s.key} active={form.storageStatus === s.key} onClick={() => set('storageStatus', s.key)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl bg-muted px-3 py-2.5 text-xs font-medium text-muted-foreground">
                更多信息（品牌 / 尺码 / 价格 …）
                <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="品牌">
                    <input value={form.brand} onChange={(e) => set('brand', e.target.value)} className="h-10 w-full rounded-xl border border-border px-3 text-sm focus:border-orange-400 focus:outline-none dark:focus:border-orange-500/60" />
                  </Field>
                  <Field label="尺码">
                    <input value={form.size} onChange={(e) => set('size', e.target.value)} className="h-10 w-full rounded-xl border border-border px-3 text-sm focus:border-orange-400 focus:outline-none dark:focus:border-orange-500/60" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="价格 (¥)">
                    <input value={form.price} onChange={(e) => set('price', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="h-10 w-full rounded-xl border border-border px-3 text-sm focus:border-orange-400 focus:outline-none dark:focus:border-orange-500/60" />
                  </Field>
                  <Field label="购买日期">
                    <input type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} className="h-10 w-full rounded-xl border border-border px-3 text-sm focus:border-orange-400 focus:outline-none dark:focus:border-orange-500/60" />
                  </Field>
                </div>
                <Field label="材质">
                  <input value={form.material} onChange={(e) => set('material', e.target.value)} placeholder="棉 / 羊毛 / 羽绒 …" className="h-10 w-full rounded-xl border border-border px-3 text-sm focus:border-orange-400 focus:outline-none dark:focus:border-orange-500/60" />
                </Field>
                <Field label="收纳位置">
                  <input value={form.storageLocation} onChange={(e) => set('storageLocation', e.target.value)} placeholder="比如：卧室衣柜第二层" className="h-10 w-full rounded-xl border border-border px-3 text-sm focus:border-orange-400 focus:outline-none dark:focus:border-orange-500/60" />
                </Field>
                <Field label="备注">
                  <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="w-full resize-none rounded-xl border border-border p-3 text-sm focus:border-orange-400 focus:outline-none dark:focus:border-orange-500/60" />
                </Field>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeSheet}
                className="h-12 flex-1 rounded-xl border border-border bg-card text-sm font-bold text-muted-foreground"
              >
                取消
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="flex h-12 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-stone-900 text-sm font-bold text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isEdit ? '保存修改' : '入柜'}
              </button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold text-muted-foreground/70">{label}</label>
      {children}
    </div>
  )
}
