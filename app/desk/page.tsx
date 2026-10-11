'use client'
import { useCallback, useEffect, useState } from 'react'
import { explorerTx } from '@/lib/upkeep/chain'
import { formatAmount } from '@/lib/upkeep/amounts'
import { formatNaira } from '@/lib/upkeep/rate'

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
    <main>
      <h1>Payout desk</h1>
      <p>
        Every row below is a real dollar payment on the test network, read from the chain just now. The naira column is a payout
        instruction and is <strong>simulated</strong>: no naira has moved and no bank has been called.
      </p>
      {data?.rate ? (
        <p>
          Rate used: ₦{data.rate.ngnPerUsd.toLocaleString('en-NG', { maximumFractionDigits: 2 })} per $1 ({data.rate.source}, updated {data.rate.asOf}).
        </p>
      ) : (
        data && <p>Rate unavailable right now, so no naira amounts are shown.</p>
      )}
      <p>
        <small>Shows payments from the last 200,000 network blocks (about 34 hours at the measured 5,900 blocks per hour).</small>
      </p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Reading the network...</p>}
      {data && data.rows.length === 0 && <p>No payments to desk payees yet.</p>}
      {data && data.rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Payee</th>
              <th>Dollars (LIVE)</th>
              <th>Naira instruction (SIMULATED)</th>
              <th>Network</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.txHash}>
                <td>
                  {r.payee ? (
                    <>
                      {r.payee.label}
                      <br />
                      <small>
                        {r.payee.bank} ••••{r.payee.last4}, {r.payee.accountName}
                      </small>
                    </>
                  ) : (
                    'Unlabelled desk address'
                  )}
                </td>
                <td>${formatAmount(BigInt(r.amount))}</td>
                <td>{r.nairaKobo ? `Pay ${formatNaira(BigInt(r.nairaKobo))}` : 'rate unavailable'}</td>
                <td>
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
