# API.md — Gas Tracker REST contract (v1)

Design-level contract between `std-dive-gas-tracker` (backend) and this frontend. Field names
here are binding on both sides. Once task D8 lands, the frontend's TypeScript types are
**generated** from the backend's OpenAPI document (`vue/src/lib/api/schema.d.ts`) and that becomes
the compile-time contract; this file stays the design reference (update it in the same change as
the code). Semantics live in `DOMAIN.md` (§ references below).

**Minimal by design:** 6 resource groups, no endpoint without a screen that needs it. Adding an
endpoint or field needs a DECISIONS entry.

## Conventions

- Base URL: `VITE_BACKEND_URL` (local `http://localhost:8090`). All endpoints under `/v1` need
  `Authorization: Bearer <dive-logger access JWT>` (see "Auth").
- JSON camelCase. Ids: numbers (int64). Time: epoch millis. Pressure: gauge bar. Volumes: surface
  litres. Fractions: `0..1`. **Money: decimal strings** (`"12.30"`), currency = team currency.
- An optional field (`?` below) without a value is **left out, never `null`** (global Jackson
  NON_NULL), matching the generated types.
- Errors: RFC 9457 ProblemDetail `{ type, title, status, detail, instance }`. 400 invalid input,
  401 no/invalid token, 403 member lacks role, **404 unknown or not-your-team** (never 403 for
  non-members), 409 state conflict (e.g. closing a closed vessel).
- Only the fills list is paged: `Page<T> = { result: T[]; page: number; size: number;
  totalElements: number; totalPages: number }`, `?page=0&size=50` (max 200). Everything else is
  small per team and returned whole.

## Auth

The gas backend issues no tokens in production. The frontend logs in against the **dive-logger
ws** (`VITE_AUTH_URL`): `POST /api/auth/login {email,password}` → `{accessToken}` + httpOnly
refresh cookie; `POST /api/auth/refresh` (cookie) → raw JWT string; `POST /api/auth/logout`.
Tokens are opaque to the frontend.

Access tokens (task B0) are signed by the dive logger with **Ed25519 (EdDSA)**; the gas backend
holds only **public** keys, so it can verify but never mint dive-logger tokens. Header `kid`
selects the key (rotation: configure old and new public key during a switch). Required claims:
`iss = "std-dive-logger"`, `uid` (dive-logger user id — the gas-tracker identity), `sub` (email,
the cached contact address), `exp`, and in production `email_verified: true`. Gas config:
`ch.sthomas.stddivegastracker.auth.public-keys` (list of PEM Ed25519 public keys),
`…auth.issuer`, `…auth.require-email-verified-claim`.

Local/dev only (profile `dev-login`, never in prod): the backend generates an ephemeral Ed25519
key pair at startup and also accepts tokens signed with it; `POST /api/dev/login {email}` →
`{accessToken}` (12 h, `email_verified: true`, `uid` = a stable **negative** id derived from the
email, so it never collides with real dive-logger ids).

## Shared types

```ts
type LossPolicy = 'TRUE_UP' | 'POOLED'   // UI labels: "Exact per bank" / "Shared loss pool"
type Role = 'ADMIN' | 'MEMBER'
type MemberStatus = 'PENDING' | 'ACTIVE' | 'LEFT'
type VesselStatus = 'IN_SERVICE' | 'CLOSED'
type GasClass = 'OXYGEN' | 'HELIUM' | 'AIR' | 'NITROX' | 'TRIMIX'
type Money = string                       // "123.45"
interface Mix { o2: number; he: number }  // n2 implied
interface Warning { code: 'ANALYSIS_MISMATCH' | 'SOURCE_OVERDRAWN'; message: string;
  stageIndex?: number }
interface MemberRef { memberId: number; displayName: string }
```

## 1. Me and teams

| Method | Path | Body → Response |
|---|---|---|
| GET | `/v1/me` | → `Me` |
| PUT | `/v1/me` | `{ displayName }` → `Me` |
| POST | `/v1/teams` | `TeamInput` → `Team` (caller becomes ADMIN) |
| GET | `/v1/teams/{teamId}` | → `Team` |
| PUT | `/v1/teams/{teamId}` | ADMIN `TeamInput` → `Team` |

