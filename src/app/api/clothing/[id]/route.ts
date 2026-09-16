// 衣物更新 / 删除
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { saveImage, deleteImage, ImageTooLargeError } from '@/lib/storage'

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json()

    const data: Record<string, unknown> = {}
    const strFields = ['name', 'color', 'pattern', 'material', 'brand', 'size', 'storageLocation', 'notes', 'category', 'storageStatus']
    for (const f of strFields) {
      if (f in body) data[f] = body[f] ?? null
    }
    if ('seasons' in body) data.seasons = typeof body.seasons === 'string' ? body.seasons : JSON.stringify(body.seasons ?? [])
    if ('occasions' in body) data.occasions = typeof body.occasions === 'string' ? body.occasions : JSON.stringify(body.occasions ?? [])
    if ('price' in body) data.price = typeof body.price === 'number' ? body.price : null
    if ('purchaseDate' in body) data.purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : null
    if ('imageData' in body) {
      // 换了图：新图存 R2，同时把旧图从 R2 删掉，避免留下没人引用的对象
      const previous = await db.clothingItem.findUnique({
        where: { id },
        select: { imageData: true },
      })
      data.imageData = await saveImage(body.imageData)
      if (previous?.imageData && previous.imageData !== data.imageData) {
        await deleteImage(previous.imageData)
      }
    }

    const item = await db.clothingItem.update({ where: { id }, data })
    return NextResponse.json({ item })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '更新失败' },
      // 图太大是请求本身的问题，回 413 而不是 500
      { status: e instanceof ImageTooLargeError ? 413 : 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const item = await db.clothingItem.findUnique({ where: { id }, select: { imageData: true } })
    await db.clothingItem.delete({ where: { id } })
    // 连同 R2 上的照片一起清掉（只是清理，失败不影响删除结果）
    await deleteImage(item?.imageData)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '删除失败' }, { status: 500 })
  }
}
