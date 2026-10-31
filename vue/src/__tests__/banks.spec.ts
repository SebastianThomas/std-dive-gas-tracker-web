import { describe, expect, it } from 'vitest'
import { bankDetailRoute, costLinesOf, isMix, newCostRow } from '@/lib/utils/banks'

const row = (amount: string, payerId: number) => ({ ...newCostRow(payerId), amount })

describe('costLinesOf', () => {
  it('books the whole bank on one person', () => {
    expect(costLinesOf([row('600.00', 1)])).toEqual([{ amount: '600.00', payerMemberId: 1 }])
  })

  it('keeps one line per person, with the same or different amounts', () => {
    expect(costLinesOf([row('100', 1), row('50', 2), row('50', 3)], 1000)).toEqual([
      { amount: '100.00', payerMemberId: 1, paidAt: 1000 },
      { amount: '50.00', payerMemberId: 2, paidAt: 1000 },
      { amount: '50.00', payerMemberId: 3, paidAt: 1000 },
    ])
  })

  it('skips empty rows, so a cost stays optional', () => {
    expect(costLinesOf([row(' ', 1)])).toEqual([])
  })

  it('names the problem when an amount is not one', () => {
    expect(costLinesOf([row('100', 1), row('abc', 2)])).toBe('Enter the amount like 120.50.')
  })
})

describe('isMix', () => {
  it('is a bank holding a mix, not a pure gas or air', () => {
    expect(['NITROX', 'TRIMIX'].map((gasClass) => isMix({ gasClass } as never))).toEqual([
      true,
      true,
    ])
    expect(['OXYGEN', 'HELIUM', 'AIR'].map((gasClass) => isMix({ gasClass } as never))).toEqual([
      false,
      false,
      false,
    ])
  })

  it('sends a mix to the Blend tab', () => {
    expect(bankDetailRoute({ gasClass: 'TRIMIX' })).toBe('MixDetail')
    expect(bankDetailRoute({ gasClass: 'OXYGEN' })).toBe('BankDetail')
  })
})
