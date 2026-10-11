'use client'
import { useEffect, useState } from 'react'
import styles from './ThemeToggle.module.css'

type Theme = 'light' | 'dark' | 'system'
const KEY = 'upkeep:theme'

function apply(t: Theme) {
  const el = document.documentElement
  if (t === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', t)
}

/** Light, dark or follow the device. The choice is a per-person convenience, so it lives in this browser only. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = localStorage.getItem(KEY) as Theme | null
        if (saved === 'light' || saved === 'dark') {
          setTheme(saved)
          apply(saved)
        }
      } catch {
        // storage blocked: stay on the device setting
      }
    }, 0)
    return () => clearTimeout(t)
  }, [])

  function choose(t: Theme) {
    setTheme(t)
    apply(t)
    try {
      if (t === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, t)
    } catch {
      // nothing to do: the choice still applies for this visit
    }
  }

  const next: Theme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system'
  const label = theme === 'system' ? 'Theme: follows your device' : `Theme: ${theme}`
  return (
    <button type="button" className={styles.toggle} onClick={() => choose(next)} aria-label={`${label}. Change theme`} title={label}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        {theme === 'light' && <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" opacity="0" />}
        {theme === 'dark' && <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" />}
        {theme === 'system' && <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />}
      </svg>
    </button>
  )
}
