import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import styles from './Field.module.css'

/** A labelled control. The visible label is the accessible name; hint and error are announced with the control. */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${styles.control} ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${styles.control} ${props.className ?? ''}`} />
}
