// 穿搭记录：按月查询 / 新建（同步累计穿着次数，按登录用户隔离）
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // YYYY-MM
    const where = month
      ? { userId: user.id, date: { gte: `${month}-01`, lte: `${month}-31` } }
      : { userId: user.id }

    const outfits = await db.outfit.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        items: {
          include: { clothing: true },
        },
      },
    })

    const mapped = outfits.map((o) => ({
      ...o,
      items: o.items.map((oi) => oi.clothing),
    }))
    return NextResponse.json({ outfits: mapped })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '查询失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const body = await req.json()
    const { date, occasion, itemIds, notes, source, weather } = body ?? {}
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '日期格式应为 YYYY-MM-DD' }, { status: 400 })
    }
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: '至少选一件单品' }, { status: 400 })
    }

    const exists = await db.clothingItem.findMany({
      where: { id: { in: itemIds }, userId: user.id },
      select: { id: true },
    })
    if (exists.length === 0) {
      return NextResponse.json({ error: '所选衣物不存在' }, { status: 400 })
    }

    const outfit = await db.outfit.create({
      data: {
        userId: user.id,
        date,
        occasion: occasion ?? null,
        notes: notes ?? null,
        source: source ?? 'manual',
        weather: weather ? JSON.stringify(weather) : null,
        items: {
          create: exists.map((i) => ({ clothingItemId: i.id })),
        },
      },
      include: { items: { include: { clothing: true } } },
    })

    // 更新穿着统计
    await db.clothingItem.updateMany({
      where: { id: { in: exists.map((i) => i.id) } },
      data: { wearCount: { increment: 1 }, lastWornAt: new Date() },
    })

    const mapped = {
      ...outfit,
      items: outfit.items.map((oi) => oi.clothing),
    }
    return NextResponse.json({ outfit: mapped }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '记录失败' }, { status: 500 })
  }
}
