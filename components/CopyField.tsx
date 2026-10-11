'use client'
import { useState } from 'react'
import { Button } from './Button'
import styles from './CopyField.module.css'

/** A read-only link box with a copy button. The textarea keeps the aria-label so the link is reachable by name. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className={styles.box}>
      <textarea className={`${styles.text} num`} readOnly value={value} rows={3} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
      <Button variant="secondary" onClick={copy}>
        {copied ? 'Copied' : 'Copy link'}
      </Button>
    </div>
  )
}
