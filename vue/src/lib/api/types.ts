// Readable names for the generated contract (schema.d.ts, from the backend's OpenAPI document).
// Never declare a backend DTO by hand - add an alias here instead (AGENTS.md hard rule 6).
import type { components } from './schema'

type Schemas = components['schemas']

export type Me = Schemas['MeResponse']
export type TeamSummary = Schemas['TeamSummary']
export type Team = Schemas['Team']
export type TeamInput = Schemas['TeamInput']
export type Role = Team['role']
export type LossPolicy = Team['defaultLossPolicy']

export type Member = Schemas['Member']
export type MemberStatus = Member['status']
export type MemberRef = Schemas['MemberRef']
export type AddMemberRequest = Schemas['AddMemberRequest']
export type UpdateMemberRequest = Schemas['UpdateMemberRequest']

export type Mix = Schemas['GasMix']
export type VesselSummary = Schemas['VesselSummary']
export type VesselDetail = Schemas['VesselDetail']
export type VesselCreate = Schemas['VesselCreate']
export type VesselUpdate = Schemas['VesselUpdate']
export type CostLine = Schemas['CostLine']
export type CostLineInput = Schemas['CostLineInput']
export type Reading = Schemas['Reading']
export type ReadingInput = Schemas['ReadingInput']
export type LossReport = Schemas['LossReport']
export type GasClass = VesselSummary['gasClass']
export type VesselStatusFilter = 'IN_SERVICE' | 'CLOSED' | 'ALL'

export type FillInput = Schemas['FillInput']
export type FillInputStage = Schemas['FillInputStage']
export type FillTarget = Schemas['FillTargetCylinder'] | Schemas['FillTargetVessel']
export type StageSource = Schemas['StageSourceVessel'] | Schemas['StageSourceAir']
export type FillPreview = Schemas['FillPreview']
export type Fill = Schemas['Fill']
export type FillSummary = Schemas['FillSummary']
export type FillPage = Schemas['PageFillSummary']
export type StageResult = Schemas['StageResult']
export type FillWarning = Schemas['Warning']

export type Balances = Schemas['Balances']
export type MemberBalance = Schemas['MemberBalance']
export type Suggestion = Schemas['Suggestion']
export type Payment = Schemas['Payment']
export type PaymentInput = Schemas['PaymentInput']

export type ConsumptionReport = Schemas['ConsumptionReport']
export type ConsumptionRow = Schemas['ConsumptionRow']
export type LossesReport = Schemas['LossesReport']
export type PolicyComparison = Schemas['PolicyComparison']
