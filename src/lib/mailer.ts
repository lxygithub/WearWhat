// 邮件发送：Resend HTTP API（fetch 实现，Cloudflare Workers 友好）
// 未配置 RESEND_API_KEY 时：
//   - 开发模式（NODE_ENV !== 'production'）：验证码打印到服务端日志，并直接返回给调用方（devCode）
//   - 生产模式：报错提示配置（避免线上裸奔）

export interface SendCodeResult {
  sent: boolean
  /** 仅开发模式返回，方便本地联调 */
  devCode?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}

function codeEmailHtml(code: string, purpose: string, minutes: number): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 28px;">
    <div style="font-size:20px;font-weight:800;color:#1c1917;">今天穿什么 <span style="font-size:12px;font-weight:500;color:#ea580c;">别问，问就是它</span></div>
    <p style="margin:20px 0 8px;font-size:14px;color:#57534e;">你的${purpose}验证码：</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#ea580c;background:#fff7ed;border:1px solid #ffedd5;border-radius:12px;padding:16px 0;text-align:center;">${code}</div>
    <p style="margin:16px 0 0;font-size:12px;color:#a8a29e;line-height:1.7;">${minutes} 分钟内有效。如果这不是你本人的操作，请忽略这封邮件。</p>
  </div>
</body></html>`
}

export async function sendVerificationCode(
  email: string,
  code: string,
  purpose: '注册' | '找回密码',
): Promise<SendCodeResult> {
  const apiKey = process.env.RESEND_API_KEY
  const minutes = 10

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('邮件服务未配置：请设置 RESEND_API_KEY 与 MAIL_FROM（见 DEPLOY.md）')
    }
    console.log(`[mailer] 开发模式验证码 -> ${email} : ${code}（${purpose}，${minutes} 分钟有效）`)
    return { sent: true, devCode: code }
  }

  const from = process.env.MAIL_FROM || 'WearWhat <onboarding@resend.dev>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} · WearWhat ${purpose}验证码`,
      html: codeEmailHtml(code, purpose, minutes),
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`邮件发送失败 (${res.status}) ${text.slice(0, 140)}`)
  }
  return { sent: true }
}
