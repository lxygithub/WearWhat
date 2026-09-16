// 衣橱问答的本地兜底引擎（不依赖大模型）
//
// LLM 未配置（ZAI_BASE_URL/ZAI_API_KEY 缺失）或调用失败时，用规则从
// 衣橱数据里直接算答案，保证产品文档 §2.6 的「问答式查询」在离线状态下
// 也能答准统计类问题。语气保持品牌人格：别问，问就是它。

import { categoryLabel, statusLabel } from '@/components/wearwhat/constants'
import type { AskAnswer, AskCompactItem } from './ww-ai'

const COLOR_WORDS = [
  '白色', '黑色', '灰色', '米色', '卡其', '棕色', '红色', '粉色', '橙色',
  '黄色', '绿色', '蓝色', '藏蓝', '紫色', '牛仔蓝',
]

const CATEGORY_WORDS: Record<string, string[]> = {
  top: ['上衣', '衬衫', 't恤', 'T恤', '毛衣', '卫衣', '针织', '打底', '背心', '吊带'],
  pants: ['裤子', '长裤', '短裤', '牛仔裤', '休闲裤', '西裤'],
  skirt: ['裙子', '连衣裙', '半身裙', '短裙', '长裙'],
  outer: ['外套', '大衣', '羽绒服', '风衣', '夹克', '西装'],
  shoes: ['鞋', '靴', '凉鞋', '板鞋', '运动鞋', '皮鞋', '拖鞋'],
  bag: ['包', '背包', '挎包', '手袋'],
  accessory: ['配饰', '帽子', '围巾', '项链', '手表', '腰带', '袜子'],
}

const SEASON_CN: Record<string, string> = {
  spring: '春', summer: '夏', autumn: '秋', winter: '冬',
}

function detectColors(q: string): string[] {
  return COLOR_WORDS.filter((c) => q.includes(c))
}

const SINGLE_COLOR_MAP: Record<string, string> = {
  白: '白色', 黑: '黑色', 灰: '灰色', 红: '红色', 粉: '粉色', 橙: '橙色',
  黄: '黄色', 绿: '绿色', 蓝: '蓝色', 紫: '紫色', 棕: '棕色',
}

/** 「白衬衫」「蓝裤子」这类「单字色+品类词」组合里的颜色 */
function detectCompoundColors(q: string): { full: string; char: string }[] {
  const out = new Map<string, string>()
  const re = /([白黑灰红粉橙黄绿蓝紫棕])(衬衫|t恤|裤|裙|外套|大衣|鞋|包|帽|围巾|毛衣|卫衣|夹克|风衣|羽绒服|套装)/g
  for (const m of q.matchAll(re)) {
    const full = SINGLE_COLOR_MAP[m[1]]
    if (full && !out.has(full)) out.set(full, m[1])
  }
  return [...out.entries()].map(([full, char]) => ({ full, char }))
}

function detectCategories(q: string): string[] {
  const keys = new Set<string>()
  for (const [key, words] of Object.entries(CATEGORY_WORDS)) {
    for (const w of words) {
      if (q.toLowerCase().includes(w.toLowerCase())) {
        keys.add(key)
        break
      }
    }
  }
  // 类别词优先级：外套类命中时不当作上衣
  if (keys.has('outer')) keys.delete('top')
  return [...keys]
}

function matchQuestion(q: string, item: AskCompactItem): boolean {
  const text = `${item.name ?? ''} ${item.color ?? ''} ${item.brand ?? ''} ${item.material ?? ''}`
  const cats = detectCategories(q)
  if (cats.length && !cats.includes(item.category)) return false
  const fullColors = detectColors(q)
  if (fullColors.length && !fullColors.some((c) => text.includes(c))) return false
  const compoundColors = detectCompoundColors(q)
  if (
    compoundColors.length &&
    !compoundColors.some((c) => text.includes(c.full) || text.includes(c.char))
  )
    return false
  if (!cats.length && !fullColors.length && !compoundColors.length) return false
  return true
}

/** 问题里是否带有可用的筛选条件（类别/颜色） */
function hasConstraint(q: string): boolean {
  return detectCategories(q).length > 0 || detectColors(q).length > 0 || detectCompoundColors(q).length > 0
}

/** 生成问题的简短描述，如「白色上衣」「外套」「符合条件的」 */
function describeQuery(q: string): string {
  const cats = detectCategories(q)
  const colors = [...detectColors(q), ...detectCompoundColors(q).map((c) => c.full)]
  const catLabel = cats.length ? categoryLabel(cats[0]) : ''
  const colorLabel = colors.length ? colors[0] : ''
  if (colorLabel && catLabel) return `${colorLabel}${catLabel}`
  if (colorLabel) return `${colorLabel}的`
  if (catLabel) return catLabel
  return '符合条件的'
}

