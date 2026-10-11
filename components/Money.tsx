'use client'
import { useEffect, useRef, useState } from 'react'
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { formatAmount } from '@/lib/upkeep/amounts'
import { dur, ease } from '@/lib/motion'

/**
 * A dollar figure that counts to its new value when it changes, with tabular figures so nothing jumps sideways.
 * The animated text is hidden from assistive tech; a screen-reader copy always holds the final value.
 */
export function Money({ units, className }: { units: bigint; className?: string }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(Number(units))
  const [text, setText] = useState(() => formatAmount(units))
  const first = useRef(true)

  useMotionValueEvent(mv, 'change', (v) => setText(formatAmount(BigInt(Math.round(v)))))

  useEffect(() => {
    if (first.current || reduce) {
      first.current = false
      mv.set(Number(units))
      setText(formatAmount(units))
      return
    }
    const controls = animate(mv, Number(units), { duration: dur.level, ease: ease.out })
    return () => controls.stop()
  }, [units, reduce, mv])

  return (
    <span className={`num ${className ?? ''}`}>
      <span aria-hidden="true">${text}</span>
      <span className="sr-only">${formatAmount(units)}</span>
    </span>
  )
}
