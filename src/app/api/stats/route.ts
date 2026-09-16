// 衣橱统计（按登录用户）
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized } from '@/lib/auth'

function dateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const items = await db.clothingItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    const active = items.filter((i) => i.storageStatus !== 'discarded')

    const since = new Date(Date.now() - 30 * 86400000)
    const sinceStr = dateStr(since)
    const recentOutfits = await db.outfit.findMany({
      where: { userId: user.id, date: { gte: sinceStr } },
      include: { items: true },
    })

    // 近 30 天穿过的单品
    const wornIds = new Set(recentOutfits.flatMap((o) => o.items.map((oi) => oi.clothingItemId)))
    const wornIn30d = active.filter((i) => wornIds.has(i.id)).length
    const utilization = active.length > 0 ? Math.round((wornIn30d / active.length) * 100) : 0

    const totalValue = active.reduce((sum, i) => sum + (i.price ?? 0), 0)

    const topWorn = items
      .filter((i) => i.wearCount > 0)
      .sort((a, b) => b.wearCount - a.wearCount)
      .slice(0, 3)

    const mostIdle = active
      .slice()
      .sort((a, b) => {
        const ta = a.lastWornAt ? new Date(a.lastWornAt).getTime() : 0
        const tb = b.lastWornAt ? new Date(b.lastWornAt).getTime() : 0
        return ta - tb // 从未穿过的（0）排最前
      })
      .slice(0, 3)

    const colorCount = new Map<string, number>()
    for (const i of active) {
      if (i.color) colorCount.set(i.color, (colorCount.get(i.color) ?? 0) + 1)
    }
    const colorDist = [...colorCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    const catCount = new Map<string, number>()
    for (const i of active) catCount.set(i.category, (catCount.get(i.category) ?? 0) + 1)
    const categoryDist = [...catCount.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)

    const wearLast30: { date: string; count: number }[] = []
    const byDate = new Map<string, number>()
    for (const o of recentOutfits) byDate.set(o.date, (byDate.get(o.date) ?? 0) + 1)
    for (let d = 29; d >= 0; d--) {
      const ds = dateStr(new Date(Date.now() - d * 86400000))
      wearLast30.push({ date: ds, count: byDate.get(ds) ?? 0 })
    }

    return NextResponse.json({
      stats: {
        totalItems: items.length,
        activeItems: active.filter((i) => i.storageStatus === 'wearing').length,
        totalValue,
        wornIn30d,
        utilization,
        topWorn,
        mostIdle,
        colorDist,
        categoryDist: categoryDist.map((c) => ({ ...c, category: c.category })),
        wearLast30,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '统计失败' }, { status: 500 })
  }
}
