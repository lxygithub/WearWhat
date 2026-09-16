// 邮箱注册：验证码校验 → 建号 → 首个用户接管种子数据 → 自动登录
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, hashPassword } from '@/lib/auth'
import { isValidEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')
    const code = String(body?.code ?? '').trim()
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 20) : ''

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: '请输入 6 位数字验证码' }, { status: 400 })
    }

    const exists = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (exists) {
      return NextResponse.json({ error: '该邮箱已注册，直接登录吧' }, { status: 400 })
    }

    const row = await db.verificationCode.findFirst({
      where: {
        email,
        type: 'register',
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!row) {
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 })
    }

    const isFirst = (await db.user.count()) === 0
    const passwordHash = await hashPassword(password)
    const user = await db.user.create({
      data: { email, passwordHash, name: name || null },
      select: { id: true, email: true, name: true },
    })

    await db.verificationCode.update({ where: { id: row.id }, data: { used: true } })

    // 首个注册用户接管演示数据（userId=default 的种子衣物/穿搭/愿望）
    if (isFirst) {
      await db.clothingItem.updateMany({ where: { userId: 'default' }, data: { userId: user.id } })
      await db.outfit.updateMany({ where: { userId: 'default' }, data: { userId: user.id } })
      await db.wishlistItem.updateMany({ where: { userId: 'default' }, data: { userId: user.id } })
    }

    await createSession(user.id, user.email)
    return NextResponse.json({ user }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '注册失败，稍后再试' },
      { status: 500 },
    )
  }
}
