import type { QuickChip } from '@/components/ui/QuickChips.vue'
import type { Fill, FillInput, GasClass, Mix, StageSource, VesselSummary } from '@/lib/api/types'
import { fromLocalInput, toLocalInput } from '@/lib/format/dates'
import { parseDecimal } from '@/lib/format/number'

// The fill form's state as typed by the user (strings), and its mapping to the API request.
// Only parsing happens here; every rule (pressures increasing, banks in service, …) is the
// backend's, which answers the preview with a clear message.

export interface StageDraft {
  key: number
  source: StageSource
  pressureAfter: string
  /** Optional bank gauge after this stage (becomes a reading on that bank). */
  bankGaugeAfter: string
}

export interface FillDraft {
  /** null: a diver's cylinder; a bank id: blending into that bank. */
  intoVesselId: number | null
  waterVolume: string
  cylinderLabel: string
  chargedMemberId: number
  startPressure: string
  startO2: string
  startHe: string
  stages: StageDraft[]
  analysisO2: string
  analysisHe: string
  /** datetime-local value (minutes); empty: now. */
  filledAt: string
  /** The exact stored time of an edited fill: sent back unless the field was changed. */
  filledAtOriginal?: number
  notes: string
}

export type Mapped = { input: FillInput } | { problem: string }

/** Cylinder quick picks: label → water volume in litres. */
export const CYLINDER_SIZES: readonly QuickChip[] = [
  { label: '2 L', value: '2' },
  { label: '3 L', value: '3' },
  { label: '7 L', value: '7' },
  { label: '10 L', value: '10' },
  { label: '12 L', value: '12' },
  { label: '15 L', value: '15' },
  { label: '2×7 L', value: '14' },
  { label: '2×12 L', value: '24' },
  { label: '40 cuft', value: '5.7' },
  { label: '80 cuft', value: '11.1' },
]

/**
 * Less usual sizes, behind "More sizes". A cuft rating is the gas a cylinder holds when full, not
 * its size, so each maps to a water volume: Luxfer aluminium up to 80, Faber high-pressure steel
 * for 100 and 120.
 */
export const MORE_CYLINDER_SIZES: readonly QuickChip[] = [
  { label: '5 L', value: '5' },
  { label: '8.5 L', value: '8.5' },
  { label: '18 L', value: '18' },
  { label: '2×10 L', value: '20' },
  { label: '13 cuft', value: '1.9' },
  { label: '19 cuft', value: '2.9' },
  { label: '30 cuft', value: '4.3' },
  { label: '63 cuft', value: '9' },
  { label: '100 cuft', value: '12.9' },
  { label: '120 cuft', value: '15.3' },
  { label: '2×80 cuft', value: '22.2' },
]

/** The gases offered as "+ …" buttons, in the usual blending order. */
export const STAGE_GASES: readonly { gasClass: GasClass; label: string }[] = [
  { gasClass: 'HELIUM', label: 'He' },
  { gasClass: 'OXYGEN', label: 'O2' },
  { gasClass: 'NITROX', label: 'Nitrox' },
  { gasClass: 'TRIMIX', label: 'Trimix' },
]

let nextKey = 1
export function newStage(source: StageSource, pressureAfter = '', bankGaugeAfter = ''): StageDraft {
  return { key: nextKey++, source, pressureAfter, bankGaugeAfter }
}

/** The bank of a gas class with the most usable gas: the natural default source. */
export function fullestBank(banks: VesselSummary[], gasClass: GasClass): VesselSummary | undefined {
  return banks
    .filter((bank) => bank.status === 'IN_SERVICE' && bank.gasClass === gasClass)
    .toSorted((a, b) => b.usableContentLitres - a.usableContentLitres)[0]
}

/** The usual trimix order: He, then O2, then air (rows only for gases the team has). */
export function defaultStages(banks: VesselSummary[]): StageDraft[] {
  const stages: StageDraft[] = []
  for (const gasClass of ['HELIUM', 'OXYGEN'] as const) {
    const bank = fullestBank(banks, gasClass)
    if (bank) stages.push(newStage({ type: 'VESSEL', vesselId: bank.vesselId }))
  }
  stages.push(newStage({ type: 'AIR' }))
  return stages
}

