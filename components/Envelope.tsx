'use client'
import { m, useReducedMotion } from 'motion/react'
import { dur, ease } from '@/lib/motion'
import styles from './Envelope.module.css'

/**
 * The budget as a cash envelope. The kraft level is the share of the limit still unspent, so what is left reads in
 * under a second. The level animates when the number changes (a payment landed or the budget refilled).
 * Always paired with the dollar figure as text; the svg itself is described for screen readers.
 */
export function Envelope({ remaining, limit, tone = 'full', label }: { remaining: bigint; limit: bigint | null; tone?: 'full' | 'compact'; label: string }) {
  const reduce = useReducedMotion()
  const fraction = limit && limit > 0n ? Math.max(0, Math.min(1, Number((remaining * 10000n) / limit) / 10000)) : 0
  const pct = Math.round(fraction * 100)
  return (
    <svg className={tone === 'compact' ? styles.compact : styles.full} viewBox="0 0 320 190" role="img" aria-label={`${label}: ${pct} percent of the budget left`}>
      <defs>
        <clipPath id={`inner-${tone}`}>
          <rect x="14" y="40" width="292" height="136" rx="6" />
        </clipPath>
      </defs>
      <rect x="8" y="34" width="304" height="148" rx="10" fill="var(--kraft-deep)" stroke="var(--kraft)" strokeWidth="2" />
      <g clipPath={`url(#inner-${tone})`}>
        <m.rect
          x="14"
          y="40"
          width="292"
          height="136"
          fill="var(--kraft-fill)"
          style={{ originY: 1, transformBox: 'fill-box' }}
          initial={false}
          animate={{ scaleY: fraction }}
          transition={reduce ? { duration: 0 } : { duration: dur.level, ease: ease.out }}
        />
      </g>
      <path d="M8 40 L160 118 L312 40" fill="none" stroke="var(--kraft)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
