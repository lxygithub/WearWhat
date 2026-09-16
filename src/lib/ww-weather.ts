// 天气服务：Open-Meteo 免费无 Key + 内存缓存 + WMO 天气码转中文

import type { WeatherData } from '@/components/wearwhat/types'

interface CacheEntry {
  ts: number
  data: WeatherData
}

const CACHE_TTL = 15 * 60 * 1000
const globalCache = globalThis as unknown as {
  wwWeatherCache: Map<string, CacheEntry> | undefined
}
const cache: Map<string, CacheEntry> = (globalCache.wwWeatherCache ??= new Map())

const WMO: Record<number, [string, string]> = {
  0: ['晴', '☀️'],
  1: ['晴间多云', '🌤️'],
  2: ['多云', '⛅'],
  3: ['阴', '☁️'],
  45: ['雾', '🌫️'],
  48: ['雾凇', '🌫️'],
  51: ['毛毛雨', '🌦️'],
  53: ['毛毛雨', '🌦️'],
  55: ['毛毛雨', '🌦️'],
  56: ['冻毛毛雨', '🌧️'],
  57: ['冻毛毛雨', '🌧️'],
  61: ['小雨', '🌦️'],
  63: ['中雨', '🌧️'],
  65: ['大雨', '🌧️'],
  66: ['冻雨', '🌧️'],
  67: ['冻雨', '🌧️'],
  71: ['小雪', '🌨️'],
  73: ['中雪', '🌨️'],
  75: ['大雪', '❄️'],
  77: ['米雪', '❄️'],
  80: ['阵雨', '🌦️'],
  81: ['阵雨', '🌧️'],
  82: ['暴雨', '⛈️'],
  85: ['阵雪', '🌨️'],
  86: ['阵雪', '❄️'],
  95: ['雷阵雨', '⛈️'],
  96: ['雷阵雨伴冰雹', '⛈️'],
  99: ['雷阵雨伴冰雹', '⛈️'],
}

export async function fetchWeather(lat: number, lon: number, city: string): Promise<WeatherData> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return { ...hit.data, city }
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=auto`

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`天气服务响应异常 (${res.status})`)
  const json = (await res.json()) as {
    current?: {
      temperature_2m?: number
      apparent_temperature?: number
      relative_humidity_2m?: number
      weather_code?: number
      wind_speed_10m?: number
    }
    daily?: {
      temperature_2m_max?: number[]
      temperature_2m_min?: number[]
      precipitation_probability_max?: number[]
    }
  }

  const cur = json.current ?? {}
  const daily = json.daily ?? {}
  const code = cur.weather_code ?? 0
  const [condition, icon] = WMO[code] ?? ['未知', '🌡️']

  const data: WeatherData = {
    city,
    temp: round(cur.temperature_2m ?? 20),
    apparent: round(cur.apparent_temperature ?? cur.temperature_2m ?? 20),
    condition,
    icon,
    windSpeed: round(cur.wind_speed_10m ?? 0),
    humidity: round(cur.relative_humidity_2m ?? 50),
    precipProb: round(daily.precipitation_probability_max?.[0] ?? 0),
    tempMax: round(daily.temperature_2m_max?.[0] ?? 25),
    tempMin: round(daily.temperature_2m_min?.[0] ?? 15),
  }

  cache.set(key, { ts: Date.now(), data })
  return data
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}