export function emptyDraft(
  banks: VesselSummary[],
  memberId: number,
  waterVolume: string,
): FillDraft {
  return {
    intoVesselId: null,
    waterVolume,
    cylinderLabel: '',
    chargedMemberId: memberId,
    startPressure: '0',
    startO2: '',
    startHe: '',
    stages: defaultStages(banks),
    analysisO2: '',
    analysisHe: '',
    filledAt: '',
    notes: '',
  }
}

const percent = (fraction: number) => String(Math.round(fraction * 1000) / 10)

/** An existing fill back into the form (edit), gauges included so the edit keeps them. */
export function draftFromFill(fill: Fill): FillDraft {
  const target = fill.target
  return {
    intoVesselId: target.type === 'VESSEL' ? target.vesselId : null,
    waterVolume: target.type === 'CYLINDER' ? String(target.waterVolumeLitres) : '',
    cylinderLabel: target.type === 'CYLINDER' ? (target.cylinderLabel ?? '') : '',
    chargedMemberId: target.type === 'CYLINDER' ? target.chargedMemberId : fill.recordedBy.memberId,
    startPressure: String(fill.startPressureBar),
    startO2: percent(fill.startMix.o2),
    startHe: percent(fill.startMix.he),
    stages: fill.stages.map((stage) =>
      newStage(
        stage.source.type === 'VESSEL'
          ? { type: 'VESSEL', vesselId: stage.source.vesselId }
          : { type: 'AIR' },
        String(stage.pressureAfterBar),
        stage.sourcePressureAfterBar === undefined ? '' : String(stage.sourcePressureAfterBar),
      ),
    ),
    analysisO2: fill.endAnalysis ? percent(fill.endAnalysis.o2) : '',
    analysisHe: fill.endAnalysis ? percent(fill.endAnalysis.he) : '',
    filledAt: toLocalInput(fill.filledAt),
    filledAtOriginal: fill.filledAt,
    notes: fill.notes ?? '',
  }
}

/** O2/He percent fields to a mix; both empty → undefined (the backend's default applies). */
function mixOf(o2: string, he: string, what: string): Mix | undefined | string {
  if (o2.trim() === '' && he.trim() === '') return undefined
  const o2Percent = o2.trim() === '' ? 0 : parseDecimal(o2)
  const hePercent = he.trim() === '' ? 0 : parseDecimal(he)
  if (o2Percent === null || hePercent === null) return `${what}: enter O2 and He in %.`
  return { o2: o2Percent / 100, he: hePercent / 100 }
}

/** Form → API request, or the first thing that can't be parsed. */
export function toFillInput(draft: FillDraft): Mapped {
  let target: FillInput['target']
  if (draft.intoVesselId !== null) {
    target = { type: 'VESSEL', vesselId: draft.intoVesselId }
  } else {
    const waterVolumeLitres = parseDecimal(draft.waterVolume)
    if (waterVolumeLitres === null) return { problem: 'Choose the cylinder size.' }
    const cylinderLabel = draft.cylinderLabel.trim()
    target = {
      type: 'CYLINDER',
      waterVolumeLitres,
      chargedMemberId: draft.chargedMemberId,
      ...(cylinderLabel ? { cylinderLabel } : {}),
    }
  }

  const startPressureBar = parseDecimal(draft.startPressure)
  if (startPressureBar === null) return { problem: 'Enter the start pressure.' }
  const startMix = mixOf(draft.startO2, draft.startHe, 'Start mix')
  if (typeof startMix === 'string') return { problem: startMix }
  const endAnalysis = mixOf(draft.analysisO2, draft.analysisHe, 'Analyser reading')
  if (typeof endAnalysis === 'string') return { problem: endAnalysis }

  if (draft.stages.length === 0) return { problem: 'Add at least one gas.' }
  const stages: FillInput['stages'] = []
  for (const [index, stage] of draft.stages.entries()) {
    const pressureAfterBar = parseDecimal(stage.pressureAfter)
    if (pressureAfterBar === null) return { problem: `Enter the pressure after gas ${index + 1}.` }
    const gaugeText = stage.source.type === 'VESSEL' ? stage.bankGaugeAfter.trim() : ''
    const gauge = gaugeText === '' ? null : parseDecimal(gaugeText)
    if (gaugeText !== '' && gauge === null) {
      return { problem: `Bank gauge after gas ${index + 1} is not a number.` }
    }
    stages.push({
      source: stage.source,
      pressureAfterBar,
      ...(gauge !== null ? { sourcePressureAfterBar: gauge } : {}),
    })
  }

  // the field only has minutes: an unchanged time keeps its seconds (and its order among events)
  const unchanged =
    draft.filledAtOriginal !== undefined && draft.filledAt === toLocalInput(draft.filledAtOriginal)
  const filledAt = unchanged
    ? draft.filledAtOriginal
    : draft.filledAt
      ? fromLocalInput(draft.filledAt)
      : undefined
  const notes = draft.notes.trim()
  return {
    input: {
      target,
      startPressureBar,
      stages,
      ...(startMix ? { startMix } : {}),
      ...(endAnalysis ? { endAnalysis } : {}),
      ...(filledAt !== undefined ? { filledAt } : {}),
      ...(notes ? { notes } : {}),
    },
  }
}

