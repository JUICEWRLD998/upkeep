'use client'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { formatAmount, formatCents } from '@/lib/upkeep/amounts'
import { dur, ease } from '@/lib/motion'
import styles from './Money.module.css'

/**
 * A dollar figure that counts to its new value when it changes, with tabular figures so nothing jumps sideways.
 * The animated text is hidden from assistive tech; a screen-reader copy always holds the final value.
 *
 * `fit` makes the figure the largest size up to that maximum that still fits its box on one line, so a very large
 * amount shrinks instead of pushing the page sideways. The size comes from the digit count, which is fixed by the
 * final value, so the figure never changes size while it counts.
 */
export function Money({ units, className, cents = false, fit }: { units: bigint; className?: string; cents?: boolean; fit?: string }) {
  const fmt = cents ? formatCents : formatAmount
  const reduce = useReducedMotion()
  const mv = useMotionValue(Number(units))
  const [text, setText] = useState(() => fmt(units))
  const first = useRef(true)

  useMotionValueEvent(mv, 'change', (v) => setText(formatCents(BigInt(Math.round(v)))))

  useEffect(() => {
    if (first.current || reduce) {
      first.current = false
      mv.set(Number(units))
      setText(fmt(units))
      return
    }
    const controls = animate(mv, Number(units), { duration: dur.level, ease: ease.out })
    // while counting, show whole cents so the figure does not flicker through six decimals; settle on the exact amount
    controls.then(() => setText(fmt(units)))
    return () => controls.stop()
  }, [units, reduce, mv, fmt])

  const figure = (
    <span className={`num ${fit ? styles.fitInner : ''} ${className ?? ''}`}>
      <span aria-hidden="true">${text}</span>
      <span className="sr-only">${fmt(units)}</span>
    </span>
  )
  if (!fit) return figure
  const chars = fmt(units).length + 1
  return (
    <span className={styles.fit} style={{ '--chars': chars, '--max': fit } as CSSProperties}>
      {figure}
    </span>
  )
}
