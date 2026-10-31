import { describe, expect, it } from 'vitest'
import type { Fill, VesselSummary } from '@/lib/api/types'
import {
  CYLINDER_SIZES,
  MORE_CYLINDER_SIZES,
  bankDrawFromFill,
  defaultStages,
  draftFromFill,
  emptyBankDraw,
  emptyDraft,
  fullestBank,
  toBankDrawInput,
  toFillInput,
} from '@/lib/fill/fillForm'

function bank(
  vesselId: number,
  gasClass: VesselSummary['gasClass'],
  usable: number,
): VesselSummary {
  return {
    vesselId,
    label: `Bank ${vesselId}`,
    gasClass,
    mix: gasClass === 'HELIUM' ? { o2: 0, he: 1 } : { o2: 1, he: 0 },
    waterVolumeLitres: 50,
    status: 'IN_SERVICE',
    lossPolicy: 'TRUE_UP',
    estimatedPressureBar: 150,
    estimatedContentLitres: usable + 1000,
    usableContentLitres: usable,
    rate: '0.0500',
    rateIsEstimate: true,
    openedAt: 0,
  }
}

const banks = [bank(1, 'HELIUM', 4000), bank(2, 'OXYGEN', 3000), bank(3, 'OXYGEN', 8000)]

describe('fill form defaults', () => {
  it('preselects the fullest bank of each gas in the usual He → O2 → air order', () => {
    expect(fullestBank(banks, 'OXYGEN')?.vesselId).toBe(3)
    expect(defaultStages(banks).map((stage) => stage.source)).toEqual([
      { type: 'VESSEL', vesselId: 1 },
      { type: 'VESSEL', vesselId: 3 },
      { type: 'AIR' },
    ])
  })

  it('offers only air when the team has no pure-gas banks', () => {
    expect(defaultStages([]).map((stage) => stage.source)).toEqual([{ type: 'AIR' }])
  })
})

describe('form → request', () => {
  it('maps the usual trimix fill and leaves defaults to the backend', () => {
    const draft = emptyDraft(banks, 7, '12')
    draft.stages[0]!.pressureAfter = '70'
    draft.stages[1]!.pressureAfter = '92,5'
    draft.stages[2]!.pressureAfter = '200'

    expect(toFillInput(draft)).toEqual({
      input: {
        target: { type: 'CYLINDER', waterVolumeLitres: 12, chargedMemberId: 7 },
        startPressureBar: 0,
        stages: [
          { source: { type: 'VESSEL', vesselId: 1 }, pressureAfterBar: 70 },
          { source: { type: 'VESSEL', vesselId: 3 }, pressureAfterBar: 92.5 },
          { source: { type: 'AIR' }, pressureAfterBar: 200 },
        ],
      },
    })
  })

  it('reports the first missing value instead of sending a broken request', () => {
    const draft = emptyDraft(banks, 7, '12')
    draft.stages[0]!.pressureAfter = '70'
    expect(toFillInput(draft)).toEqual({ problem: 'Enter the pressure after gas 2.' })
    expect(toFillInput(emptyDraft(banks, 7, ''))).toEqual({
      problem: 'Choose the cylinder size.',
    })
  })

  it('sends mixes as fractions and the bank gauge only for bank stages', () => {
    const draft = emptyDraft(banks, 7, '12')
    draft.stages = draft.stages.slice(1)
    draft.stages[0]!.pressureAfter = '30'
    draft.stages[0]!.bankGaugeAfter = '180'
    draft.stages[1]!.pressureAfter = '200'
    draft.analysisO2 = '32'
    const mapped = toFillInput(draft)

    expect('input' in mapped && mapped.input.endAnalysis).toEqual({ o2: 0.32, he: 0 })
    expect('input' in mapped && mapped.input.stages[0]).toEqual({
      source: { type: 'VESSEL', vesselId: 3 },
      pressureAfterBar: 30,
      sourcePressureAfterBar: 180,
    })
  })
})

