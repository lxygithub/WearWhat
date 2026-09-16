// 愿望清单：列表 + 新增
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const entries = await db.wishlistItem.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json({ entries })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '查询失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body?.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: '名字不能为空' }, { status: 400 })
    }
    const entry = await db.wishlistItem.create({
      data: {
        name: String(body.name).slice(0, 50),
        category: body.category ?? null,
        expectedPrice: typeof body.expectedPrice === 'number' ? body.expectedPrice : null,
        notes: body.notes ?? null,
        priority: typeof body.priority === 'number' ? body.priority : 0,
      },
    })
    return NextResponse.json({ entry }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '创建失败' }, { status: 500 })
  }
}
