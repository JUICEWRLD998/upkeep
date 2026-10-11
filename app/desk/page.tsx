'use client'
import { useCallback, useEffect, useState } from 'react'
import { explorerTx } from '@/lib/upkeep/chain'
import { formatAmount } from '@/lib/upkeep/amounts'
import { formatNaira } from '@/lib/upkeep/rate'
import styles from './desk.module.css'

type Row = {
  txHash: string
  blockNumber: string | null
  from: string
  amount: string
  payee: { label: string; bank: string; accountName: string; last4: string } | null
  nairaKobo: string | null
}
type Ledger = { rows: Row[]; rate: { ngnPerUsd: number; source: string; asOf: string } | null; headBlock: string }

export default function Desk() {
  const [data, setData] = useState<Ledger | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/desk/ledger', { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) {
        setError(j.error ?? 'The ledger could not be read.')
        return
      }
      setError('')
      setData(j)
    } catch {
      setError('Could not reach the payout desk.')
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(load, 0)
    const t = setInterval(load, 5000)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [load])

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1>Payout desk</h1>
        <p>
          Every row is a real dollar payment on the test network, read from the chain just now. The naira column is a payout instruction and is{' '}
          <strong>simulated</strong>: no naira has moved and no bank has been called.
        </p>
        {data?.rate ? (
          <p className={styles.muted}>
            Rate used: ₦{data.rate.ngnPerUsd.toLocaleString('en-NG', { maximumFractionDigits: 2 })} per $1 ({data.rate.source}, updated {data.rate.asOf}).
          </p>
        ) : (
          data && <p className={styles.muted}>Rate unavailable right now, so no naira amounts are shown.</p>
        )}
        <p className={styles.muted}>
          <small>Shows payments from the last 200,000 network blocks (about 34 hours at the measured 5,900 blocks per hour).</small>
        </p>
      </header>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {!data && !error && <p className={styles.muted}>Reading the network...</p>}
      {data && data.rows.length === 0 && <p className={styles.muted}>No payments to desk payees yet.</p>}
      {data && data.rows.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Payee</th>
              <th scope="col" className={styles.right}>
                Dollars <span className={styles.live}>(LIVE)</span>
              </th>
              <th scope="col" className={styles.right}>
                Naira instruction <span className={styles.sim}>(SIMULATED)</span>
              </th>
              <th scope="col">Network</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.txHash}>
                <td data-label="Payee">
                  {r.payee ? (
                    <>
                      <div className={styles.name}>{r.payee.label}</div>
                      <div className={styles.muted}>
                        {r.payee.bank} ••••{r.payee.last4}, {r.payee.accountName}
                      </div>
                    </>
                  ) : (
                    'Unlabelled desk address'
                  )}
                </td>
                <td data-label="Dollars (LIVE)" className={`${styles.right} num`}>
                  ${formatAmount(BigInt(r.amount))}
                </td>
                <td data-label="Naira (SIMULATED)" className={`${styles.right} num`}>
                  {r.nairaKobo ? <>Pay <span className={styles.naira}>{formatNaira(BigInt(r.nairaKobo)).slice(0, 1)}</span>{formatNaira(BigInt(r.nairaKobo)).slice(1)}</> : 'rate unavailable'}
                </td>
                <td data-label="Network">
                  <a href={explorerTx(r.txHash)} target="_blank" rel="noreferrer">
                    See on the network
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}

