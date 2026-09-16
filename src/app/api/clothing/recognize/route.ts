// AI 衣物识别（VLM，需登录）
import { NextRequest, NextResponse } from 'next/server'
import { recognizeClothingImage } from '@/lib/ww-ai'
import { getSessionUser, unauthorized } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const { imageData } = await req.json()
    if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
      return NextResponse.json({ error: '图片数据无效' }, { status: 400 })
    }
    // 前端已压缩，这里再兜底限制 ~4MB
    if (imageData.length > 4_500_000) {
      return NextResponse.json({ error: '图片太大了，压缩后再试' }, { status: 413 })
    }
    const result = await recognizeClothingImage(imageData)
    return NextResponse.json({ result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '识别失败' },
      { status: 500 },
    )
  }
}
