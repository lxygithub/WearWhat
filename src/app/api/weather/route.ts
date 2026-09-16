// 今日天气（Open-Meteo 代理 + 缓存）
import { NextRequest, NextResponse } from 'next/server'
import { fetchWeather } from '@/lib/ww-weather'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = Number(searchParams.get('lat'))
    const lon = Number(searchParams.get('lon'))
    const city = searchParams.get('city') || '当前位置'

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return NextResponse.json({ error: 'lat/lon 参数无效' }, { status: 400 })
    }

    const weather = await fetchWeather(lat, lon, city)
    return NextResponse.json({ weather })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '天气获取失败' }, { status: 502 })
  }
}
