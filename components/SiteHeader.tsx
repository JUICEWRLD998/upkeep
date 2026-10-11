'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import { Mark } from './Mark'
import styles from './SiteHeader.module.css'

const links = [
  { href: '/send', label: 'Send' },
  { href: '/desk', label: 'Payout desk' },
]

export function SiteHeader() {
  const path = usePathname()
  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.brand} aria-label="Upkeep home">
        <Mark size={26} />
        <span>upkeep</span>
      </Link>
      <nav className={styles.nav} aria-label="Main">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={styles.link} aria-current={path === l.href ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      <ThemeToggle />
    </header>
  )
}