function activeItems(items: AskCompactItem[]): AskCompactItem[] {
  return items.filter((i) => i.storageStatus !== 'discarded')
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86_400_000)
}

function names(items: AskCompactItem[], max = 4): string {
  const list = items.slice(0, max).map((i) => i.name || categoryLabel(i.category))
  if (list.length === 0) return ''
  return list.join('、')
}

function detectSeason(q: string): string | null {
  for (const [k, cn] of Object.entries(SEASON_CN)) if (q.includes(cn)) return k
  return null
}

export function localAnswer(payload: {
  question: string
  season: string
  weatherText: string | null
  items: AskCompactItem[]
  wishlist: { name: string; category: string | null; expectedPrice: number | null; priority: number }[]
}): AskAnswer {
  const q = payload.question
  const items = activeItems(payload.items)
  const empty: AskAnswer = { answer: '', itemIds: [], followUps: [] }

  const pick = (answer: string, matched: AskCompactItem[], followUps: string[]): AskAnswer => ({
    answer,
    itemIds: matched.slice(0, 6).map((i) => i.id),
    followUps: followUps.slice(0, 3),
  })

  // 1. 统计数量：几件 / 多少 / 有没有
  if (/几件|多少|几条|几双|几只|几个|有没有/.test(q)) {
    const matched = items.filter((i) => matchQuestion(q, i))
    if (matched.length > 0) {
      return pick(
        `${describeQuery(q)}有 ${matched.length} 件：${names(matched)}。别问，问就是它。`,
        matched,
        ['哪件最常穿？', '有需要补的吗？', '都是什么季节的？'],
      )
    }
    if (hasConstraint(q)) {
      return pick(`衣橱里翻不出${describeQuery(q)}，是真的没有。`, [], ['帮我推荐搭配', '看愿望清单', '全部衣物有几件？'])
    }
    return pick(
      `现在能穿的一共 ${items.length} 件（不算已淘汰的）。其中在穿 ${items.filter((i) => i.storageStatus === 'wearing').length} 件、待清洗 ${items.filter((i) => i.storageStatus === 'laundry').length} 件。`,
      items.slice(0, 3),
      ['最常穿的是哪件？', '有闲置的吗？', '价值多少钱？'],
    )
  }

  // 2. 最久没穿 / 闲置
  if (/最久没穿|很久没穿|闲置|落灰|积灰|吃灰/.test(q)) {
    const scoped = hasConstraint(q) ? items.filter((i) => matchQuestion(q, i)) : items
    const sorted = [...scoped].sort((a, b) => {
      const da = daysSince(a.lastWornAt) ?? 99999
      const db = daysSince(b.lastWornAt) ?? 99999
      return db - da
    })
    const top = sorted.slice(0, 3)
    const desc = top
      .map((i) => {
        const d = daysSince(i.lastWornAt)
        const where = i.storageLocation ? `（${i.storageLocation}）` : ''
        return `${i.name || categoryLabel(i.category)}${where}${d == null || d > 9999 ? '：从没穿过' : `：${d} 天没穿`}`
      })
      .join('；')
    if (!scoped.length) return pick(`衣橱里没有${describeQuery(q)}，谈何闲置。`, [], ['全部衣物有几件？', '帮我推荐搭配', '看愿望清单'])
    return pick(
      `${describeQuery(q)}里的吃灰榜单：${desc}。要么穿，要么送，别让它等成古董。`,
      top,
      ['它适合什么场合？', '该收起来吗？', '帮我搭一次它'],
    )
  }

  // 3. 最常穿
  if (/最常穿|穿得最多|穿的最多|最爱穿|使用率/.test(q)) {
    const scoped = hasConstraint(q) ? items.filter((i) => matchQuestion(q, i)) : items
    const sorted = [...scoped].sort((a, b) => b.wearCount - a.wearCount).slice(0, 3)
    const desc = sorted.map((i) => `${i.name || categoryLabel(i.category)}（穿过 ${i.wearCount} 次）`).join('、')
    if (!scoped.length) return pick(`衣橱里没有${describeQuery(q)}，先买再说。`, [], ['全部衣物有几件？', '帮我推荐搭配', '看愿望清单'])
    return pick(
      sorted.length && sorted[0].wearCount > 0
        ? `你的劳模：${desc}。`
        : '还没记录过穿着，先去首页生成搭配并记一笔吧。',
      sorted,
      ['最闲置的是哪件？', '本月利用率多少？', '帮我搭一套新的'],
    )
  }

  // 4. 在哪 / 找
  if (/在哪|在哪里|找不到|收在哪/.test(q)) {
    const matched = items.filter(
      (i) => matchQuestion(q, i) || (q.length >= 2 && (i.name ?? '').includes(q)),
    )
    if (!matched.length) return pick('没找到这件。是不是名字记岔了？', [], ['全部衣物有几件？', '看我的外套', '白衬衫有几件？'])
    const desc = matched
      .slice(0, 3)
      .map((i) => `${i.name || categoryLabel(i.category)}${i.storageLocation ? `在「${i.storageLocation}」` : `：没记收纳位置（状态：${statusLabel(i.storageStatus)}）`}`)
      .join('；')
    return pick(desc + '。', matched, ['它最近穿过吗？', '还有别的吗？', '帮我搭一套它'])
  }

  // 5. 换季 / 收纳
  if (/换季|收起来|收纳|该收|拿出来/.test(q)) {
    const target = detectSeason(q) ?? (['spring', 'summer', 'autumn', 'winter'].includes(payload.season) ? payload.season : null)
    if (!target) return pick('季节没认出来，你直接说「春天该收什么」。', [], ['春天该收什么？', '冬天该收什么？'])
    const putAway = items.filter((i) => !i.seasons.includes(target) && !i.seasons.includes('all') && i.storageStatus !== 'stored')
    const takeOut = items.filter((i) => i.seasons.includes(target) && i.storageStatus === 'stored')
    const a = putAway.length ? `该收起来：${names(putAway, 3)}` : ''
    const b = takeOut.length ? `该拿出来：${names(takeOut, 3)}` : ''
    return pick(
      [a, b].filter(Boolean).join('。') || (target === 'summer' ? '这个季节没什么要倒腾的，躺平。' : '衣橱状态健康，不用倒腾。'),
      [...putAway, ...takeOut],
      ['哪件最久没穿？', '全部衣物有几件？', '帮我搭一套当季的'],
    )
  }

  // 6. 愿望清单 / 购买建议
  if (/想买|买什么|缺什么|愿望|值得买|重复买/.test(q)) {
    if (!payload.wishlist.length) return pick('愿望清单是空的，克制得不错。', [], ['我缺一件百搭外套吗？', '最常穿的是哪件？', '有几件白衬衫？'])
    const top = [...payload.wishlist].sort((x, y) => y.priority - x.priority).slice(0, 3)
    const desc = top.map((w) => `${w.name}${w.expectedPrice ? `（¥${w.expectedPrice}）` : ''}`).join('、')
    // 重复购买提醒：清单里的类别衣橱里已有 3 件以上
    const dupe = payload.wishlist.find((w) => {
      if (!w.category) return false
      return items.filter((i) => i.category === w.category).length >= 3
    })
    const warn = dupe ? `。提醒一句：${categoryLabel(dupe.category)}你已经有 ${items.filter((i) => i.category === dupe.category).length} 件了，管住手` : ''
    return pick(`清单里排最前：${desc}${warn}。`, [], ['最闲置的是哪件？', '这个月花了多少钱？', '帮我搭一套'])
  }

  // 7. 穿什么 / 搭配建议
  if (/穿什么|怎么搭|搭什么|推荐|搭配/.test(q)) {
    const tops = items.filter((i) => i.category === 'top' && i.storageStatus === 'wearing')
    const bottoms = items.filter((i) => (i.category === 'pants' || i.category === 'skirt') && i.storageStatus === 'wearing')
    const shoes = items.filter((i) => i.category === 'shoes' && i.storageStatus === 'wearing')
    if (!tops.length || !bottoms.length) {
      return pick('在穿的单品还不够搭一套。先去衣橱录几件（记得把状态设成「在穿」）。', [], ['全部衣物有几件？', '怎么录衣服？', '最常穿的是哪件？'])
    }
    const combo = [tops[0], bottoms[0], shoes[0]].filter(Boolean)
    const w = payload.weatherText ? `，${payload.weatherText}` : ''
    return pick(
      `别问，问就是它：${combo.map((i) => i.name || categoryLabel(i.category)).join(' + ')}${w}。想要正式点的三套方案，回首页点「生成搭配」。`,
      combo,
      ['换成正式一点的', '这套适合约会吗？', '有别的穿法吗？'],
    )
  }

  // 8. 兜底
  return {
    ...empty,
    answer: '这个问题超出我的离线小脑容量了。先试试统计类：「我有几件白衬衫」「哪件外套最久没穿」。',
    followUps: ['我有几件白衬衫？', '哪件外套最久没穿？', '今天穿什么？'],
  }
}
