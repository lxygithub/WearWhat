// 进程内限流（每个 isolate 独立计数，单实例应用足够；Workers 多 isolate 下为尽力而为）

const buckets = new Map<string, { count: number; resetAt: number }>()
const lastAt = new Map<string, number>()

/** 固定窗口限流：窗口内最多 max 次。返回 true = 放行 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    if (buckets.size > 1000) prune(now)
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (b.count >= max) return false
  b.count += 1
  return true
}

/** 冷却：两次调用间隔不足 ms 则拒绝。返回 true = 放行 */
export function cooldown(key: string, ms: number): boolean {
  const now = Date.now()
  const last = lastAt.get(key) ?? 0
  if (now - last < ms) return false
  lastAt.set(key, now)
  if (lastAt.size > 1000) prune(now)
  return true
}

function prune(now: number): void {
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k)
  for (const [k, t] of lastAt) if (now - t > 3600_000) lastAt.delete(k)
}
