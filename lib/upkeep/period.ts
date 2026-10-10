export type PeriodChoice = 'month' | 'week' | 'test'

export const PERIODS: Record<PeriodChoice, { seconds: number; label: string }> = {
  month: { seconds: 30 * 24 * 3600, label: 'Every month' },
  week: { seconds: 7 * 24 * 3600, label: 'Every week' },
  test: { seconds: 120, label: 'Every 2 minutes (test month, to watch a renewal)' },
}

/** "in 2 d 4 h", "in 3 min 10 s", or "now" for a unix-seconds target. */
export function untilText(targetSeconds: number, nowMs: number = Date.now()): string {
  const s = Math.round(targetSeconds - nowMs / 1000)
  if (s <= 0) return 'now'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `in ${d} d ${h} h`
  if (h > 0) return `in ${h} h ${m} min`
  if (m > 0) return `in ${m} min ${s % 60} s`
  return `in ${s} s`
}
