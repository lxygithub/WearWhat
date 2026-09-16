// 删除穿搭记录（同步回退穿着次数）
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const outfit = await db.outfit.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!outfit) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 })
    }

    for (const oi of outfit.items) {
      const item = await db.clothingItem.findUnique({ where: { id: oi.clothingItemId } })
      if (item && item.wearCount > 0) {
        await db.clothingItem.update({
          where: { id: item.id },
          data: { wearCount: { decrement: 1 } },
        })
      }
    }

    await db.outfit.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '删除失败' }, { status: 500 })
  }
}
