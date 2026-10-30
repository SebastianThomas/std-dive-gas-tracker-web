import { describe, expect, it } from 'vitest'
import { absoluteAmount, balanceTone, formatMoney, formatUnitPrice } from '@/lib/format/money'
import { mixLabel } from '@/lib/format/mix'
import { parseDecimal, parseMoney } from '@/lib/format/number'
import { formatBar, formatLitres, formatWaterVolume } from '@/lib/format/units'
import { gasClassLabel, lossPolicyLabel } from '@/lib/format/words'
import type { VesselSummary } from '@/lib/api/types'
import { LOW_BANK_BAR, choiceOfMix, isLow, levelPercent, mixOfChoice } from '@/lib/utils/banks'

describe('money', () => {
  // Intl keeps the currency and the number together with a no-break space
  const plain = (text: string) => text.replace(/\u00a0/g, ' ')

  it('formats amounts and unit prices with the team currency', () => {
    expect(plain(formatMoney('12.3', 'CHF', 'en-US'))).toBe('CHF 12.30')
    expect(plain(formatMoney('-5.00', 'CHF', 'en-US'))).toBe('-CHF 5.00')
    expect(plain(formatUnitPrice('0.0537', 'CHF', 'en-US'))).toBe('CHF 0.0537/L')
    expect(formatUnitPrice('0.0000', 'CHF', 'en-US')).toBe('—')
  })

  it('reads the sign of a balance without arithmetic on money', () => {
    expect(balanceTone('12.30')).toBe('owed')
    expect(balanceTone('-0.01')).toBe('owes')
    expect(balanceTone('0.00')).toBe('settled')
    expect(absoluteAmount('-5.00')).toBe('5.00')
  })
})

describe('mix labels', () => {
  it('uses the names divers use', () => {
    expect(mixLabel({ o2: 0.209, he: 0 })).toBe('Air')
    expect(mixLabel({ o2: 0.32, he: 0 })).toBe('EAN32')
    expect(mixLabel({ o2: 0.21, he: 0.35 })).toBe('21/35')
    expect(mixLabel({ o2: 1, he: 0 })).toBe('O2')
    expect(mixLabel({ o2: 0, he: 1 })).toBe('He')
    expect(mixLabel({ o2: 0.2228, he: 0.3482 })).toBe('22/35')
  })
})

describe('units', () => {
  it('rounds pressures and volumes for reading', () => {
    expect(formatBar(199.6)).toBe('200 bar')
    expect(formatBar(2.23)).toBe('2.2 bar')
    expect(formatLitres(2380.6)).toMatch(/^2.?381 L$/)
    expect(formatWaterVolume(11.1)).toBe('11.1 L')
  })
})

describe('input parsing', () => {
  it('accepts comma and dot decimals', () => {
    expect(parseDecimal('12,5')).toBe(12.5)
    expect(parseDecimal(' 200 ')).toBe(200)
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('12a')).toBeNull()
  })

  it('turns money input into API strings with at most two decimals', () => {
    expect(parseMoney('12,5')).toBe('12.50')
    expect(parseMoney('600')).toBe('600.00')
    expect(parseMoney('1.234')).toBeNull()
    expect(parseMoney('0')).toBeNull()
  })
})

describe('plain words and bank levels', () => {
  it('never shows enum names', () => {
    expect(lossPolicyLabel('TRUE_UP')).toBe('Exact per bank')
    expect(lossPolicyLabel('POOLED')).toBe('Shared loss pool')
    expect(gasClassLabel('HELIUM')).toBe('Helium')
  })

  it('scales the level bar to 300 bar and flags low banks in service only', () => {
    expect(levelPercent(150)).toBe(50)
    expect(levelPercent(-3)).toBe(0)
    expect(levelPercent(330)).toBe(100)
    const bank = { status: 'IN_SERVICE', estimatedPressureBar: 40 } as VesselSummary
    expect(isLow(bank)).toBe(true)
    expect(isLow({ ...bank, estimatedPressureBar: LOW_BANK_BAR })).toBe(false)
    expect(isLow({ ...bank, status: 'CLOSED' })).toBe(false)
  })
})

describe('bank gas choice', () => {
  it('maps the presets and percentages both ways', () => {
    expect(mixOfChoice({ kind: 'OXYGEN', o2: '', he: '' })).toEqual({ o2: 1, he: 0 })
    expect(mixOfChoice({ kind: 'OTHER', o2: '32', he: '' })).toEqual({ o2: 0.32, he: 0 })
    expect(mixOfChoice({ kind: 'OTHER', o2: '', he: '' })).toBeNull()
    expect(choiceOfMix({ o2: 0, he: 1 }).kind).toBe('HELIUM')
    expect(choiceOfMix({ o2: 0.209, he: 0 }).kind).toBe('AIR')
    expect(choiceOfMix({ o2: 0.21, he: 0.35 })).toEqual({ kind: 'OTHER', o2: '21', he: '35' })
  })
})
