// 衣物列表 + 新增
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { saveImage, ImageTooLargeError } from '@/lib/storage'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') || undefined
    const season = searchParams.get('season') || undefined
    const status = searchParams.get('status') || undefined
    const q = searchParams.get('q') || undefined

    const where: Record<string, unknown> = {}
    if (category) where.category = category
    if (status) where.storageStatus = status
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { color: { contains: q } },
        { brand: { contains: q } },
        { material: { contains: q } },
        { notes: { contains: q } },
      ]
    }

    let items = await db.clothingItem.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    })

    if (season) {
      items = items.filter((i) => {
        try {
          const seasons = JSON.parse(i.seasons || '[]') as string[]
          return seasons.length === 0 || seasons.includes(season) || seasons.includes('all')
        } catch {
          return true
        }
      })
    }

    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '查询失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body?.category) {
      return NextResponse.json({ error: '类别不能为空' }, { status: 400 })
    }
    // 图片：前端仍照原样传 base64 data URL，这里转存 R2 后只把地址写进库
    const imageData = await saveImage(body.imageData)
    const item = await db.clothingItem.create({
      data: {
        name: body.name ?? null,
        category: String(body.category),
        color: body.color ?? null,
        pattern: body.pattern ?? null,
        material: body.material ?? null,
        seasons: typeof body.seasons === 'string' ? body.seasons : JSON.stringify(body.seasons ?? []),
        occasions:
          typeof body.occasions === 'string' ? body.occasions : JSON.stringify(body.occasions ?? []),
        brand: body.brand ?? null,
        size: body.size ?? null,
        price: typeof body.price === 'number' ? body.price : null,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
        storageStatus: body.storageStatus ?? 'wearing',
        storageLocation: body.storageLocation ?? null,
        notes: body.notes ?? null,
        imageData,
      },
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '创建失败' },
      // 图太大是请求本身的问题，回 413 而不是 500
      { status: e instanceof ImageTooLargeError ? 413 : 500 }
    )
  }
}