/** A fill known only from the bank's gauge (DOMAIN §5.7), as typed in the form. */
export interface BankDrawDraft {
  vesselId: number
  before: string
  after: string
  chargedMemberId: number
  filledAt: string
  filledAtOriginal?: number
  notes: string
}

/** A bank's estimated level as a starting value for a gauge field. */
export function gaugeOf(bank: VesselSummary): string {
  return String(Math.round(bank.estimatedPressureBar))
}

/** Starts from the bank with the most usable gas, at its estimated level. */
export function emptyBankDraw(banks: VesselSummary[], memberId: number): BankDrawDraft {
  const bank = banks
    .filter((candidate) => candidate.status === 'IN_SERVICE')
    .toSorted((a, b) => b.usableContentLitres - a.usableContentLitres)[0]
  return {
    vesselId: bank?.vesselId ?? 0,
    before: bank ? gaugeOf(bank) : '',
    after: '',
    chargedMemberId: memberId,
    filledAt: '',
    notes: '',
  }
}

/** A stored bank draw back into the form (edit). */
export function bankDrawFromFill(fill: Fill): BankDrawDraft {
  const stage = fill.stages[0]
  return {
    vesselId: stage?.source.type === 'VESSEL' ? stage.source.vesselId : 0,
    before: String(fill.startPressureBar),
    after: String(fill.endPressureBar),
    chargedMemberId: fill.target.type === 'BANK_DRAW' ? fill.target.chargedMemberId : 0,
    filledAt: toLocalInput(fill.filledAt),
    filledAtOriginal: fill.filledAt,
    notes: fill.notes ?? '',
  }
}

/** Form → API request: the pressures are the bank's, so the one stage's "after" is its gauge. */
export function toBankDrawInput(draft: BankDrawDraft): Mapped {
  if (draft.vesselId === 0) return { problem: 'Add a bank first.' }
  const startPressureBar = parseDecimal(draft.before)
  if (startPressureBar === null) return { problem: 'Enter the bank pressure before.' }
  const pressureAfterBar = parseDecimal(draft.after)
  if (pressureAfterBar === null) return { problem: 'Enter the bank pressure now.' }
  const unchanged =
    draft.filledAtOriginal !== undefined && draft.filledAt === toLocalInput(draft.filledAtOriginal)
  const filledAt = unchanged
    ? draft.filledAtOriginal
    : draft.filledAt
      ? fromLocalInput(draft.filledAt)
      : undefined
  const notes = draft.notes.trim()
  return {
    input: {
      target: { type: 'BANK_DRAW', chargedMemberId: draft.chargedMemberId },
      startPressureBar,
      stages: [{ source: { type: 'VESSEL', vesselId: draft.vesselId }, pressureAfterBar }],
      ...(filledAt !== undefined ? { filledAt } : {}),
      ...(notes ? { notes } : {}),
    },
  }
}
