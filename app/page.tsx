import Link from 'next/link'
import styles from './page.module.css'

const steps = [
  { n: '1', title: 'Make a key link', body: 'You name the person and send them a link. Nothing is spent and nothing is shared.' },
  { n: '2', title: 'Her phone makes the key', body: 'The key is created on her device and never leaves it. She sends back only its public address.' },
  { n: '3', title: 'You approve once', body: 'Set a limit, how often it refills, and exactly who she may pay. Your passkey signs. Turn it off whenever you like.' },
]

const refusals = [
  { code: 'SpendingLimitExceeded', words: 'More than her limit for this period.' },
  { code: 'CallNotAllowed', words: 'Anyone who is not on your list.' },
  { code: 'KeyAlreadyRevoked', words: 'Anything at all, after you turn her key off.' },
]

export default function Landing() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1>Don&apos;t send money home. Send a key.</h1>
          <p className={styles.lead}>
            Your family spends from your dollar account, up to the limit you set, at the places you list. The network says no to everything else, so
            there is nothing to ask and nobody to trust.
          </p>
          <div className={styles.cta}>
            <Link href="/send" className={styles.primary}>
              Create my account
            </Link>
            <Link href="/desk" className={styles.secondary}>
              See the payout desk
            </Link>
          </div>
          <p className={styles.note}>Runs on the Tempo test network. No real money.</p>
        </div>

        <figure className={styles.art} aria-label="Example of Mummy's key: a $150 monthly limit with one payment made and one refused">
          <div className={styles.keycard}>
            <div className={styles.keyHead}>
              <span className={styles.keyName}>Mummy&apos;s key</span>
              <span className={styles.keyPeriod}>$150.00 a month</span>
            </div>
            <div className={`${styles.figure} num`}>$110.00</div>
            <div className={styles.meter} role="img" aria-label="73 percent of the monthly limit left">
              <span className={styles.meterFill} />
            </div>
            <div className={styles.keyFoot}>
              <span>left this month</span>
              <span>Resets 1 Nov</span>
            </div>
          </div>
          <ul className={styles.ledger}>
            <li className={styles.row}>
              <div>
                <div className={styles.rowTitle}>Corona School</div>
                <div className={styles.rowSub}>On the list</div>
              </div>
              <span className={`${styles.rowAmt} num`}>$25.00</span>
              <span className={styles.paid}>Paid</span>
            </li>
            <li className={styles.row}>
              <div>
                <div className={styles.rowTitle}>Someone not on the list</div>
                <div className={styles.rowSub}>
                  <code>CallNotAllowed</code>
                </div>
              </div>
              <span className={`${styles.rowAmt} num`}>$500.00</span>
              <span className={styles.refused}>Refused</span>
            </li>
          </ul>
          <figcaption className={styles.caption}>Example. Every figure in the app is read from the network as you look at it.</figcaption>
        </figure>
      </section>

      <section className={styles.section} aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <ol className={styles.steps}>
          {steps.map((s) => (
            <li key={s.n} className={styles.step}>
              <span className={`${styles.stepNum} num`}>{s.n}</span>
              <h3>{s.title}</h3>
              <p className={styles.muted}>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="rule">
        <h2 id="rule">The network is the rule</h2>
        <p className={styles.muted}>
          The limit is not a setting in our app. It is part of the account on the Tempo network, so a payment outside it never happens. These are the
          network&apos;s own answers.
        </p>
        <ul className={styles.refusals}>
          {refusals.map((r) => (
            <li key={r.code} className={styles.refusal}>
              <code>{r.code}</code>
              <span>{r.words}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="real">
        <h2 id="real">What is real, and what is not</h2>
        <dl className={styles.real}>
          <div>
            <dt className={styles.live}>LIVE</dt>
            <dd>Dollars on the Tempo test network, the limits, the refusals, turning a key off, and the live feed.</dd>
          </div>
          <div>
            <dt className={styles.sim}>SIMULATED</dt>
            <dd>The naira credit to a Nigerian bank account. The payout desk shows the instruction; no bank is called.</dd>
          </div>
          <div>
            <dt className={styles.not}>NOT LIVE</dt>
            <dd>Mainnet, cards and identity checks.</dd>
          </div>
        </dl>
      </section>

      <footer className={styles.footer}>
        <p>Mustapha Fadhlullah, independent security researcher. Built for the Colosseum Crypto World&apos;s Fair, Tempo track.</p>
        <p>
          <a href="https://github.com/JUICEWRLD998/upkeep" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </p>
      </footer>
    </main>
  )
}
