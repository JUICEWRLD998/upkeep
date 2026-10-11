'use client'
import type { ReactNode } from 'react'
import { m } from 'motion/react'
import { dur, ease } from '@/lib/motion'
import { Stamp } from './Stamp'
import styles from './Slip.module.css'

/**
 * One payment, drawn as a teller slip: perforated left edge, who and to whom, the amount in tabular figures, a stamp.
 * `fresh` plays the signature moment: the slip drops in, then the stamp lands at 520 ms. Existing slips only shift
 * (layout) so the list never jumps.
 */
export function Slip({
  tone,
  who,
  to,
  amount,
  stamp,
  fresh = false,
  children,
}: {
  tone: 'paid' | 'refused' | 'pending'
  who: string
  to: ReactNode
  amount?: ReactNode
  stamp: string
  fresh?: boolean
  children?: ReactNode
}) {
  return (
    <m.li
      layout="position"
      className={`${styles.slip} ${styles[tone]}`}
      initial={fresh ? { opacity: 0, y: -28, rotate: -1.2 } : false}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: dur.slip, ease: ease.out, layout: { duration: dur.long, ease: ease.out } }}
    >
      <div className={styles.main}>
        <div className={styles.who}>{who}</div>
        <div className={styles.to}>{to}</div>
      </div>
      {amount !== undefined && <div className={`${styles.amount} num`}>{amount}</div>}
      <div className={styles.foot}>
        <div className={styles.note}>{children}</div>
        <Stamp tone={tone} delay={fresh ? 0.52 : 0} animateIn={fresh}>
          {stamp}
        </Stamp>
      </div>
    </m.li>
  )
}
