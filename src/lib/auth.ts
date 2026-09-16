// 鉴权：JWT 会话（jose，兼容 Node dev 与 Cloudflare Workers）+ bcrypt 密码哈希
// 会话放在 httpOnly cookie（ww_session），前端不接触 token

import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const SESSION_COOKIE = 'ww_session'
const SESSION_DAYS = 30

export interface SessionPayload {
  id: string
  email: string
}

let cachedSecret: Uint8Array | null = null

async function getSecret(): Promise<Uint8Array> {
  if (cachedSecret) return cachedSecret
  // OpenNext Cloudflare（nodejs_compat）会把 worker env 注入 process.env，
  // 因此 dev 与 Workers 均直接读 process.env.AUTH_SECRET（不要动态 import 未安装的包，webpack 会解析失败）
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('缺少 AUTH_SECRET：请执行 wrangler secret put AUTH_SECRET（见 DEPLOY.md）')
    }
    console.warn('[auth] 使用开发默认 AUTH_SECRET（仅限本地开发）')
    cachedSecret = new TextEncoder().encode('wearwhat-dev-secret-change-me-in-production')
    return cachedSecret
  }
  cachedSecret = new TextEncoder().encode(secret)
  return cachedSecret
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// 用户不存在时也做一次等价比较，避免时序侧信道暴露"邮箱是否注册过"
let dummyHash: string | null = null
export async function dummyPasswordHash(): Promise<string> {
  dummyHash ??= await bcrypt.hash('wearwhat-timing-equalizer', 10)
  return dummyHash
}

export async function createSession(userId: string, email: string): Promise<void> {
  const secret = await getSecret()
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 86400,
    path: '/',
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  })
}

/** 读取当前登录用户（JWT 校验，不查库；未登录返回 null） */
export async function getSessionUser(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const secret = await getSecret()
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    if (!payload.sub) return null
    return { id: payload.sub, email: String(payload.email ?? '') }
  } catch {
    return null
  }
}

/** 受保护接口统一 401 响应 */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: '请先登录' }, { status: 401 })
}
