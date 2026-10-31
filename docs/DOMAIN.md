# DOMAIN.md — Gas Tracker domain specification

The single source of truth for **what** the gas tracker computes. Backend code (`calc`, `service`)
implements it; the frontend only displays what the backend returns. If code and this file
disagree, the code is wrong — or this file gets a reviewed change first (log it in
`docs/DECISIONS.md`). Section numbers (§) are stable and referenced from `PLAN.md` tasks and code
comments (`// DOMAIN §7.3`).

**Scope rule:** v1 builds exactly what this file specifies and nothing more. Sections marked
**BACKLOG** are kept for later and must not be implemented in v1. Prefer the simplest design that
satisfies a section; new concepts, states, settings or options need a reviewed DECISIONS entry.

---

## §1 Purpose

Divers share a gas-blending room. They buy **banks** of O2 and He (sometimes pre-blended mixes),
blend into their own cylinders (partial-pressure blending, often through a booster) and top up
with **compressor air, which is free**. The app:

1. tracks **inventory** of every storage vessel (pure gases and in-house blended mixes),
2. records every **fill** (who took how much of which gas, from which vessel),
3. allocates every vessel's **cost** to the divers who drew from it, **including losses**
   (booster residual, line bleeds, leaks, unrecorded fills), under a per-team **loss policy**,
4. keeps a **balance** per member (bought banks = credit, consumed gas = debit) and suggests who
   pays whom.

Out of scope for v1 (see `PLAN.md` backlog): offline recording, other consumables (absorbent,
filters, compressor hours), links to dives in the dive logger, continuous/membrane nitrox blending,
the blend planner (§9), analysis-only fill entry (§5.3), several rooms per team, member ledgers and
"as of" statements, payment confirmation, invitations.

---

## §2 Glossary and entities

