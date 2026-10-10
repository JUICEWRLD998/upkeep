import { describe, expect, it } from 'vitest'
import { PayeeError, cleanPayee } from '../lib/upkeep/payee'
import { formatNaira, koboFor, plausibleRate } from '../lib/upkeep/rate'

const SENDER = '0xa231eee840a316116fec11cca47c2059ca7d6793'
const good = { sender: SENDER, label: 'Mummy', bank: 'GTBank', accountName: 'Ngozi Okafor', last4: '4821' }

describe('cleanPayee', () => {
  it('checksums the sender and keeps only the last four digits', () => {
    const p = cleanPayee(good)
    expect(p.sender).not.toBe(SENDER)
    expect(p.sender.toLowerCase()).toBe(SENDER)
    expect(p.last4).toBe('4821')
  })
  it('strips markup characters and control characters from names', () => {
    const p = cleanPayee({ ...good, label: '<b>Mum</b>\u0000', accountName: '  Ngozi   Okafor ' })
    expect(p.label).toBe('bMum/b')
    expect(p.accountName).toBe('Ngozi Okafor')
  })
  it('refuses a full account number, a bad sender, or empty fields', () => {
    expect(() => cleanPayee({ ...good, last4: '0123456789' })).toThrow(PayeeError)
    expect(() => cleanPayee({ ...good, last4: '12a4' })).toThrow(PayeeError)
    expect(() => cleanPayee({ ...good, sender: '0x123' })).toThrow(PayeeError)
    expect(() => cleanPayee({ ...good, label: '   ' })).toThrow(PayeeError)
    expect(() => cleanPayee({ ...good, bank: undefined })).toThrow(PayeeError)
  })
})

describe('naira maths', () => {
  it('converts 4 dollars at 1331.25 to exact kobo', () => {
    expect(koboFor(4_000_000n, 1331.25)).toBe(532_500n)
    expect(formatNaira(532_500n)).toBe('₦5,325.00')
  })
  it('rounds down to a whole kobo and handles tiny amounts', () => {
    expect(koboFor(1n, 1331.25)).toBe(0n)
    // $3.333333 x 1500 = 4999.9995 naira, which is 499,999 whole kobo
    expect(koboFor(3_333_333n, 1500)).toBe(499_999n)
    expect(formatNaira(1n)).toBe('₦0.01')
    expect(formatNaira(123_456_789n)).toBe('₦1,234,567.89')
  })
  it('rejects nonsense rates', () => {
    expect(() => koboFor(1_000_000n, 0)).toThrow()
    expect(() => koboFor(1_000_000n, NaN)).toThrow()
    expect(plausibleRate(1331.25)).toBe(true)
    expect(plausibleRate(1.2)).toBe(false)
    expect(plausibleRate('1331')).toBe(false)
  })
})
