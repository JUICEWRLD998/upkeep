'use client'
import Link from 'next/link'
import { Button } from '@/components/Button'
import styles from './notfound.module.css'

/** Last line of defence: an unexpected error in a page shows this instead of a blank screen. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.page}>
      <h1>Something went wrong</h1>
      <p role="alert">This screen hit an error. Nothing was paid and nothing was changed by the error itself.</p>
      <div className={styles.row}>
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={styles.link}>
          Back to the home page
        </Link>
      </div>
    </main>
  )
}
