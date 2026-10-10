/** Token amounts are bigint base units end to end. AlphaUSD has 6 decimals; callers pass decimals read from the token. */
export const USD_DECIMALS = 6

export class AmountError extends Error {}

/** Parse a user-typed dollar string ("40", "40.5", "0.000001") into base units. Rejects anything ambiguous. */
export function parseAmount(input: string, decimals: number = USD_DECIMALS): bigint {
  const s = input.trim().replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(s)) throw new AmountError('Enter an amount like 40 or 40.50')
  const [whole, frac = ''] = s.split('.')
  if (frac.length > decimals) throw new AmountError(`At most ${decimals} decimal places`)
  const units = BigInt(whole + frac.padEnd(decimals, '0'))
  if (units <= 0n) throw new AmountError('Amount must be more than zero')
  return units
}

/** Format base units as dollars: at least 2 decimals, more only when the value needs them. */
export function formatAmount(units: bigint, decimals: number = USD_DECIMALS): string {
  const neg = units < 0n
  const abs = neg ? -units : units
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  let frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  if (frac.length < 2) frac = frac.padEnd(2, '0')
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '-' : ''}${grouped}.${frac}`
}
