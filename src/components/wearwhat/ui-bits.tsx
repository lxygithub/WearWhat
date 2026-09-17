// WearWhat 通用小组件

'use client'

import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import { categoryIcon } from './constants'
import type { ClothingItem } from './types'

const emptySubscribe = () => () => {}

/** 客户端挂载标记：SSR/首次渲染返回 false，hydration 后变 true。
 *  等价于旧式 useState+useEffect mounted 守卫（react-hooks/set-state-in-effect 禁止在 effect 内同步 setState，故用官方推荐的 useSyncExternalStore）。 */
export function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

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
          : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/50 active:scale-95',
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
      <h2 className="text-[15px] font-bold tracking-wide text-foreground">{title}</h2>
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
        'flex h-full w-full items-center justify-center bg-muted text-2xl',
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
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/50 px-6 py-10 text-center">
      <span className="text-3xl">🧺</span>
      {lines.map((l) => (
        <p key={l} className="text-sm text-muted-foreground">
          {l}
        </p>
      ))}
      {children}
    </div>
  )
}

export function WWSkeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted/70', className)} />
}
