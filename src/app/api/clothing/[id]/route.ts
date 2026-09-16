// 衣物更新 / 删除（仅限本人衣物）
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized } from '@/lib/auth'

async function ownedItem(userId: string, id: string) {
  const item = await db.clothingItem.findUnique({ where: { id } })
  if (!item || item.userId !== userId) return null
  return item
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const { id } = await ctx.params
    const existing = await ownedItem(user.id, id)
    if (!existing) {
      return NextResponse.json({ error: '衣物不存在' }, { status: 404 })
    }

    const body = await req.json()

    const data: Record<string, unknown> = {}
    const strFields = ['name', 'color', 'pattern', 'material', 'brand', 'size', 'storageLocation', 'notes', 'category', 'storageStatus']
    for (const f of strFields) {
      if (f in body) data[f] = body[f] ?? null
    }
    if ('seasons' in body) data.seasons = typeof body.seasons === 'string' ? body.seasons : JSON.stringify(body.seasons ?? [])
    if ('occasions' in body) data.occasions = typeof body.occasions === 'string' ? body.occasions : JSON.stringify(body.occasions ?? [])
    if ('price' in body) data.price = typeof body.price === 'number' ? body.price : null
    if ('purchaseDate' in body) data.purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : null
    if ('imageData' in body) data.imageData = body.imageData ?? null

    const item = await db.clothingItem.update({ where: { id }, data })
    return NextResponse.json({ item })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '更新失败' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const { id } = await ctx.params
    const existing = await ownedItem(user.id, id)
    if (!existing) {
      return NextResponse.json({ error: '衣物不存在' }, { status: 404 })
    }

    await db.clothingItem.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '删除失败' }, { status: 500 })
  }
}
