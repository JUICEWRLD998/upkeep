'use client'
import { m, useReducedMotion } from 'motion/react'
import { dur, ease } from '@/lib/motion'
import styles from './Envelope.module.css'

/**
 * The budget as a flat meter. The mint fill is the share of the limit still unspent, so what is left reads in
 * under a second. The fill animates when the number changes (a payment landed or the budget refilled).
 * Always paired with the dollar figure as text; the meter itself is described for screen readers.
 * The file keeps its old name so every screen that shows a budget keeps working.
 */
export function Envelope({ remaining, limit, tone = 'full', label }: { remaining: bigint; limit: bigint | null; tone?: 'full' | 'compact'; label: string }) {
  const reduce = useReducedMotion()
  const fraction = limit && limit > 0n ? Math.max(0, Math.min(1, Number((remaining * 10000n) / limit) / 10000)) : 0
  const pct = Math.round(fraction * 100)
  return (
    <div className={tone === 'compact' ? styles.compact : styles.full} role="img" aria-label={`${label}: ${pct} percent of the budget left`}>
      <m.span
        className={styles.fill}
        style={{ originX: 0 }}
        initial={false}
        animate={{ scaleX: fraction }}
        transition={reduce ? { duration: 0 } : { duration: dur.level, ease: ease.out }}
      />
    </div>
  )
}
