// 愿望清单：删除
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    await db.wishlistItem.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '删除失败' }, { status: 500 })
  }
}
