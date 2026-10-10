/** Dollars to naira for the SIMULATED payout instruction. Pure maths here; the server fetches the live rate. */
export type Rate = { ngnPerUsd: number; source: string; asOf: string }

/** Naira for a USD amount in token base units (6 decimals), rounded down to whole kobo. Returns kobo as bigint. */
export function koboFor(usdUnits: bigint, ngnPerUsd: number, decimals = 6): bigint {
  if (!(ngnPerUsd > 0) || !Number.isFinite(ngnPerUsd)) throw new Error('Invalid rate')
  // Rate in micro-naira per dollar keeps the integer arithmetic exact: 1331.25 -> 1331250000.
  const microNgn = BigInt(Math.round(ngnPerUsd * 1_000_000))
  // usdUnits / 10^decimals dollars * microNgn / 10^6 naira * 100 kobo
  return (usdUnits * microNgn * 100n) / (10n ** BigInt(decimals) * 1_000_000n)
}

export function formatNaira(kobo: bigint): string {
  const whole = kobo / 100n
  const frac = (kobo % 100n).toString().padStart(2, '0')
  return `₦${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`
}

/** A rate in the plausible range for NGN/USD; anything else is treated as a bad answer from the source. */
export function plausibleRate(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 100 && n < 20000
}
