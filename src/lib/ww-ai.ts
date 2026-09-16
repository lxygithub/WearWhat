// WearWhat AI 能力层（仅服务端使用 z-ai-web-dev-sdk）

import ZAI from 'z-ai-web-dev-sdk'
import type { RecognizeResult } from '@/components/wearwhat/api'

/** 从模型输出中鲁棒提取 JSON（容忍代码围栏/前后缀文本） */
function extractJSON<T>(text: string): T | null {
  if (!text) return null
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  // 尝试直接解析
  try {
    return JSON.parse(cleaned) as T
  } catch {
    /* 继续尝试 */
  }
  // 提取第一个 {...} 或 [...]
  const objMatch = cleaned.match(/[[{][\s\S]*[\]}]/)
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]) as T
    } catch {
      return null
    }
  }
  return null
}

const CATEGORIES = ['top', 'pants', 'skirt', 'outer', 'shoes', 'bag', 'accessory']
const SEASONS = ['spring', 'summer', 'autumn', 'winter', 'all']
const OCCASIONS = ['commute', 'casual', 'sport', 'date', 'formal', 'home']
const PATTERNS = ['solid', 'striped', 'plaid', 'print']

/** VLM：识别衣物照片 */
export async function recognizeClothingImage(imageData: string): Promise<RecognizeResult> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `你是衣物整理助手。分析这张衣物图片，返回严格 JSON（不要任何多余文本）：
{
  "name": "简短中文名称，如 白色衬衫 / 深蓝牛仔裤",
  "category": "top|pants|skirt|outer|shoes|bag|accessory 之一",
  "color": "中文主色，如 白色/黑色/藏蓝/牛仔蓝/米色",
  "pattern": "solid|striped|plaid|print 之一",
  "material": "材质猜测（棉/羊毛/牛仔/羽绒等，不确定就留空字符串）",
  "seasons": ["spring","summer","autumn","winter","all"] 中 1-2 个,
  "occasions": ["commute","casual","sport","date","formal","home"] 中 1-3 个最合适的
}
注意：如果是连衣裙归 skirt；羽绒服/大衣归 outer。`,
          },
          { type: 'image_url', image_url: { url: imageData } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  const parsed = extractJSON<Partial<RecognizeResult>>(raw)
  if (!parsed) throw new Error('AI 没能认出这件，手动填吧。')

  const seasons = Array.isArray(parsed.seasons)
    ? parsed.seasons.filter((s): s is string => SEASONS.includes(s))
    : []
  const occasions = Array.isArray(parsed.occasions)
    ? parsed.occasions.filter((o): o is string => OCCASIONS.includes(o))
    : []

  return {
    name: typeof parsed.name === 'string' ? parsed.name.slice(0, 30) : null,
    category: CATEGORIES.includes(parsed.category ?? '') ? parsed.category! : null,
    color: typeof parsed.color === 'string' ? parsed.color.slice(0, 10) : null,
    pattern: PATTERNS.includes(parsed.pattern ?? '') ? parsed.pattern! : null,
    material: typeof parsed.material === 'string' ? parsed.material.slice(0, 20) : null,
    seasons: seasons.length ? seasons : ['all'],
    occasions: occasions.length ? occasions : ['casual'],
  }
}

/** LLM：为 3 套搭配生成有梗的推荐理由与风格标签 */
export async function enhanceOutfitReasons(payload: {
  occasion: string
  weather: { temp: number; condition: string; precipProb: number } | null
  outfits: { key: string; itemNames: string[] }[]
}): Promise<Record<string, { reason: string; styleTags: string[] }> | null> {
  try {
    const zai = await ZAI.create()
    const weatherText = payload.weather
      ? `${payload.weather.temp}°C，${payload.weather.condition}，降水概率 ${payload.weather.precipProb}%`
      : '未知'
    const prompt = `你是一个毒舌但贴心的穿搭助手（品牌人格：别问，问就是它）。
根据以下信息为每套搭配写推荐理由。

天气：${weatherText}
场合：${payload.occasion}
搭配清单：
${payload.outfits.map((o, i) => `${i + 1}. ${o.itemNames.join(' + ')}`).join('\n')}

要求：
- reason：40 字以内中文，说明为什么适合今天（温度/场合/颜色），语气轻松带点梗，不要空洞形容词。
- styleTags：2-3 个中文风格标签，如 通勤/简约/复古/运动/叠穿。

严格返回 JSON 数组（不要任何多余文本）：
[{"index":1,"reason":"...","styleTags":["..."]}]`

    const completion = (await Promise.race([
      zai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        thinking: { type: 'disabled' },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000)),
    ])) as Awaited<ReturnType<typeof zai.chat.completions.create>>

    const raw = completion.choices[0]?.message?.content ?? ''
    const arr = extractJSON<{ index: number; reason: string; styleTags?: string[] }[]>(raw)
    if (!arr || !Array.isArray(arr)) return null

    const map: Record<string, { reason: string; styleTags: string[] }> = {}
    arr.forEach((entry, i) => {
      const outfit = payload.outfits[entry.index - 1] ?? payload.outfits[i]
      if (!outfit) return
      if (entry.reason && typeof entry.reason === 'string') {
        map[outfit.key] = {
          reason: entry.reason.slice(0, 80),
          styleTags: Array.isArray(entry.styleTags)
            ? entry.styleTags.filter((t) => typeof t === 'string').slice(0, 3)
            : [],
        }
      }
    })
    return Object.keys(map).length ? map : null
  } catch {
    return null // 静默降级到模板文案
  }
}

/** LLM：自然语言搜索 —— 把人话解析成结构化条件 */
export async function parseSearchQuery(
  q: string,
  categoryLabels: { key: string; label: string }[],
): Promise<{ category?: string; color?: string; keywords: string[]; hint: string } | null> {
  try {
    const zai = await ZAI.create()
    const prompt = `把这句找衣服的人话解析成 JSON。原句："${q}"

类别可选：${categoryLabels.map((c) => `${c.key}=${c.label}`).join('、')}
颜色用中文（白色/黑色/灰色/米色/卡其/棕色/红色/粉色/橙色/黄色/绿色/蓝色/藏蓝/紫色/牛仔蓝）。

严格返回 JSON（不要多余文本）：
{"category":"类别key或空字符串","color":"颜色中文名或空字符串","keywords":["提取的其它关键词，如 条纹/衬衫/面试"],"hint":"一句 30 字内的中文，告诉用户你是怎么理解这句话的"}`

    const completion = await Promise.race([
      zai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        thinking: { type: 'disabled' },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
    ]) as Awaited<ReturnType<typeof zai.chat.completions.create>>

    const raw = completion.choices[0]?.message?.content ?? ''
    const parsed = extractJSON<{ category?: string; color?: string; keywords?: string[]; hint?: string }>(raw)
    if (!parsed) return null
    return {
      category: parsed.category && CATEGORIES.includes(parsed.category) ? parsed.category : undefined,
      color: typeof parsed.color === 'string' && parsed.color ? parsed.color.slice(0, 6) : undefined,
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((k) => typeof k === 'string' && k).slice(0, 4)
        : [],
      hint: typeof parsed.hint === 'string' ? parsed.hint.slice(0, 60) : '帮你找。',
    }
  } catch {
    return null
  }
}
