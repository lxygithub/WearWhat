// 找回密码：验证码校验 → 重置密码
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { isValidEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body?.email ?? '').trim().toLowerCase()
    const code = String(body?.code ?? '').trim()
    const newPassword = String(body?.newPassword ?? '')

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: '请输入 6 位数字验证码' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: '新密码至少 6 位' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email }, select: { id: true } })
    const row = await db.verificationCode.findFirst({
      where: {
        email,
        type: 'reset',
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!user || !row) {
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 })
    }

    const passwordHash = await hashPassword(newPassword)
    await db.user.update({ where: { id: user.id }, data: { passwordHash } })
    await db.verificationCode.update({ where: { id: row.id }, data: { used: true } })
    // 作废该邮箱其余未用验证码，防止重放
    await db.verificationCode.updateMany({
      where: { email, used: false },
      data: { used: true },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '重置失败，稍后再试' },
      { status: 500 },
    )
  }
}
