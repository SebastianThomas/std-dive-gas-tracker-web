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
export const CYLINDER_SIZES: readonly { label: string; litres: string }[] = [
  { label: '7 L', litres: '7' },
  { label: '10 L', litres: '10' },
  { label: '12 L', litres: '12' },
  { label: '15 L', litres: '15' },
  { label: '2×7 L', litres: '14' },
  { label: '2×12 L', litres: '24' },
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
