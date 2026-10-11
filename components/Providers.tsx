'use client'
import type { ReactNode } from 'react'
import { LazyMotion, MotionConfig, domMax } from 'motion/react'

/**
 * Motion for React is the only animation library. `domMax` is needed for layout animations. `reducedMotion="user"`
 * turns transform and layout animation off when the person asks for less motion, leaving opacity and colour, so
 * every moment becomes a crossfade that still ends in the same state.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  )
}