| Term | Meaning |
|---|---|
| **User** | A person, identified by their **dive-logger user id** (JWT claim `uid`) — the same id in both systems, so a change of email in the dive logger affects nothing here. The gas tracker keeps a small local row (`t_user`: id = dive-logger id, `username`, `displayName`), created on the first authenticated request; a changed username is updated, and another local user still holding it (stale) loses it. **The email stays with the dive logger: it is never stored or shown here.** `displayName` is gas-tracker-local: it starts from the username and can be changed. |
| **Team** | The tenant and accounting unit ("our group is a team"; one team = one shared blending room). Owns vessels, fills, payments and settings: `name`, `currency` (ISO 4217, default `CHF`), `defaultLossPolicy` (§7), `lineDeadVolumeLitres` (≥ 0, default 0 = feature off, §5.5), `defaultResidualPressureBar` (≥ 0, default 0; UI hint: ≈ highest fill pressure ÷ booster max ratio), `gasTrackingEnabled` and `scrubberTrackingEnabled` (each default on, independent: off hides that area and refuses new bank, fill or canister/use records; what exists stays readable, correctable and in the balances). A user can be in several teams. |
| **Username** | The dive logger account's unique name (its `name`, unique ignoring case), carried in the token's `username` claim and copied to the user row. It is how teammates identify each other: **an email address is never shown to teammates**, and a new user's display name starts from the username. |
| **Invite link** | A team's optional secret link (`inviteToken`; an admin creates, replaces or turns it off). Turned off, it keeps its token and can be turned on again; replaced, the old one is dead for good. Anyone signed in who holds it joins as MEMBER; someone who left or was removed cannot rejoin through it. |
| **Member** | A membership in one team: `role` (`ADMIN` \| `MEMBER`), `status` (`ACTIVE` \| `LEFT`), `joinedAt`, `leftAt`. An admin adds someone by username (they must have used the app once), or anyone joins through the team's invite link. Nobody is invited by email, and a member is always a user. **All money references a member, never a user.** |
| **Vessel** | A storage container (bank, bundle, large cylinder) — bought pre-filled, or blended in-house by fills into it. `label`, `waterVolumeLitres`, declared `mix` (§3), `initialPressureBar` (pressure when registered; default 0), `status` (`IN_SERVICE` \| `CLOSED`), `openedAt`, `closedAt`, `closingPressureBar`, `lossPolicy` (§7, snapshot), `expectedResidualPressureBar`, `notes`. |
| **Cost line** | Money paid for a vessel: `vessel`, `payer` (member), `amount`, `paidAt`, `note` (e.g. "purchase", "rental Q3"). The payer is credited (§8). A vessel can have any number of cost lines, added any time (a rental invoice after closing re-prices that vessel's draws). |
| **Mix** | UI word for a vessel holding blended gas (gas class NITROX or TRIMIX), listed under the Blend tab: usually temporary, closed when used up. Not a separate entity. |
| **Fill** | One gas-filling operation into one **target**: a diver's cylinder (`targetType = CYLINDER`, `chargedMember` required) or another vessel (`targetType = VESSEL`, e.g. blending a house-mix bank; no charged member). Has `filledAt`, `recordedBy`, start state, ordered **stages**, optional end analysis, `notes`, `status` (`ACTIVE` \| `VOIDED` + `voidReason`). |
| **Stage** | One source feeding the target within a fill, in order: `source` = a vessel or `AIR` (compressor, free). Stores the computed volumes (§5.4). |
| **Draw** | Gas that left a vessel: one stage whose source is a vessel. `drawLitres = addedLitres + lineLossLitres`. The unit of cost allocation. |
| **Reading** | A measured vessel pressure at a time (inventory check, or a fill's recorded source pressure). Informational except `closingPressureBar`. |
| **Payment** | Money from one member to another to settle balances: `from`, `to`, `amount`, `paidAt`, `note`, `createdBy`. Counts as soon as it is recorded; the payer, the recipient or an admin can delete a wrong one. |
| **Loss share** | A member's share of a closed vessel's loss (POOLED) or write-off (TRUE_UP with no draws), §7. |

---

## §3 Units, numbers and conventions

- **Pressure**: bar, **gauge**, at every API boundary and in the DB (`…PressureBar`). Physics
  uses absolute pressure internally: `pAbs = pGauge + P_ATM`, `P_ATM = 1.01325` bar.
- **Volume**: litres. `waterVolumeLitres` = internal (water) volume. Gas amounts are **surface
  litres** (`…Litres`): the gas volume at `P_ATM` and `T_REF = 20 °C (293.15 K)`, ideal-gas
  normalised (i.e. proportional to moles). All temperatures are assumed `T_REF` (record settled
  pressures, not hot-fill pressures).
- **Mix**: fractions in `[0, 1]`: `o2`, `he`; `n2 = 1 − o2 − he`. Validate **each input**
  (`0 ≤ o2 ≤ 1`, `0 ≤ he ≤ 1`, `o2 + he ≤ 1 + 1e-9`) — never only the derived sum (dive-logger
  lesson: a derived-remainder check is tautological). Constants: `AIR = (o2 0.209, he 0)`,
  `OXYGEN = (1, 0)`, `HELIUM = (0, 1)`. Classification for reports: `OXYGEN` (o2 ≥ 0.99),
  `HELIUM` (he ≥ 0.99), `AIR` (|o2 − 0.209| ≤ 0.005 and he ≤ 0.005), `NITROX` (he ≤ 0.005),
  otherwise `TRIMIX` (includes heliox/heliair). Bounds are inclusive; code compares with a 1e-9
  tolerance so float noise (`|0.214 − 0.209|` > 0.005 in doubles) can't flip a label.
- **Money**: `BigDecimal`, never `double`. Stored `numeric(12,2)`. The allocation engine computes
  unrounded (`MathContext.DECIMAL128`); the API rounds `HALF_EVEN` to 2 decimals — except unit
  prices (per litre), which keep 4 decimals (CHF 0.0537/L). Physical values (litres, bar) go out
  unrounded; the frontend formats them. JSON carries
  money as a **string** (`"123.45"`); the frontend never does arithmetic on money except
  formatting. Per-fill amounts are display-rounded; member totals are `round(Σ unrounded)`, so a
  hand-sum of displayed fill charges may differ by a cent — documented, not a bug.
- **Time**: `Instant`, JSON epoch millis (same as the dive logger: `WRITE_DATES_AS_TIMESTAMPS`).
- **Physical limits** (validation, 400 on violation): water volume `(0, 5000]` L (cylinders
  realistically ≤ 50, banks up to a few thousand); pressures `[0, 400]` bar; money `[0, 1e9)`.

---

## §4 Gas physics

### §4.1 Content of a vessel/cylinder

```
contentLitres(Vw, pGauge, mix) = Vw · pAbs / (Z(pAbs, mix) · P_ATM)      pAbs = pGauge + P_ATM
```

An "empty" cylinder at 0 bar gauge still holds `Vw` litres (of whatever it last contained —
usually air). Component litres = `contentLitres · fraction`.

### §4.2 Compressibility model `Z(pAbs, mix)`

Interface `CompressibilityModel` with two implementations:

- `IdealGas`: `Z ≡ 1`. Used for hand-checkable tests and the worked examples in §11.
- `VirialFit` (production default): per pure gas `g ∈ {O2, N2, He}` at 293.15 K,
  `Z_g(p) − 1 = A_g·p + B_g·p² + C_g·p³` (p = absolute bar), coefficients least-squares fitted to
  **NIST Chemistry WebBook** isotherm data (task C2 in `PLAN.md` does the fit and commits the data
  as a test resource). Mixture: `Z_mix − 1 = Σ_g x_g · (Z_g − 1)` (mole-fraction-weighted;
  approximation good to ~1 % for diving mixes, documented on the class).
  Acceptance: fit within 0.3 % of NIST Z over 1–300 bar for each gas. Sanity value:
  He at 201 bar abs, 293.15 K → `Z = 1.0956` (NIST: ρ = 7.52673 mol/L).

A `calcModelVersion` string (e.g. `virial-nist-2026-1`) is stored on every fill so a model change
can trigger a recompute of stored volumes.

### §4.3 Inverse: pressure for a content

`pressureFor(Vw, contentLitres, mix)`: solve §4.1 for `pGauge` by bisection on `[0, 1000]` bar,
tolerance 1e-6 bar, ≤ 200 iterations (monotonic in p for all supported mixes). Used for inventory
estimates (§6) and the planner (§9, backlog). A content at or below `contentLitres(Vw, 0, mix)` returns
`0` (an overdrawn book estimate must not throw); a content above the 1000-bar content is an
`IllegalArgumentException`.

---

## §5 Fills

### §5.1 Inputs

- target: `CYLINDER` (`waterVolumeLitres`, optional `cylinderLabel`, `chargedMemberId`) or
  `VESSEL` (`targetVesselId`; water volume taken from the vessel).
- `startPressureBar`, `startMix` (what's in the target before filling; default AIR; for a VESSEL
  target default = the vessel's declared mix).
- ordered `stages[]`: each `{ sourceVesselId | AIR, pressureAfterBar? , sourcePressureAfterBar? }`
  (`sourcePressureAfterBar` = the bank gauge after the stage, optional → becomes a Reading).
- optional `endAnalysis: { o2, he }` (analyser reading after the fill).
- `filledAt` (default now), `notes`.

Source mix of a stage = the source vessel's **declared** mix at fill time, **snapshotted on the
stage** (`sourceO2`, `sourceHe`); AIR stages use `AIR`. Editing a fill keeps snapshots unless the
stage's source changes. (Declared, not computed, mix: a bank's mix is what was analysed; avoids
order-dependent cascades.)

### §5.2 Computing a fill from stage pressures (the only entry mode in v1)

Every stage has `pressureAfterBar` (what the gauge read after that gas — how partial-pressure
blending is done anyway); they must be strictly increasing and the first must be
`> startPressureBar`. Stage by stage, with `L_{k−1}`, `mix_{k−1}` the state before stage k and
`m_k` the source mix, find added amount `a_k ≥ 0` such that

```
contentLitres(Vw, p_k, mix(a_k)) = L_{k−1} + a_k
mix(a) = (L_{k−1}·mix_{k−1} + a·m_k) / (L_{k−1} + a)
```

solved by bisection on `a ∈ [0, contentLitres(Vw, p_k, m_k)·2]`, tolerance 1e-6 L. With `IdealGas`
this is closed-form `a_k = Vw·(p_k − p_{k−1})/P_ATM`. If `endAnalysis` is given, compare it with the
computed end mix; `|Δo2| > 0.01` or `|Δhe| > 0.01` → warning `ANALYSIS_MISMATCH` (saved anyway).

### §5.3 BACKLOG — entry mode `ANALYSIS` (only end pressure + analysed mix known)

Not in v1 (kept for a later version; the fill API has no `entryMode` until then).

Stages list sources only (at most 3, pairwise-different mixes); the last stage's
`pressureAfterBar` = end pressure is required, intermediate ones are ignored; `endAnalysis` is
required. End state is fully known: `L_end = contentLitres(Vw, p_end, endAnalysis)`. Unknowns
`a_1..a_n` satisfy, per component `c ∈ {o2, he, n2}`:

```
L_0·mix_0[c] + Σ_k a_k·m_k[c] = L_end·endAnalysis[c]
```

(3 equations; with n < 3 it is over-determined). Solve by least squares (normal equations, n ≤ 3;
Gaussian elimination with partial pivoting). Then:

- singular system (e.g. two sources with the same mix) → 400 `"Sources must have different mixes"`.
- any `a_k < −0.5` L → 400 `"Analysis is inconsistent with these sources (stage k would be
  negative)"`; `−0.5 ≤ a_k < 0` → clamp to 0.
- residual `max_c |reconstructed[c] − endAnalysis[c]|` > 0.01 → warning `ANALYSIS_RESIDUAL`.

Property (test): a `PRESSURES` fill's computed end mix fed back into `ANALYSIS` with the same
sources reproduces the same `a_k` within 1e-6 L.

### §5.4 Stored results per stage (denormalised, recomputed on every edit)

`addedLitres`, `addedO2Litres`, `addedHeLitres` (= `a_k · m_k[c]`), `lineLossLitres`,
`drawLitres = addedLitres + lineLossLitres` (vessel sources only; AIR has no draw). Fill-level:
`endPressureBar`, computed `endMix`, `warnings[]`, `calcModelVersion`. **Money is never stored on
a fill** — it is computed at read time (§7), because true-ups change it.

### §5.5 Line loss

For a vessel stage, `lineLossLitres = team.lineDeadVolumeLitres · p_k / P_ATM` (whip + booster
outlet volume vented after the stage, at the stage's end pressure; ideal gas — the term is tiny).
It is part of that stage's draw, so the fill that vented it pays for it. With
`lineDeadVolumeLitres = 0` the feature is off.

### §5.6 Validation and rules

- Every source vessel and a VESSEL target belong to the fill's team; `filledAt` lies within each
  source vessel's `[openedAt, closedAt ?? ∞)` (backdated fills into the service window are
  allowed — the vessel just re-prices).
- A VESSEL target must be `IN_SERVICE` and opened by `filledAt` (an edit may keep the target it had
  after it closed, and a charged member who has left since — corrections stay possible); a fill from vessel S into
  T is rejected (400) if `S == T` or T is upstream of S (T's gas reached S through earlier
  transfers) — the transfer graph must stay a DAG (§7.4).
- A VESSEL-target fill with `endAnalysis` updates the target vessel's declared mix.
- A draw larger than the source's estimated remaining content (§6) → warning `SOURCE_OVERDRAWN`
  (gauges are imprecise), not an error.
- `VOIDED` fills are excluded from every computation; voiding needs a reason; voided fills stay
  visible in lists (struck through). Hard delete does not exist.

### §5.7 Bank draw: a fill known only from the bank's gauge

For gas taken without measuring a cylinder: target `BANK_DRAW` (`chargedMemberId`, no water volume),
one stage from one vessel (not AIR). Here `startPressureBar` and the stage's `pressureAfterBar` are
the **bank's** gauge before and after, with after < before (400 otherwise):

```
drawLitres = contentLitres(Vw_bank, before, m) − contentLitres(Vw_bank, after, m)
```

with `m` the source mix snapshot (§5.1), which is also `startMix` and `endMix`. `addedLitres =
drawLitres`, `lineLossLitres = 0` (whatever the line vented is already in the drop),
`sourcePressureAfterBar = after` and becomes a Reading, so the bank's estimate equals the gauge
(the "before" gauge is not a reading: a difference from the estimate stays visible as that
reading's discrepancy). No `endAnalysis`. Pricing, charging, voiding, editing and §5.6 are as for
a cylinder fill.

---

## §6 Vessels and inventory

Book content of a vessel is replayed in time order (same instant: inflows, then draws, then
readings — a gauge read with a fill shows the state after it — then by id):

1. open: `contentLitres(Vw, initialPressureBar, initialMix)` components (a bank bought full:
   its delivery pressure; a bank to be blended in-house: usually 0 bar → `Vw` litres of air).
   `initialMix` is the gas it was registered with; an analysis after blending changes only the
   declared mix (an admin's mix correction changes both while nothing was blended in yet).
2. inflow (fill with this vessel as target): `+ addedLitres` per component of each stage.
3. outflow (draw): `− drawLitres`, composition = the stage's snapshotted source mix.

`inflowLitres` (`V_in` in §7) = open content + Σ inflow `addedLitres`. Inventory endpoints show:
book content and mix, book pressure (§4.3), the **last reading** and the estimate
`lastReadingContent + events after it` (the better "what's left" number), and per reading the
**discrepancy** `book − measured` (unaccounted loss so far: leaks, unrecorded fills, gauge error).
Usable content = content above `expectedResidualPressureBar`. A book or estimated content above the
1000-bar content (inconsistent records) shows as 1000 bar instead of failing the team's inventory.

Closing a vessel (it goes back to the supplier / is emptied): requires `closingPressureBar`;
sets `status = CLOSED`, `closedAt`, and snapshots the **loss participants** (§7.3). `closedAt` lies
after `openedAt` and after the vessel's last (non-voided) fill and reading, so they all stay in its
service window `[openedAt, closedAt)`; a manual reading must lie in that window too (400 otherwise). An admin can
reopen (clears closing data and the snapshot) to correct mistakes.

Loss report per closed vessel: `V_in`, `drawnLitres = D`, `lineLossLitres` (Σ), residual at close
`contentLitres(Vw, closingPressureBar, mix)`, `unaccountedLitres = V_in − D − residual`, and
`lossFraction = (V_in − D) / V_in`.

---

## §7 Cost allocation (the core)

### §7.1 Inputs (pure function, no I/O)

The engine (`calc.allocation`) takes a snapshot of one team:

- vessels: `id`, `policy`, `status`, cost lines (`payerMemberId`, `amount`; `C_direct` = their
  sum), `V_in`, `V_res` = `contentLitres(Vw, expectedResidualPressureBar, mix)`, closing
  participants (member ids as snapshotted; closed vessels only, may be empty);
- draws: `sourceVesselId`, `litres`, beneficiary = `member(id)` (CYLINDER fill) or
  `vessel(id)` (VESSEL-target fill);
- team: `activeMemberIds` (members currently ACTIVE) — for the participant fallbacks of §7.3,
  which the **engine** applies (the stored snapshot stays as written).

Litres are `double` at the boundary (physical measurements) and are converted with
`BigDecimal.valueOf` inside the engine; every money operation is `BigDecimal` with
`MathContext.DECIMAL128`.

Optional `asOf`: the service filters facts (fills, cost lines, closings, payments) with timestamp
≤ `asOf` before calling the engine; a closing after `asOf` counts as still open.

Outputs: per vessel `rate`, `provisional`, `C` (total cost incl. upstream), `allocated`,
`unallocated`; per draw `charge`; per vessel loss shares; per member totals. All unrounded.

`provisional(v)` answers "can this price still change?": `v` is TRUE_UP and open, **or** any
vessel that drew into `v` is provisional (transitive over the transfer graph). The UI labels such
prices and the charges drawn at them "estimate".

### §7.2 Common definitions

```
C(v) = C_direct(v) + Σ charge(d) for draws d whose beneficiary is v      (upstream gas cost)
D(v) = Σ litres of draws from v
charge(d) = rate(source(d)) · litres(d)
allocated(v)   = Σ charge(d) for draws d from v  +  Σ loss/write-off shares of v
unallocated(v) = C(v) − allocated(v)            (0 for every closed vessel; inventory value if open)
```

A charge to a vessel beneficiary is an internal transfer (it becomes part of that vessel's `C`),
not a member charge.

**One price per vessel at any moment**: every draw from a vessel uses the same rate, so earlier
fills re-price when later facts arrive. That is intended (true-ups); balances are a running total.

### §7.3 Policies (`lossPolicy`, snapshotted on the vessel from `team.defaultLossPolicy` at creation; an admin may change it while the vessel is IN_SERVICE)

**`TRUE_UP`** — every vessel's full cost is shared by its draws, pro-rata to litres.

```
open:   rate = C / max(V_in − V_res, D)          (provisional; if both terms ≤ 0 → rate 0)
closed: D > 0 → rate = C / D                      (final; Σ charges = C exactly)
        D = 0 → rate undefined; C is a write-off split equally among the closing participants
```

**`POOLED`** — draws pay the nominal price of the gas; whatever wasn't drawn is a team loss.

```
always: rate = C / V_in                           (nominal; V_in = 0 → rate 0)
closed: loss = C − rate · D  (may be negative = a gain, e.g. gauge error)
        → split equally among the closing participants (negative shares are credits)
open:   no loss yet; C − rate · D is unallocated (inventory value)
```

**Closing participants** (snapshot written when the vessel is closed, in table
`t_vessel_loss_participant`): members of the team that are not LEFT and
`joinedAt ≤ closedAt` (a diver who no longer blends should be set LEFT). If the snapshot is empty, fall back to all
`ACTIVE` members; if still empty, the vessel's cost-line payers (pro-rata to what they paid). If even
that is empty the engine throws (unreachable in practice: a team always has an ACTIVE admin). A
closed TRUE_UP vessel with no draws reports rate 0; the UI shows "—" as its price.

### §7.4 House mixes and ordering

Draws into a vessel make its cost depend on its sources' rates, so vessels are evaluated in
**topological order** of the transfer graph (sources before targets). A cycle is a data error:
the service prevents it at write time (§5.6); the engine throws `IllegalStateException` if it
ever sees one. A source closing re-prices its downstream house mixes and their draws — that is
correct and expected.

### §7.5 Invariants (property-tested)

1. Conservation: `Σ_v C_direct(v) = Σ member fill charges + Σ loss shares + Σ_open v unallocated(v)`
   (unrounded; |Δ| < 1e-9). With every vessel closed and drawn from, unallocated = 0.
2. TRUE_UP closed vessel with draws: `Σ_d charge(d) = C(v)` with no rounding gap (unrounded;
   DECIMAL128 residue of a repeating rate ≤ 1e-20).
3. Balance identity (§8): `Σ_members balance = Σ_open v unallocated(v)` — payments cancel out.
4. Rates are never negative; a member's charges never depend on another team's data.
5. Order independence: shuffling input lists does not change any output.

### §7.6 Policy comparison

`GET …/reports/policy-comparison` runs the engine twice with every vessel's policy overridden to
`TRUE_UP` and to `POOLED`, and returns per-member balances side by side plus the delta — so a team
can choose its default with real data (the team hasn't decided yet; both must stay first-class).

---

## §8 Balances, payments, settling up

```
balance(member) =   Σ cost lines paid by member
                  − Σ fill charges of fills charged to member
                  − Σ loss shares of member
                  + Σ scrubber cost lines paid by member      (§12)
                  − Σ scrubber charges of member              (§12)
                  + Σ payments sent by member
                  − Σ payments received by member
```

Positive = the team owes the member (they bought more than they used). Because open vessels
still hold value, `Σ balances = inventory value ≥ 0` in normal operation: creditors are partly
"backed by gas in stock", shown as such in the UI.

Payments: recorded by the payer, the recipient or an admin and counted immediately; the same
people can delete a wrong one (no confirmation workflow in v1). `amount > 0`, `from ≠ to`, both
members of the team in any status (a member who left can still settle up). The balances list
shows every member except LEFT ones whose balance rounds to 0.00.

Settlement suggestions (on rounded balances): repeatedly let the largest debtor pay the largest
creditor `min(|debt|, credit)`; stop when no debt ≥ 0.01 or no creditor is left (rounding can
leave a last cent with nobody to pay — it is not invented). Deterministic tie-break: lower member
id first. Creditors may keep a remainder (the inventory-backed part).

"Why do I owe this?" is answered by the balance breakdown (paid costs, fill charges, loss shares,
payments) plus the member's fills and payments lists — no separate ledger in v1 (BACKLOG).

---

## §9 BACKLOG — Blend planner (partial-pressure calculator)

Not in v1. Kept so a later version can add it without re-deriving the maths.

Input: target `Vw`, start `(pressureBar, mix)`, target `(pressureBar, mix)`, sources (default:
the team's fullest IN_SERVICE HELIUM vessel, fullest OXYGEN vessel, AIR; overridable by vessel
id; v1 supports pure O2, pure He and AIR sources only), `roomId`.

Algorithm (fill order He → O2 → AIR):

1. `L_t = contentLitres(Vw, p_t, mix_t)`; needed components `N_c = L_t·mix_t[c] − L_0·mix_0[c]`.
2. `air = N_n2 / 0.791`, `he = N_he`, `o2 = N_o2 − 0.209·air`.
3. If any is negative the start gas must be bled first: find the highest bleed-to pressure
   `p_b ∈ [0, p_0]` (bisection) for which all three are ≥ 0; if none exists even at `p_b = 0`
   → 400 `"Target not reachable with these sources"`.
4. Stage target pressures: after He, `pressureFor(Vw, L_b + he, mix_after_he)`, then after O2
   likewise, then `p_t`.
5. Output: `bleedToPressureBar?`, per stage `{ source, pressureAfterBar, addedLitres }`,
   `estimatedCost` (current rates, §7; AIR = 0) and warnings: `INSUFFICIENT_SOURCE` (needs more
   than the source's estimated usable content), `BOOSTER_REQUIRED` (stage target > source
   estimated pressure), `EXCEEDS_BOOSTER_RATIO` (stage target > source pressure ·
   `room.boosterMaxRatio`).

The planner never writes anything; "Record this fill" in the UI pre-fills a `PRESSURES` fill.

---

## §10 Authorization

Every team-scoped operation starts with `TeamAccessService.requireMember(teamId, user)` (or
`requireAdmin`). A **non-member gets 404** (team existence is not leaked); a member lacking a role
gets 403. `LEFT` members are non-members (their balance stays visible to the team).

| Action | Who |
|---|---|
| Create team | any authenticated user (becomes ADMIN, ACTIVE) |
| Edit team settings; add members by username; manage the invite link; change roles; set a member LEFT | ADMIN |
| Leave team | that member (the last ADMIN can't leave or demote themselves) |
| Create vessel; add a cost line with `payer = self` | ACTIVE member |
| Add cost line for another payer; edit/delete cost lines; change a vessel's policy; reopen | ADMIN |
| Close vessel | ADMIN or the member who created it |
| Add a reading | ACTIVE member |
| Record a fill (any charged member of the team, or a VESSEL target) | ACTIVE member |
| Edit/void a fill | its `recordedBy`, its charged member, or ADMIN |
| Record or delete a payment | its payer, its recipient, or ADMIN |
| Read balances, fills, vessels, reports of the team | ACTIVE member |

Every endpoint gets at least: a happy-path test, a non-member → 404 test, and (where the matrix
restricts it) a non-admin → 403 test.

---

## §11 Worked examples (golden values for tests)

### §11.1 Fill from stage pressures, IdealGas

`Vw = 12`, start `0 bar` AIR, stages He → 70, O2 → 92, AIR → 200, dead volume 0.05 L.

| | content after (L) | added (L) | line loss (L) |
|---|---|---|---|
| start | 12.0000 | | |
| He → 70 | 841.0155 | 829.0155 | 3.4542 |
| O2 → 92 | 1101.5633 | 260.5477 | 4.5398 |
| AIR → 200 | 2380.6158 | 1279.0526 | — (free) |

End mix: o2 = 0.222790, he = 0.348236. He draw = 832.4697 L, O2 draw = 265.0875 L.

### §11.2 BACKLOG — Fill, `ANALYSIS`, IdealGas

Same cylinder, end 200 bar, `endAnalysis = (0.222790, 0.348236)`, sources [He, O2, AIR] →
`a = (829.0155, 260.5477, 1279.0526)` (± 0.01 L, the analysis is rounded to 6 digits).

### §11.3 BACKLOG — Planner, IdealGas

`Vw = 12`, start 0 bar AIR → target 21/35 at 200 bar: `L_t = 2380.6158`; He 833.2155 L, O2
223.1639 L, AIR 1312.2364 L; stage pressures He → 70.355, O2 → 89.198, AIR → 200 bar.

### §11.4 Allocation, TRUE_UP

Members A, B, C (all ACTIVE, sharing). He vessel H: `C_direct = 600.00` (paid by A),
`V_in = 6000 L`, `V_res = 1000 L`. Draws: B 1500 L, C 1000 L, A 500 L (`D = 3000`).

- Open: rate = 600 / max(5000, 3000) = 0.12 → charges B 180.00, C 120.00, A 60.00; unallocated
  240.00. Balances A +540.00, B −180.00, C −120.00 (Σ = 240.00 = unallocated ✓).
- Closed at D = 3000: rate = 0.20 → B 300.00, C 200.00, A 100.00. Balances A +500.00,
  B −300.00, C −200.00 (Σ = 0 ✓). Suggestions: B → A 300.00, C → A 200.00.

### §11.5 Allocation, POOLED (same facts)

rate = 600 / 6000 = 0.10 → open: B 150.00, C 100.00, A 50.00, unallocated 300.00. Closed with
participants {A, B, C}: loss = 600 − 300 = 300 → 100.00 each. Balances A +450.00, B −250.00,
C −200.00 (Σ = 0 ✓). With a 4th sharing member D who never filled: 75.00 each → A +475.00,
B −225.00, C −175.00, D −75.00.

### §11.6 House mix propagation, TRUE_UP

Engine-level inputs (litres given directly). O2 vessel O: `C_direct = 300.00` (B), `V_in = 9000`,
`V_res = 1000`. A fill O → house-mix vessel X draws 2000 L from O; X's `V_in = 6000` (that O2 plus
4000 L AIR), `V_res(X) = 0`, no cost lines. A draws 4000 L from O; C draws 3000 L from X.

- O open: D_O = 6000, rate_O = 300 / max(8000, 6000) = 0.0375 → X's cost = 75.00, A 150.00.
  rate_X = 75 / max(6000, 3000) = 0.0125 → C 37.50.
- O closed (D_O = 6000): rate_O = 0.05 → X's cost = 100.00, A 200.00; rate_X = 100/6000 →
  C 50.00. Conservation: 300 = 200 + 50 + unallocated(X) 50 ✓.

---

## §12 Scrubber: shared CO2 absorbent

Separate from gas: no bank, fill, mix, loss policy or physics is involved, only the balances (§8)
are shared.

A **canister** has a `label`, a `capacityKg` (usually 23), cost lines (one or several payers, same
rule as a bank's, §10), `openedAt` and, once someone says "it is empty now", `emptiedAt`. A **use**
is one scoop for a member: `kg` (usually 2–3, an estimate, nobody weighs it) and `usedAt`, inside
`[openedAt, emptiedAt)`.

With `C` the canister's total cost and `R` the recorded kg:

```
open:   pricePerKg = C / max(capacityKg, R)    an estimate; can never charge more than C
empty:  pricePerKg = C / R                     final; the charges add up to exactly C
charge(use) = kg · pricePerKg
```

An empty canister nobody recorded a use of charges nobody: its cost stays with its payers. What is
paid but not yet charged counts as stock (`inventoryValue`, §8). Remaining kg is `capacityKg − R`
(at least 0), and 0 once empty: an estimate shown as "≈".

Authorization: any member records a use (for anyone, like a fill), adds a canister and says it is
empty; a use is deleted by its member, its recorder or an admin; cost lines for someone else and
their deletion need an admin; reopening an empty canister needs an admin.
