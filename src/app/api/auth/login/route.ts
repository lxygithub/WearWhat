// 邮箱密码登录
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, dummyPasswordHash, verifyPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')

    if (!email || !password) {
      return NextResponse.json({ error: '请输入邮箱和密码' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email } })
    const hash = user?.passwordHash ?? (await dummyPasswordHash())
    const ok = await verifyPassword(password, hash)
    if (!user || !ok) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 })
    }

    await createSession(user.id, user.email)
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '登录失败，稍后再试' },
      { status: 500 },
    )
  }
}
