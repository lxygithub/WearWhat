// WearWhat 常量与字典

import type { CategoryKey } from './types'

export const CATEGORIES: { key: CategoryKey; label: string; icon: string }[] = [
  { key: 'top', label: '上衣', icon: '👕' },
  { key: 'pants', label: '裤子', icon: '👖' },
  { key: 'skirt', label: '裙子', icon: '👗' },
  { key: 'outer', label: '外套', icon: '🧥' },
  { key: 'shoes', label: '鞋', icon: '👟' },
  { key: 'bag', label: '包', icon: '👜' },
  { key: 'accessory', label: '配饰', icon: '🧣' },
]

export const SEASONS = [
  { key: 'spring', label: '春' },
  { key: 'summer', label: '夏' },
  { key: 'autumn', label: '秋' },
  { key: 'winter', label: '冬' },
  { key: 'all', label: '四季' },
]

export const OCCASIONS = [
  { key: 'commute', label: '通勤', icon: '💼' },
  { key: 'casual', label: '休闲', icon: '🛋️' },
  { key: 'sport', label: '运动', icon: '🏃' },
  { key: 'date', label: '约会', icon: '🌹' },
  { key: 'formal', label: '正式', icon: '🎩' },
  { key: 'home', label: '居家', icon: '🏠' },
]

export const STORAGE_STATUS = [
  { key: 'wearing', label: '在穿' },
  { key: 'laundry', label: '待清洗' },
  { key: 'stored', label: '已收纳' },
  { key: 'repair', label: '待修补' },
  { key: 'discarded', label: '已淘汰' },
]

export const PATTERNS = [
  { key: 'solid', label: '纯色' },
  { key: 'striped', label: '条纹' },
  { key: 'plaid', label: '格子' },
  { key: 'print', label: '印花' },
]

export const COLORS = [
  { name: '白色', hex: '#f5f5f4' },
  { name: '黑色', hex: '#1c1917' },
  { name: '灰色', hex: '#8a8681' },
  { name: '米色', hex: '#e5d9be' },
  { name: '卡其', hex: '#b3a078' },
  { name: '棕色', hex: '#8b5e3c' },
  { name: '红色', hex: '#dc2626' },
  { name: '粉色', hex: '#f472b6' },
  { name: '橙色', hex: '#ea580c' },
  { name: '黄色', hex: '#eab308' },
  { name: '绿色', hex: '#16a34a' },
  { name: '蓝色', hex: '#2563eb' },
  { name: '藏蓝', hex: '#1e3a5f' },
  { name: '紫色', hex: '#9333ea' },
  { name: '牛仔蓝', hex: '#5a7ba6' },
]

export function colorHex(name?: string | null): string {
  if (!name) return '#d6d3d1'
  return COLORS.find((c) => c.name === name)?.hex ?? '#a8a29e'
}

export const CITIES = [
  { name: '香港', lat: 22.32, lon: 114.17 },
  { name: '深圳', lat: 22.54, lon: 114.06 },
  { name: '广州', lat: 23.13, lon: 113.26 },
  { name: '上海', lat: 31.23, lon: 121.47 },
  { name: '北京', lat: 39.9, lon: 116.41 },
  { name: '杭州', lat: 30.27, lon: 120.15 },
  { name: '成都', lat: 30.57, lon: 104.07 },
  { name: '武汉', lat: 30.59, lon: 114.31 },
  { name: '西安', lat: 34.34, lon: 108.94 },
  { name: '台北', lat: 25.03, lon: 121.57 },
  { name: '东京', lat: 35.68, lon: 139.69 },
  { name: '新加坡', lat: 1.35, lon: 103.82 },
]

export function categoryLabel(key?: string | null): string {
  if (!key) return '未知'
  return CATEGORIES.find((c) => c.key === key)?.label ?? key
}

export function categoryIcon(key?: string | null): string {
  if (!key) return '🧺'
  return CATEGORIES.find((c) => c.key === key)?.icon ?? '🧺'
}

export function seasonLabel(key: string): string {
  return SEASONS.find((s) => s.key === key)?.label ?? key
}

export function occasionLabel(key?: string | null): string {
  if (!key) return ''
  return OCCASIONS.find((o) => o.key === key)?.label ?? key
}

export function statusLabel(key?: string | null): string {
  if (!key) return '在穿'
  return STORAGE_STATUS.find((s) => s.key === key)?.label ?? key
}

// —— 品牌文案（来自产品文档 §9）——
export const COPY = {
  brand: '今天穿什么',
  slogan: '别问，问就是它。',
  sub: '你负责出门，它负责搭。',
  splash: '正在翻你的衣柜……',
  emptyCloset: ['衣柜空空如也。', '先扔几件进来，它才有的挑。'],
  addCta: ['拍一张，它记住。', '你记不住没关系。'],
  resultCta: ['就这套。', '别换了，再换迟到。'],
  cold: (t: number) => [`外面 ${t} 度。`, '你昨天还想穿短裤，冷静。'],
  rain: ['有雨。', '别穿白鞋，听劝。'],
  full: ['衣服很多，能穿的没有。', '它正在努力。'],
  recorded: '已记录。别问，问就是它。',
}
