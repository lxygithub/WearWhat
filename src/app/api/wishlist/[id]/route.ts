// 愿望清单：删除（仅限本人条目）
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized } from '@/lib/auth'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const { id } = await ctx.params
    const entry = await db.wishlistItem.findUnique({ where: { id } })
    if (!entry || entry.userId !== user.id) {
      return NextResponse.json({ error: '条目不存在' }, { status: 404 })
    }

    await db.wishlistItem.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '删除失败' }, { status: 500 })
  }
}
