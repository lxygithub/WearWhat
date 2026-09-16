// AI 搭配推荐：天气 → 规则引擎 → LLM 理由增强
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchWeather } from '@/lib/ww-weather'
import { recommendOutfits } from '@/lib/ww-engine'
import { enhanceOutfitReasons } from '@/lib/ww-ai'
import { occasionLabel } from '@/components/wearwhat/constants'
import type { WeatherData } from '@/components/wearwhat/types'

function seasonNow(): string {
  const m = new Date().getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const occasion: string = body?.occasion ?? 'commute'
    const lat = typeof body?.lat === 'number' ? body.lat : 22.32
    const lon = typeof body?.lon === 'number' ? body.lon : 114.17
    const city: string = body?.city ?? '香港'

    // 1. 天气（失败不阻塞推荐）
    let weather: WeatherData | null = null
    try {
      weather = await fetchWeather(lat, lon, city)
    } catch {
      weather = null
    }

    // 2. 当季可用衣物
    const closet = await db.clothingItem.findMany({
      where: { storageStatus: 'wearing' },
      orderBy: [{ createdAt: 'desc' }],
    })

    // 3. 最近 5 天穿着（用于重复惩罚）
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000)
    const recent = await db.outfit.findMany({
      where: { createdAt: { gte: fiveDaysAgo } },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    const recentOutfits = recent.map((o) => ({
      createdAt: o.createdAt,
      items: o.items.map((oi) => oi.clothingItemId),
    }))

    // 4. 规则引擎
    const engineWeather = weather
      ? { temp: weather.temp, precipProb: weather.precipProb, condition: weather.condition }
      : { temp: 20, precipProb: 0, condition: '未知' }

    const season = seasonNow()
    const result = recommendOutfits(closet, engineWeather, season, occasion, recentOutfits)

    if (result.outfits.length === 0) {
      return NextResponse.json({
        outfits: [],
        weather,
        season,
        message: result.message,
      })
    }

    // 5. LLM 理由增强（失败静默降级为模板文案）
    const enhanced = await enhanceOutfitReasons({
      occasion: occasionLabel(occasion) || occasion,
      weather: weather
        ? { temp: weather.temp, condition: weather.condition, precipProb: weather.precipProb }
        : null,
      outfits: result.outfits.map((o) => ({
        key: o.key,
        itemNames: o.items.map(
          (i) => `${i.color ?? ''}${i.name ?? ''}` || '单品',
        ),
      })),
    })

    const outfits = result.outfits.map((o) => {
      const e = enhanced?.[o.key]
      return {
        ...o,
        reason: e?.reason ?? o.reason,
        styleTags: e?.styleTags?.length ? e.styleTags : o.styleTags,
      }
    })

    return NextResponse.json({
      outfits,
      candidates: result.candidates,
      weather,
      season,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '推荐失败' }, { status: 500 })
  }
}
