// 发送邮箱验证码（type: register 注册 / reset 找回密码）
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isValidEmail, sendVerificationCode } from '@/lib/mailer'
import { cooldown, rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body?.email ?? '').trim().toLowerCase()
    const type = body?.type === 'reset' ? 'reset' : 'register'

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
    }

    // 限流：同邮箱 60s 冷却 + 每小时最多 8 次
    if (!cooldown(`code-cd:${email}`, 60_000)) {
      return NextResponse.json({ error: '发送太频繁了，1 分钟后再试' }, { status: 429 })
    }
    if (!rateLimit(`code-hr:${email}`, 8, 3600_000)) {
      return NextResponse.json({ error: '发送次数达到上限，请一小时后再试' }, { status: 429 })
    }

    const exists = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (type === 'register' && exists) {
      return NextResponse.json({ error: '该邮箱已注册，直接登录吧' }, { status: 400 })
    }
    if (type === 'reset' && !exists) {
      // 不暴露邮箱是否存在，直接返回成功
      return NextResponse.json({ ok: true })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    // 作废该邮箱此前的未用验证码
    await db.verificationCode.updateMany({
      where: { email, type, used: false },
      data: { used: true },
    })
    await db.verificationCode.create({
      data: { email, code, type, expiresAt: new Date(Date.now() + 10 * 60_000) },
    })

    const result = await sendVerificationCode(email, code, type === 'register' ? '注册' : '找回密码')
    return NextResponse.json({ ok: true, devCode: result.devCode })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '发送失败，稍后再试' },
      { status: 500 },
    )
  }
}