```ts
interface Me { userId: number; email: string; displayName: string; teams: TeamSummary[] }
interface TeamSummary { teamId: number; name: string; role: Role; memberId: number }
interface TeamInput { name: string; currency?: string /* default CHF */;
  defaultLossPolicy: LossPolicy; lineDeadVolumeLitres?: number /* default 0 */;
  defaultResidualPressureBar?: number /* default 0 */ }
interface Team extends TeamSummary { currency: string; defaultLossPolicy: LossPolicy;
  lineDeadVolumeLitres: number; defaultResidualPressureBar: number }
```

## 2. Members

| Method | Path | Body → Response |
|---|---|---|
| GET | `/v1/teams/{teamId}/members` | → `Member[]` (ACTIVE, then PENDING, then LEFT) |
| POST | `/v1/teams/{teamId}/members` | ADMIN `{ email, role? }` → `Member` (known user → ACTIVE; unknown email → PENDING, bound on that person's first sign-in with this verified email; LEFT → reactivated; 409 if already ACTIVE or PENDING) |
| PUT | `/v1/teams/{teamId}/members/{memberId}` | ADMIN `{ role?, status? }` → `Member` |
| POST | `/v1/teams/{teamId}/members/me/leave` | → 204 (not the last ADMIN) |

```ts
interface Member { memberId: number; email?: string /* invited email while PENDING; missing while the address belongs to another account; shown as displayName only */;
  displayName: string /* email local part while PENDING */; role: Role; status: MemberStatus;
  joinedAt: number; leftAt?: number }
```

## 3. Vessels (banks)

| Method | Path | Body → Response |
|---|---|---|
| GET | `/v1/teams/{teamId}/vessels?status=IN_SERVICE\|CLOSED\|ALL` | → `VesselSummary[]` (default IN_SERVICE) |
| POST | `/v1/teams/{teamId}/vessels` | `VesselCreate` → `VesselDetail` |
| GET | `/v1/teams/{teamId}/vessels/{vesselId}` | → `VesselDetail` |
| PUT | `/v1/teams/{teamId}/vessels/{vesselId}` | `VesselUpdate` → `VesselDetail` |
| POST | `/v1/teams/{teamId}/vessels/{vesselId}/close` | `{ closingPressureBar, closedAt? }` → `VesselDetail` |
| POST | `/v1/teams/{teamId}/vessels/{vesselId}/reopen` | ADMIN → `VesselDetail` |
| POST | `/v1/teams/{teamId}/vessels/{vesselId}/cost-lines` | `CostLineInput` → `VesselDetail` |
| DELETE | `/v1/teams/{teamId}/vessels/{vesselId}/cost-lines/{costLineId}` | ADMIN → `VesselDetail` |
| POST | `/v1/teams/{teamId}/vessels/{vesselId}/readings` | `{ pressureBar, measuredAt? }` → `VesselDetail` |

Sub-resource writes return the whole `VesselDetail` so the screen just re-renders. A wrong cost
line is deleted and re-added (no edit endpoint).

```ts
interface VesselCreate { label: string; waterVolumeLitres: number; mix: Mix;
  initialPressureBar?: number /* default 0 */; expectedResidualPressureBar?: number
  /* default team.defaultResidualPressureBar */; lossPolicy?: LossPolicy
  /* default team.defaultLossPolicy */; openedAt?: number; notes?: string;
  initialCostLines?: CostLineInput[] /* one per person who paid; default none */ }
interface VesselUpdate { label?: string; notes?: string; expectedResidualPressureBar?: number;
  mix?: Mix /* ADMIN */; lossPolicy?: LossPolicy /* ADMIN, IN_SERVICE only */ }
interface VesselSummary { vesselId: number; label: string; gasClass: GasClass; mix: Mix;
  waterVolumeLitres: number; status: VesselStatus; lossPolicy: LossPolicy;
  estimatedPressureBar: number; estimatedContentLitres: number; usableContentLitres: number;
  rate: Money /* per litre, 4 decimals */; rateIsEstimate: boolean /* DOMAIN §7.1 provisional */;
  openedAt: number; closedAt?: number }
interface VesselDetail extends VesselSummary { initialPressureBar: number;
  expectedResidualPressureBar: number; closingPressureBar?: number; notes?: string;
  createdBy: MemberRef; totalCost: Money; allocated: Money; unallocated: Money;
  inflowLitres: number; drawnLitres: number; bookContentLitres: number;
  costLines: CostLine[]; readings: Reading[]; lossReport?: LossReport }
interface CostLineInput { payerMemberId: number; amount: Money; paidAt?: number; note?: string }
interface CostLine extends CostLineInput { costLineId: number; payer: MemberRef }
interface Reading { readingId: number; pressureBar: number; measuredAt: number;
  createdBy: MemberRef; bookPressureBar: number; discrepancyLitres: number }
interface LossReport { inflowLitres: number; drawnLitres: number; lineLossLitres: number;
  residualLitres: number; unaccountedLitres: number; lossFraction: number;
  lossAmount?: Money /* POOLED */; writeOffAmount?: Money /* TRUE_UP, no draws */ }
```

## 4. Fills

| Method | Path | Body → Response |
|---|---|---|
| GET | `/v1/teams/{teamId}/fills?memberId&vesselId&includeVoided&page&size` | → `Page<FillSummary>` (newest first) |
| POST | `/v1/teams/{teamId}/fills/preview?replacing` | `FillInput` → `FillPreview` (computes, saves nothing; `replacing={fillId}` previews an edit of that fill, priced as replacing it) |
| POST | `/v1/teams/{teamId}/fills` | `FillInput` → `Fill` |
| GET | `/v1/teams/{teamId}/fills/{fillId}` | → `Fill` |
| PUT | `/v1/teams/{teamId}/fills/{fillId}` | `FillInput` → `Fill` |
| POST | `/v1/teams/{teamId}/fills/{fillId}/void` | `{ reason }` → `Fill` |

```ts
interface FillInput { filledAt?: number;
  target: { type: 'CYLINDER'; waterVolumeLitres: number; cylinderLabel?: string;
            chargedMemberId: number }
        | { type: 'VESSEL'; vesselId: number }
        | { type: 'BANK_DRAW'; chargedMemberId: number } /* DOMAIN §5.7: one VESSEL stage; the
            pressures are the bank's: startPressureBar before, pressureAfterBar after */;
  startPressureBar: number; startMix?: Mix /* default AIR */;
  stages: { source: { type: 'VESSEL'; vesselId: number } | { type: 'AIR' };
            pressureAfterBar: number; sourcePressureAfterBar?: number }[];
  endAnalysis?: Mix; notes?: string }
interface StageResult { index: number;
  source: { type: 'VESSEL'; vesselId: number; label: string } | { type: 'AIR' };
  sourceMix: Mix; pressureAfterBar: number; addedLitres: number; addedO2Litres: number;
  addedHeLitres: number; lineLossLitres: number; drawLitres: number; charge: Money;
  isEstimate: boolean; sourcePressureAfterBar?: number /* the bank gauge as entered; send it
  back on edit, else the edit drops that reading */ }
interface FillPreview { endPressureBar: number; endMix: Mix; stages: StageResult[];
  totalCharge: Money; warnings: Warning[] }
interface Fill extends FillPreview { fillId: number; filledAt: number;
  target: FillInput['target'] & { vesselLabel?: string }; chargedMember?: MemberRef;
  recordedBy: MemberRef; startPressureBar: number; startMix: Mix; endAnalysis?: Mix;
  notes?: string; status: 'ACTIVE' | 'VOIDED'; voidReason?: string; calcModelVersion: string;
  createdAt: number; updatedAt: number }
interface FillSummary { fillId: number; filledAt: number; chargedMember?: MemberRef;
  targetLabel: string; endPressureBar: number; endMix: Mix; heLitres: number; o2Litres: number;
  totalCharge: Money; status: 'ACTIVE' | 'VOIDED' }
```

## 5. Balances and payments

| Method | Path | Body → Response |
|---|---|---|
| GET | `/v1/teams/{teamId}/balances` | → `Balances` |
| GET | `/v1/teams/{teamId}/payments` | → `Payment[]` (newest first) |
| POST | `/v1/teams/{teamId}/payments` | `{ fromMemberId, toMemberId, amount, paidAt?, note? }` → `Payment` |
| DELETE | `/v1/teams/{teamId}/payments/{paymentId}` | payer, recipient or ADMIN → 204 |

```ts
interface Balances { currency: string; members: MemberBalance[]; inventoryValue: Money;
  suggestions: { from: MemberRef; to: MemberRef; amount: Money }[] }
interface MemberBalance { member: MemberRef; paidCosts: Money; fillCharges: Money;
  lossShares: Money; paymentsSent: Money; paymentsReceived: Money; balance: Money;
  provisionalCharges: Money /* part of fillCharges that is still an estimate (§7.1) */ }
interface Payment { paymentId: number; from: MemberRef; to: MemberRef; amount: Money;
  paidAt: number; note?: string; createdBy: MemberRef }
```

## 6. Reports

| Method | Path | Response |
|---|---|---|
| GET | `/v1/teams/{teamId}/reports/consumption?from&to` | `{ rows: { member: MemberRef; o2Litres: number; heLitres: number; fills: number; charge: Money }[] }` — members with ≥ 1 cylinder fill in `[from, to)` (epoch millis, both optional), most expensive first; litres = bought gas only; charges at today's prices |
| GET | `/v1/teams/{teamId}/reports/losses` | `{ vessels: { vessel: VesselSummary; report: LossReport }[] }` (closed vessels) |
| GET | `/v1/teams/{teamId}/reports/policy-comparison` | `{ members: { member: MemberRef; trueUp: Money; pooled: Money; delta: Money }[] }` (DOMAIN §7.6; balances incl. payments; `delta` = shown `pooled` − shown `trueUp`) |

## 7. Scrubber (DOMAIN §12)

Every write answers with the whole `ScrubberCanister`.

| Method | Path | Body → result |
|---|---|---|
| GET | `/v1/teams/{teamId}/scrubbers` | → `ScrubberCanister[]` (newest first) |
| POST | `/v1/teams/{teamId}/scrubbers` | `CanisterCreate` |
| GET | `/v1/teams/{teamId}/scrubbers/{canisterId}` | → `ScrubberCanister` |
| POST | `…/{canisterId}/uses` | `ScrubberUseInput` |
| DELETE | `…/{canisterId}/uses/{useId}` | |
| POST | `…/{canisterId}/empty` | `{ emptiedAt?: number }` or no body (now) |
| POST | `…/{canisterId}/reopen` | ADMIN |
| POST | `…/{canisterId}/cost-lines` | `CostLineInput` |
| DELETE | `…/{canisterId}/cost-lines/{costLineId}` | ADMIN |

```ts
interface CanisterCreate { label: string; capacityKg?: number /* default 23 */;
  openedAt?: number; initialCostLines?: CostLineInput[] }
interface ScrubberUseInput { memberId: number; kg: number; usedAt?: number }
interface ScrubberCanister { canisterId: number; label: string; status: 'OPEN' | 'EMPTY';
  capacityKg: number; recordedKg: number; remainingKg: number; totalCost: Money;
  pricePerKg: Money /* 4 dp */; isEstimate: boolean; openedAt: number; emptiedAt?: number;
  createdBy: MemberRef; costLines: { costLineId: number; payer: MemberRef; amount: Money;
    paidAt: number; note?: string }[];
  uses: { useId: number; member: MemberRef; kg: number; charge: Money; usedAt: number;
    recordedBy: MemberRef }[] /* newest first */ }
```

`Team` and `TeamInput` carry `gasTrackingEnabled` and `scrubberTrackingEnabled` (absent in a
`TeamInput`: unchanged, on for a new team). Off: creating a bank, a fill, a canister or a use answers
409. `Balances.members[]` carry `scrubberPaid` and `scrubberCharges`; `provisionalCharges` includes
charges from canisters not yet empty, `inventoryValue` what is paid but not yet charged.
