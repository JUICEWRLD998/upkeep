'use client'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'

/**
 * Eight states: default, hover (pointer devices only), focus-visible (global ring), active (scale 0.97), disabled,
 * loading (aria-busy plus spinner), error (use variant danger), success (the caller swaps the label). Hit area 44px.
 */
export function Button({
  variant = 'primary',
  loading = false,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={rest.type ?? 'button'}
      className={`${styles.btn} ${styles[variant]} ${className ?? ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <span className={styles.spin} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; children: ReactNode }