describe('edit', () => {
  it('turns a saved fill back into the same request, bank gauges included', () => {
    const fill = {
      fillId: 5,
      filledAt: Date.UTC(2026, 9, 1, 8, 0),
      recordedBy: { memberId: 1, displayName: 'Dana' },
      target: { type: 'CYLINDER', waterVolumeLitres: 24, chargedMemberId: 9, cylinderLabel: 'D12' },
      startPressureBar: 10,
      startMix: { o2: 0.21, he: 0.35 },
      stages: [
        {
          source: { type: 'VESSEL', vesselId: 1, label: 'He' },
          pressureAfterBar: 70,
          sourcePressureAfterBar: 150,
        },
        { source: { type: 'AIR' }, pressureAfterBar: 200 },
      ],
    } as unknown as Fill
    const mapped = toFillInput(draftFromFill(fill))

    expect('input' in mapped && mapped.input).toEqual({
      target: { type: 'CYLINDER', waterVolumeLitres: 24, chargedMemberId: 9, cylinderLabel: 'D12' },
      startPressureBar: 10,
      startMix: { o2: 0.21, he: 0.35 },
      stages: [
        {
          source: { type: 'VESSEL', vesselId: 1 },
          pressureAfterBar: 70,
          sourcePressureAfterBar: 150,
        },
        { source: { type: 'AIR' }, pressureAfterBar: 200 },
      ],
      filledAt: fill.filledAt,
    })
  })

  it('keeps the exact time of an edited fill unless it was changed', () => {
    const filledAt = Date.UTC(2026, 9, 1, 10, 15, 50, 123)
    const fill = {
      filledAt,
      recordedBy: { memberId: 1, displayName: 'Dana' },
      target: { type: 'CYLINDER', waterVolumeLitres: 12, chargedMemberId: 1 },
      startPressureBar: 0,
      startMix: { o2: 0.209, he: 0 },
      stages: [{ source: { type: 'AIR' }, pressureAfterBar: 200 }],
    } as unknown as Fill
    const draft = draftFromFill(fill)

    const kept = toFillInput(draft)
    expect('input' in kept && kept.input.filledAt).toBe(filledAt)

    draft.filledAt = '2026-10-02T09:00'
    const changed = toFillInput(draft)
    expect('input' in changed && changed.input.filledAt).toBe(
      new Date('2026-10-02T09:00').getTime(),
    )
  })

  it('keeps a transfer into a bank a transfer', () => {
    const fill = {
      filledAt: 0,
      recordedBy: { memberId: 3, displayName: 'Bob' },
      target: { type: 'VESSEL', vesselId: 4, vesselLabel: 'EAN32 bank' },
      startPressureBar: 0,
      startMix: { o2: 0.209, he: 0 },
      endAnalysis: { o2: 0.32, he: 0 },
      stages: [{ source: { type: 'AIR' }, pressureAfterBar: 200 }],
    } as unknown as Fill
    const mapped = toFillInput(draftFromFill(fill))

    expect('input' in mapped && mapped.input).toMatchObject({
      target: { type: 'VESSEL', vesselId: 4 },
      endAnalysis: { o2: 0.32, he: 0 },
    })
  })
})

describe('cylinder sizes', () => {
  const all = [...CYLINDER_SIZES, ...MORE_CYLINDER_SIZES]

  it('turns a cuft rating into the water volume the fill is calculated with', () => {
    const litresOf = (label: string) => all.find((size) => size.label === label)?.value
    expect(litresOf('40 cuft')).toBe('5.7')
    expect(litresOf('80 cuft')).toBe('11.1')
    expect(litresOf('2×80 cuft')).toBe('22.2')
  })

  it('gives every size its own volume, so only one chip is ever selected', () => {
    expect(new Set(all.map((size) => size.value)).size).toBe(all.length)
  })
})

describe('bank draw form', () => {
  const draft = {
    vesselId: 3,
    before: '200',
    after: '150',
    chargedMemberId: 7,
    filledAt: '',
    notes: '',
  }

  it('sends the bank pressures as one stage, charged to the member', () => {
    expect(toBankDrawInput(draft)).toEqual({
      input: {
        target: { type: 'BANK_DRAW', chargedMemberId: 7 },
        startPressureBar: 200,
        stages: [{ source: { type: 'VESSEL', vesselId: 3 }, pressureAfterBar: 150 }],
      },
    })
  })

  it('asks for what is missing', () => {
    expect(toBankDrawInput({ ...draft, before: '' })).toEqual({
      problem: 'Enter the bank pressure before.',
    })
    expect(toBankDrawInput({ ...draft, after: '' })).toEqual({
      problem: 'Enter the bank pressure now.',
    })
    expect(toBankDrawInput({ ...draft, vesselId: 0 })).toEqual({ problem: 'Add a bank first.' })
  })

  it('starts from the bank with the most usable gas, at its level', () => {
    const banks = [
      { ...bank(1, 'OXYGEN', 100), estimatedPressureBar: 120.4 },
      { ...bank(2, 'HELIUM', 900), estimatedPressureBar: 95.6 },
    ]
    expect(emptyBankDraw(banks, 7)).toMatchObject({ vesselId: 2, before: '96', after: '' })
  })

  it('round-trips a stored bank draw for editing', () => {
    const stored = {
      target: { type: 'BANK_DRAW', chargedMemberId: 7 },
      startPressureBar: 200,
      endPressureBar: 150,
      filledAt: 1_700_000_000_123,
      stages: [{ source: { type: 'VESSEL', vesselId: 3 } }],
    } as unknown as Fill
    const mapped = toBankDrawInput(bankDrawFromFill(stored))
    expect(mapped).toEqual({
      input: {
        target: { type: 'BANK_DRAW', chargedMemberId: 7 },
        startPressureBar: 200,
        stages: [{ source: { type: 'VESSEL', vesselId: 3 }, pressureAfterBar: 150 }],
        filledAt: 1_700_000_000_123,
      },
    })
  })
})
