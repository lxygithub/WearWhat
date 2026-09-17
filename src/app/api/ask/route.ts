// 衣橱问答（LLM 实时回答 + 本地统计兜底，需登录）
// 产品文档 §2.6「问答式查询」：我有几件白衬衫？哪件外套最久没穿？
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized } from '@/lib/auth'
import { cooldown, rateLimit } from '@/lib/rate-limit'
import { aiConfigFromRequest } from '@/lib/ai-config'
import { answerWardrobeQuestion, type AskAnswer, type AskCompactItem } from '@/lib/ww-ai'
import { localAnswer } from '@/lib/ww-ask'
import { categoryLabel } from '@/components/wearwhat/constants'
import { parseList } from '@/components/wearwhat/types'

interface AskWeather {
  temp?: number
  condition?: string
  precipProb?: number
  city?: string
}

function currentSeason(): string {
  const m = new Date().getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    // 限流：3 秒冷却 + 每小时 30 次
    if (!cooldown(`ask-cd:${user.id}`, 3_000)) {
      return NextResponse.json({ error: '问得太快了，喘口气。' }, { status: 429 })
    }
    if (!rateLimit(`ask-h:${user.id}`, 30, 3_600_000)) {
      return NextResponse.json({ error: '问太多了，一小时后再来。' }, { status: 429 })
    }

    const body = (await req.json()) as {
      question?: unknown
      weather?: AskWeather
      season?: unknown
      history?: unknown
    }

    const question = typeof body.question === 'string' ? body.question.trim().slice(0, 200) : ''
    if (!question) {
      return NextResponse.json({ error: '问题不能为空' }, { status: 400 })
    }

    const season =
      typeof body.season === 'string' &&
      ['spring', 'summer', 'autumn', 'winter'].includes(body.season)
        ? body.season
        : currentSeason()

    const w = body.weather
    const weatherText =
      w && typeof w.temp === 'number'
        ? `${typeof w.city === 'string' && w.city ? w.city + ' ' : ''}${Math.round(w.temp)}°C，${w.condition ?? ''}${typeof w.precipProb === 'number' ? `，降水概率 ${Math.round(w.precipProb)}%` : ''}`
        : null

    // 最近 6 条对话作为多轮上下文
    const history: { role: 'user' | 'assistant'; content: string }[] = Array.isArray(body.history)
      ? (body.history as unknown[])
          .map((m) => m as { role?: unknown; content?: unknown })
          .filter(
            (m): m is { role: 'user' | 'assistant'; content: string } =>
              (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string',
          )
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 300) }))
      : []

    // 衣物上限 300，防止极端衣橱拖垮 prompt
    const [items, wishlist] = await Promise.all([
      db.clothingItem.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      db.wishlistItem.findMany({
        where: { userId: user.id },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
    ])

    const compact: AskCompactItem[] = items.map((i) => ({
      id: i.id,
      name: i.name || categoryLabel(i.category),
      category: i.category,
      color: i.color,
      pattern: i.pattern,
      material: i.material,
      seasons: parseList(i.seasons),
      occasions: parseList(i.occasions),
      storageStatus: i.storageStatus,
      storageLocation: i.storageLocation,
      wearCount: i.wearCount,
      lastWornAt: i.lastWornAt,
      brand: i.brand,
      price: i.price,
    }))

    const wishlistCompact = wishlist.map((x) => ({
      name: x.name,
      category: x.category,
      expectedPrice: x.expectedPrice,
      priority: x.priority,
    }))

    // 先走 LLM，失败（未配置凭证 / 超时 / 解析失败）降级本地统计
    let answer: AskAnswer
    let source: 'ai' | 'local'
    try {
      answer = await answerWardrobeQuestion(
        {
          question,
          history,
          season,
          weatherText,
          items: compact,
          wishlist: wishlistCompact,
        },
        aiConfigFromRequest(req),
      )
      source = 'ai'
    } catch {
      answer = localAnswer({ question, season, weatherText, items: compact, wishlist: wishlistCompact })
      source = 'local'
    }

    // 引用单品（带图，前端展示缩略卡）
    const idSet = new Set(answer.itemIds)
    const refItems = items
      .filter((i) => idSet.has(i.id))
      .map((i) => ({
        id: i.id,
        name: i.name,
        imageData: i.imageData,
        category: i.category,
        color: i.color,
      }))

    return NextResponse.json({
      answer: answer.answer,
      followUps: answer.followUps,
      source,
      items: refItems,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '问答失败' },
      { status: 500 },
    )
  }
}
