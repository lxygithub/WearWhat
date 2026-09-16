// WearWhat 搭配引擎：硬过滤 → 打分 → 组合 → 去重多样性 → Top3 + 候选池
// 参考产品文档附录 E（权重可后续由用户反馈学习）

import { categoryLabel, occasionLabel } from '@/components/wearwhat/constants'
import { parseList, type ClothingItem } from '@/components/wearwhat/types'

export interface EngineWeather {
  temp: number
  precipProb: number
  condition: string
}

const NEUTRAL_COLORS = new Set(['白色', '黑色', '灰色', '米色', '卡其', '棕色', '驼色', '牛仔蓝', '藏蓝'])

/** 目标保暖度（0-10） */
function targetWarmth(temp: number): number {
  if (temp <= 0) return 9
  if (temp <= 5) return 8
  if (temp <= 10) return 6.5
  if (temp <= 15) return 5
  if (temp <= 20) return 3.8
  if (temp <= 25) return 2.2
  if (temp <= 30) return 1.2
  return 0.4
}

/** 估算单品保暖度（0-10）：类别 + 材质/名称关键词 */
function itemWarmth(item: ClothingItem): number {
  let w = 0
  switch (item.category) {
    case 'top':
      w = 2.5
      break
    case 'pants':
      w = 2.8
      break
    case 'skirt':
      w = 1.6
      break
    case 'outer':
      w = 4.6
      break
    case 'shoes':
      w = 1
      break
    default:
      w = 0.5
  }
  const text = `${item.name ?? ''} ${item.material ?? ''}`
  if (/羽绒|厚/.test(text)) w += 2.8
  if (/羊毛|毛呢|呢子/.test(text)) w += 1.5
  if (/毛衣|针织|卫衣/.test(text)) w += 1.1
  if (/长袖|风衣|大衣/.test(text)) w += 0.6
  if (/棉/.test(text)) w += 0.3
  if (/麻|丝|雪纺/.test(text)) w -= 0.8
  if (/短袖|无袖|吊带/.test(text)) w -= 1.3
  if (/短裤|凉鞋/.test(text)) w -= 1.5
  return clamp(w, 0, 10)
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function seasonMatch(item: ClothingItem, season: string): boolean {
  const seasons = parseList(item.seasons)
  return seasons.length === 0 || seasons.includes(season) || seasons.includes('all')
}

/** 温度/天气硬边界 */
function weatherHardOk(item: ClothingItem, w: EngineWeather): boolean {
  const text = `${item.name ?? ''} ${item.material ?? ''}`
  if (w.temp < 12 && /短袖|无袖|吊带|凉鞋|短裤|雪纺/.test(text)) return false
  if (w.temp > 28 && /羽绒|厚毛衣|呢大衣/.test(text)) return false
  return true
}

/** 场合硬约束 */
function occasionHardOk(item: ClothingItem, occasion: string): boolean {
  const text = `${item.name ?? ''}`
  if (occasion === 'formal' && /运动|拖鞋|卫衣|牛仔/.test(text)) return false
  if (occasion === 'sport' && /高跟鞋|皮鞋|西装/.test(text)) return false
  return true
}

/** 单品软打分 */
function scoreItem(item: ClothingItem, w: EngineWeather, occasion: string): number {
  const warmth = itemWarmth(item)
  const target = targetWarmth(w.temp)
  const tempFit = 1 - Math.min(1, Math.abs(warmth - target) / 7) // 0.30

  const occ = parseList(item.occasions) // 0.25
  const occFit = occ.includes(occasion) ? 1 : occ.length === 0 ? 0.55 : 0.35

  let freshness: number // 0.15
  if (!item.lastWornAt) {
    freshness = 0.85
  } else {
    const days = (Date.now() - new Date(item.lastWornAt).getTime()) / 86400000
    freshness = clamp((days / 10) * 0.8 + 0.2, 0.2, 1)
  }

  const util = clamp(1 - item.wearCount / 20, 0.35, 1) // 0.10
  const neutral = NEUTRAL_COLORS.has(item.color ?? '') ? 0.8 : 0.5 // 0.10

  return 0.3 * tempFit + 0.25 * occFit + 0.15 * freshness + 0.1 * util + 0.1 * neutral
}

function colorCohesion(items: ClothingItem[]): number {
  const colors = items.map((i) => i.color).filter(Boolean) as string[]
  const distinct = new Set(colors).size
  const allNeutral = colors.every((c) => NEUTRAL_COLORS.has(c))
  let score = distinct <= 2 ? 1 : distinct === 3 ? 0.65 : 0.35
  if (allNeutral) score = Math.min(1, score + 0.2)
  return score
}

function repetitionPenalty(items: ClothingItem[], recent: Set<string>[]): number {
  if (recent.length === 0) return 0
  let maxOverlap = 0
  for (const set of recent) {
    const overlap = items.filter((i) => set.has(i.id)).length
    maxOverlap = Math.max(maxOverlap, overlap / Math.max(1, items.length))
  }
  return maxOverlap
}

function buildReason(items: ClothingItem[], w: EngineWeather, occasion: string): string {
  const parts: string[] = []
  const top = items.find((i) => i.category === 'top' || i.category === 'skirt')
  const bottom = items.find((i) => i.category === 'pants' || i.category === 'skirt')
  const outer = items.find((i) => i.category === 'outer')
  const shoe = items.find((i) => i.category === 'shoes')
  const head = `${Math.round(w.temp)}°C${occasionLabel(occasion)}`
  const combo =
    top && bottom && top.id !== bottom.id
      ? `${top.color ?? ''}${top.name ?? categoryLabel(top.category)} 配 ${bottom.color ?? ''}${bottom.name ?? categoryLabel(bottom.category)}`
      : top
        ? `${top.color ?? ''}${top.name ?? categoryLabel(top.category)}`
        : '看这身'
  parts.push(`${head}，${combo}`)
  if (outer) parts.push(`加件${outer.color ?? ''}${outer.name ?? '外套'}正好`)
  if (shoe) parts.push(`${shoe.color ?? ''}${shoe.name ?? categoryLabel('shoes')}收尾`)
  if (w.precipProb >= 50) parts.push('有雨，别穿白鞋，听劝')
  if (w.temp < 5) parts.push('外面冷，稳重一点')
  return `${parts.join('，')}。`
}

function styleTagsFor(items: ClothingItem[], occasion: string): string[] {
  const base: Record<string, string[]> = {
    commute: ['通勤', '简约'],
    casual: ['休闲', '日常'],
    sport: ['运动', '活力'],
    date: ['约会', '精致'],
    formal: ['正式', '利落'],
    home: ['居家', '舒服'],
  }
  const tags = [...(base[occasion] ?? ['日常'])]
  const allNeutral = items.every((i) => NEUTRAL_COLORS.has(i.color ?? ''))
  if (allNeutral) tags.push('基础款')
  if (items.some((i) => i.category === 'outer')) tags.push('叠穿')
  return tags.slice(0, 3)
}

export interface EngineOutfit {
  key: string
  items: ClothingItem[]
  score: number
  reason: string
  styleTags: string[]
}

export interface EngineResult {
  outfits: EngineOutfit[]
  candidates: {
    tops: ClothingItem[]
    bottoms: ClothingItem[]
    shoes: ClothingItem[]
    outers: ClothingItem[]
  }
  message?: string
}

export function recommendOutfits(
  closet: ClothingItem[],
  weather: EngineWeather,
  season: string,
  occasion: string,
  recentOutfits: { createdAt: Date; items: string[] }[],
): EngineResult {
  const missing: string[] = []
  const has = (cat: string) => closet.some((i) => i.category === cat)
  if (!has('top') && !has('skirt')) missing.push('上衣')
  if (!has('pants') && !has('skirt')) missing.push('下装')
  if (!has('shoes')) missing.push('鞋')

  // 1. 硬过滤
  const candidates = closet.filter(
    (item) =>
      item.storageStatus === 'wearing' &&
      seasonMatch(item, season) &&
      weatherHardOk(item, weather) &&
      occasionHardOk(item, occasion),
  )

  // 2. 打分排序，截取候选
  const scored = candidates
    .map((item) => ({ item, s: scoreItem(item, weather, occasion) }))
    .sort((a, b) => b.s - a.s)
  const cap = (cat: string, n: number) =>
    scored.filter((x) => x.item.category === cat).slice(0, n)
  const tops = cap('top', 10)
  const skirts = cap('skirt', 6)
  const pants = cap('pants', 10)
  const shoes = cap('shoes', 6)
  const outers = cap('outer', 5)
  const bottoms = [...pants, ...skirts].sort((a, b) => b.s - a.s).slice(0, 12)

  // 3. 生成组合
  const recentSets = recentOutfits.slice(0, 5).map((r) => new Set(r.items))
  const combos: EngineOutfit[] = []

  const needOuter = weather.temp < 15 || weather.precipProb >= 50
  const useOuter = needOuter && outers.length > 0
  const outerIter: ({ item: ClothingItem; s: number } | null)[] = useOuter ? outers : [null]

  for (const t of tops.length ? tops : skirts) {
    for (const b of bottoms) {
      if (t.item.id === b.item.id) continue
      // 裙子已经是“上下一体”，不再和裤子/裙子叠
      if (t.item.category === 'skirt' && b.item.category === 'skirt') continue
      for (const sh of shoes) {
        for (const o of outerIter) {
          const items = [t.item, b.item, sh.item, ...(o ? [o.item] : [])]
          const avg = (t.s + b.s + sh.s + (o ? o.s : 0)) / items.length
          const cohesion = colorCohesion(items)
          const rep = repetitionPenalty(items, recentSets)
          const score = avg * 0.72 + cohesion * 0.15 + 0.13 - rep * 0.2
          combos.push({
            key: items
              .map((i) => i.id)
              .sort()
              .join('-'),
            items,
            score: Math.round(score * 100),
            reason: buildReason(items, weather, occasion),
            styleTags: styleTagsFor(items, occasion),
          })
        }
      }
      if (combos.length > 4000) break
    }
    if (combos.length > 4000) break
  }

  if (combos.length === 0) {
    return {
      outfits: [],
      candidates: { tops: [], bottoms: [], shoes: [], outers: [] },
      message: missing.length
        ? `衣柜里还凑不出一套：缺${missing.join('、')}。先扔几件进来。`
        : '筛选后没有能搭的。放点当季衣物进来。',
    }
  }

  // 4. 排序 + 多样性选择（Top3 保证上衣不重样）
  combos.sort((a, b) => b.score - a.score)
  const picked: EngineOutfit[] = []
  const usedTops = new Set<string>()
  for (const c of combos) {
    const top = c.items.find((i) => i.category === 'top' || i.category === 'skirt')
    if (top && usedTops.has(top.id)) continue
    if (picked.some((p) => p.key === c.key)) continue
    picked.push(c)
    if (top) usedTops.add(top.id)
    if (picked.length >= 3) break
  }
  for (const c of combos) {
    if (picked.length >= 3) break
    if (!picked.some((p) => p.key === c.key)) picked.push(c)
  }

  // 5. 候选池（用于前端“单件替换”）
  const usedIds = new Set(picked.flatMap((p) => p.items.map((i) => i.id)))
  const poolFor = (cat: string, n: number) =>
    scored
      .filter((x) => x.item.category === cat && !usedIds.has(x.item.id))
      .slice(0, n)
      .map((x) => x.item)

  return {
    outfits: picked,
    candidates: {
      tops: poolFor('top', 8),
      bottoms: [...poolFor('pants', 8), ...poolFor('skirt', 4)],
      shoes: poolFor('shoes', 5),
      outers: poolFor('outer', 4),
    },
  }
}
