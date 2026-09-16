// 自然语言搜索：LLM 解析 + 兜底关键词
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseSearchQuery } from '@/lib/ww-ai'
import { CATEGORIES } from '@/components/wearwhat/constants'
import { getSessionUser, unauthorized } from '@/lib/auth'
import { aiConfigFromRequest } from '@/lib/ai-config'

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    if (!q) {
      return NextResponse.json({ items: [], hint: '' })
    }

    // 1. 先让 LLM 理解这句话（失败则走兜底）
    const parsed = await parseSearchQuery(
      q,
      CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
      aiConfigFromRequest(req),
    )

    let items: Awaited<ReturnType<typeof db.clothingItem.findMany>> = []
    let hint = parsed?.hint ?? ''

    if (parsed && (parsed.category || parsed.color || parsed.keywords.length)) {
      const AND: Record<string, unknown>[] = []
      if (parsed.category) AND.push({ category: parsed.category })
      if (parsed.color) AND.push({ color: { contains: parsed.color } })
      for (const kw of parsed.keywords) {
        AND.push({
          OR: [
            { name: { contains: kw } },
            { color: { contains: kw } },
            { brand: { contains: kw } },
            { material: { contains: kw } },
            { pattern: { contains: kw } },
            { notes: { contains: kw } },
          ],
        })
      }
      if (AND.length > 0) {
        items = await db.clothingItem.findMany({
          where: { userId: user.id, AND },
          orderBy: { wearCount: 'desc' },
        })
      }
    }

    // 2. 宽松 OR 匹配：颜色 / 关键词 / 类别任一命中即可
    if (items.length === 0 && parsed) {
      const OR: Record<string, unknown>[] = []
      if (parsed.category) OR.push({ category: parsed.category })
      if (parsed.color) OR.push({ color: { contains: parsed.color } })
      for (const kw of parsed.keywords) {
        OR.push(
          { name: { contains: kw } },
          { color: { contains: kw } },
          { brand: { contains: kw } },
          { material: { contains: kw } },
          { notes: { contains: kw } },
        )
      }
      if (OR.length > 0) {
        items = await db.clothingItem.findMany({
          where: { userId: user.id, OR },
          orderBy: { wearCount: 'desc' },
        })
        if (items.length > 0 && parsed.color) hint = `没有完全一样的，先给你看「${parsed.color}」相关的`
      }
    }

    // 3. 兜底：全文包含
    if (items.length === 0) {
      items = await db.clothingItem.findMany({
        where: {
          userId: user.id,
          OR: [
            { name: { contains: q } },
            { color: { contains: q } },
            { brand: { contains: q } },
            { material: { contains: q } },
            { notes: { contains: q } },
          ],
        },
        orderBy: { wearCount: 'desc' },
      })
      if (!hint) hint = `按关键词「${q}」直接匹配`
    }

    // 4. 类别中文兜底：如搜“衬衫”→ top
    if (items.length === 0) {
      const catGuess = CATEGORIES.find((c) => q.includes(c.label))
      if (catGuess) {
        items = await db.clothingItem.findMany({ where: { userId: user.id, category: catGuess.key } })
        if (!hint) hint = `按类别「${catGuess.label}」查找`
      }
    }

    return NextResponse.json({ items: items.slice(0, 60), hint: hint || '帮你找。' })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '搜索失败' }, { status: 500 })
  }
}
