'use client'
import { useEffect, useRef, useState } from 'react'
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { formatAmount, formatCents } from '@/lib/upkeep/amounts'
import { dur, ease } from '@/lib/motion'

/**
 * A dollar figure that counts to its new value when it changes, with tabular figures so nothing jumps sideways.
 * The animated text is hidden from assistive tech; a screen-reader copy always holds the final value.
 */
export function Money({ units, className, cents = false }: { units: bigint; className?: string; cents?: boolean }) {
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

  return (
    <span className={`num ${className ?? ''}`}>
      <span aria-hidden="true">${text}</span>
      <span className="sr-only">${fmt(units)}</span>
    </span>
  )
}


