'use client'
import { m } from 'motion/react'
import { ease } from '@/lib/motion'
import styles from './Stamp.module.css'

/**
 * A rubber stamp. It lands (scale 1.7 to 1) and settles by a pixel, because a real stamp does. This is the only
 * overshoot in the product; controls never overshoot. `delay` places it inside the slip's choreography.
 */
export function Stamp({ tone, children, delay = 0, animateIn = false }: { tone: 'paid' | 'refused' | 'pending'; children: string; delay?: number; animateIn?: boolean }) {
  const tilt = tone === 'refused' ? 7 : -6
  return (
    <m.span
      className={`${styles.stamp} ${styles[tone]}`}
      initial={animateIn ? { opacity: 0, scale: 1.7, rotate: tilt } : false}
      animate={{ opacity: 1, scale: 1, rotate: tilt }}
      transition={{ delay, duration: 0.36, ease: ease.stamp }}
    >
      {children}
    </m.span>
  )
}
