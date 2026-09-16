// WearWhat 通用小组件

'use client'

import { cn } from '@/lib/utils'
import { categoryIcon } from './constants'
import type { ClothingItem } from './types'

/** 可选中的圆角小芯片 */
export function Chip({
  active,
  onClick,
  children,
  className,
  disabled,
}: {
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-all select-none touch-manipulation',
        active
          ? 'border-orange-600 bg-orange-600 text-white shadow-sm'
          : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 active:scale-95',
        disabled && 'opacity-50',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between px-1">
      <h2 className="text-[15px] font-bold tracking-wide text-stone-800">{title}</h2>
      {right}
    </div>
  )
}

/** 衣物缩略图：有图显示图，无图显示类别 emoji */
export function ItemThumb({
  item,
  className,
  rounded = 'rounded-lg',
}: {
  item: Pick<ClothingItem, 'imageData' | 'category' | 'name'>
  className?: string
  rounded?: string
}) {
  if (item.imageData) {
    return (
      <img
        src={item.imageData}
        alt={item.name || '衣物'}
        className={cn('h-full w-full object-cover', rounded, className)}
        loading="lazy"
      />
    )
  }
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center bg-stone-100 text-2xl',
        rounded,
        className,
      )}
    >
      <span>{categoryIcon(item.category)}</span>
    </div>
  )
}

export function EmptyHint({ lines, children }: { lines: string[]; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center">
      <span className="text-3xl">🧺</span>
      {lines.map((l) => (
        <p key={l} className="text-sm text-stone-500">
          {l}
        </p>
      ))}
      {children}
    </div>
  )
}

export function WWSkeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-stone-200/70', className)} />
}
