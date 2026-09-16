// 当前登录用户
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { destroySession, getSessionUser, unauthorized } from '@/lib/auth'

export async function GET() {
  const session = await getSessionUser()
  if (!session) return unauthorized()

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true },
  })
  if (!user) {
    // 会话有效但用户已不存在：清掉 cookie
    await destroySession()
    return unauthorized()
  }
  return NextResponse.json({ user })
}
