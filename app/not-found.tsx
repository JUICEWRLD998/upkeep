import Link from 'next/link'
import styles from './notfound.module.css'

export default function NotFound() {
  return (
    <main className={styles.page}>
      <h1>That page does not exist</h1>
      <p>The link may be mistyped or old. These are the places that do exist:</p>
      <ul className={styles.links}>
        <li>
          <Link href="/">The home page</Link>
        </li>
        <li>
          <Link href="/send">Your console, if you are sending</Link>
        </li>
        <li>
          <Link href="/desk">The payout desk</Link>
        </li>
      </ul>
      <p className={styles.muted}>If someone sent you an invite or an upkeep link, open that exact link on the phone it was meant for.</p>
    </main>
  )
}
