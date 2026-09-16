// 退出登录：清除会话 cookie
import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'

export async function POST() {
  await destroySession()
  return NextResponse.json({ ok: true })
}
