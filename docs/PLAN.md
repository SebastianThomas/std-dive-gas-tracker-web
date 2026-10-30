# PLAN.md — Gas Tracker implementation plan

Orchestration plan for building the gas tracker with subagents. Each task is sized for **one
subagent run**, names its inputs (spec sections), outputs (files/packages) and its definition of
done (DoD). The orchestrator (a top-tier model session, or the human) dispatches tasks, reviews
each result and keeps the **Status** column current.

- Domain semantics: [`DOMAIN.md`](DOMAIN.md) · REST contract: [`API.md`](API.md) · decision log:
  [`DECISIONS.md`](DECISIONS.md)
- Backend rules: `/Users/sebas/IdeaProjects/std-dive-logger-backend/std-dive-logger-backend/std-dive-gas-tracker/AGENTS.md`
- Frontend rules: [`../AGENTS.md`](../AGENTS.md)

## Repos and paths

| | Path | Notes |
|---|---|---|
| Backend module | `/Users/sebas/IdeaProjects/std-dive-logger-backend/std-dive-logger-backend/std-dive-gas-tracker` | Maven module in the dive-logger reactor (shared parent pom only; **no** dependency on `std-dive-logger-*` modules). Package `ch.sthomas.stddivegastracker`. Own Postgres DB. |
| Frontend | `/Users/sebas/git/std-dive-gas-tracker-web/vue` | Vue 3 + Vite + Pinia + Tailwind 4, Yarn 1. |
| Dive-logger ws (auth provider) | `/Users/sebas/IdeaProjects/std-dive-logger-backend/std-dive-logger-backend/std-dive-logger-ws` | Touched **only** by task B0 / P1. |

## Subagent protocol

1. **One task per subagent.** Tasks in the same repo run one at a time unless the table marks
   them parallel-safe (disjoint packages/files). Backend and frontend lanes can run in parallel.
2. Run in the **main checkout** (no worktree isolation): gitignored local files (`.claude/`,
   `.env.development.local`) are needed, and the human commits work in progress themselves.
   **Never commit, push, or touch git history.**
3. Model per task: see the *Model* column. `sonnet` = default implementer; `haiku` = mechanical
   tasks with a strong existing pattern; `opus` = security-sensitive or cross-cutting work and
   all phase reviews.
4. A subagent that finds the spec ambiguous or wrong **stops and reports** instead of inventing
   semantics; small, clearly-local choices go into `DECISIONS.md` (one entry each).
5. The orchestrator reviews every result before marking it done: re-runs the DoD checks itself,
   reads the diff against the cited DOMAIN/API sections, checks tests actually assert the golden
   values, then updates **Status** here.

### Prompt template (copy, fill the `<…>`)

```
You are implementing task <ID> "<title>" of the STD Dive Gas Tracker.

Read first, in this order, and follow them strictly:
1. <AGENTS.md of the repo you work in — backend module or frontend>
2. /Users/sebas/git/std-dive-gas-tracker-web/docs/DOMAIN.md sections <§…>
3. /Users/sebas/git/std-dive-gas-tracker-web/docs/API.md sections <…> (if any)
4. /Users/sebas/git/std-dive-gas-tracker-web/docs/PLAN.md, task <ID> (scope, outputs, DoD)

Do only this task. Do not commit. Do not modify files outside the task's listed outputs except
where the task says so. If the spec is ambiguous or contradicts the code, stop and report.

When done, reply with: (1) files created/changed, (2) every DoD command you ran and its result
(paste failing output verbatim), (3) deviations from the spec and DECISIONS.md entries added,
(4) open questions.
```

### Definition of done (applies to every task, on top of the task's own DoD)

- Backend: from the reactor root, `JAVA_HOME=/Users/sebas/Library/Java/JavaVirtualMachines/openjdk-26.0.2.1/Contents/Home mvn -pl std-dive-gas-tracker spotless:apply` then `… mvn -pl std-dive-gas-tracker verify` — green (includes NullAway, ArchUnit layering, all tests).
- Frontend: from `vue/`: `yarn type-check`, `yarn lint`, `yarn test:ci`, `yarn build` — green;
  touched pages checked in the Browser pane at 375×812 and 320×568, light and dark.
- New behaviour has tests that assert the spec's numbers, not just "no exception".
- Every interface with more than one implementation is covered by a **contract test** run against
  each implementation (see "Interfaces and contract tests").
- `API.md` updated in the same change if a request/response shape changed.
- The change respects the simplicity budget below (reviewers reject extra states, settings,
  endpoints, screens or abstractions that no DOMAIN/API section asks for).

## Simplicity budget (binding for every task)

The human's standing instruction (2026-10-26): **the frontend must be easy to use and not
complicated; the backend as simple and minimal as possible while providing the required
abstractions; every implementation — and especially every common interface — is tested.**

Backend:
- Build exactly what DOMAIN/API specify. No speculative fields, states, settings, endpoints,
  feature flags, generic frameworks, builders, mappers or "for later" hooks. BACKLOG sections
  stay unbuilt.
- An interface exists only where there are ≥ 2 real implementations (today: compressibility
  models). Everything else is a concrete class; `calc` prefers records + static functions.
  The two loss policies are a `LossPolicy` enum handled inside the engine — not a plugin system.
- One `*DataService` per aggregate, one controller per API.md section, thin controllers.

Frontend — five places, one primary action each:

| Tab (phone bottom bar) | Primary action | Everything else |
|---|---|---|
| **Home** | "Record a fill" | my balance, low banks, my last fills |
| **Fill** | Save fill | defaults pre-filled; extras behind "More details" |
| **Banks** | Add bank | levels at a glance; detail page for readings/costs/close |
| **Money** | Record payment | who owes whom (suggestions), my breakdown, payments list |
| **Team** (admin extras) | — | members, team settings, reports |

- Recording the usual trimix fill (my cylinder, He → O2 → Air) is: tap Fill → cylinder size
  (remembered) → three "after" pressures → Save. Start pressure/mix default to empty/air, the
  sources default to the team's fullest He and O2 banks; everything else (another member, into a
  bank, analyser reading, time, notes, bank gauge) sits under one collapsed "More details".
- Plain words, never enum names: "bank" (not vessel), "you owe" / "you're owed",
  `TRUE_UP` → "Exact per bank", `POOLED` → "Shared loss pool", a provisional price → "estimate (bank
  still in use)". Explain a number in one line of helper text, not a dialog.
- No settings screens for things with a sensible default; no confirmation dialogs except for
  void / close bank / delete payment / remove member.

## Interfaces and contract tests

Every interface (or enum-dispatched family) with more than one implementation has one shared
test suite run against **each** implementation, plus implementation-specific tests:

| Common interface | Implementations | Contract test (owner task) |
|---|---|---|
| `calc.gas.CompressibilityModel` | `IdealGas`, `VirialFit` | `CompressibilityModelContractTest` (abstract; one subclass per model): Z finite and > 0 on 1–1001 bar abs for all mixes, Z(1 atm) ≈ 1, content strictly increasing in pressure on 0–1000 bar (needed by `pressureFor`), `pressureFor` inverts `contentLitres`. Exists (C1): `IdealGasTest`, `LinearTestModelContractTest` (test-only Z ≠ 1); C2 adds `VirialFitTest extends` it. |
| `LossPolicy` `TRUE_UP` / `POOLED` | engine branches | `AllocationPolicyContractTest` (exists, C4): 1500 seeded scenarios per mode `ALL_TRUE_UP`, `ALL_POOLED`, `MIXED`; DOMAIN §7.5 invariants, unallocated = 0 when closed, non-negative rates, order independence, fallback chain. C7 reuses its generator for the balance identity. |
| Frontend token sources | dive-logger refresh, dev token | `authStore.spec.ts` covers both paths (done in S2). |

## Status overview

| Phase | Tasks | Status |
|---|---|---|
| 0 Setup | S1 S2 S3 | done (2026-10-25) |
| 1 Auth, identity, code standards | Q1 B0 A1 | done (2026-10-27); B0 not deployed yet |
| 2 Backend calc (pure Java) | C1–C4, C6, C7 | done (2026-10-26) |
| 3 Backend persistence + API | D1–D9 | done (2026-10-28) |
| 4 Frontend | F1–F8 | done (2026-10-28) |
| 5 Deployment | P1 P2 | files done (2026-10-28); nothing applied (needs a `*.std-dive-gas-tracker[-dev]` cert) |
| 6 Later | L1–L13 | backlog |

---

## Phase 0 — Setup (done)

| ID | Task | Status |
|---|---|---|
| S1 | Backend module skeleton: pom, app class, security (JWT verification + `dev-login`), exception handling, `t_user` + `GET/PUT /v1/me` vertical slice, ArchUnit layering test, Testcontainers base test, compose.yaml, AGENTS.md | done |
| S2 | Frontend skeleton in `vue/`: Vite/Vue/TS/Pinia/Router/Tailwind 4/Vitest/ESLint/Prettier, auth store + `useApi` ported from the dive logger, login + dev-login, app shell, CI workflow, AGENTS.md | done |
| S3 | DOMAIN.md, API.md, PLAN.md, DECISIONS.md | done |

## Phase 1 — Auth, identity and code standards (cross-cutting)

The human's decisions (2026-10-27): allow email changes (identity = dive-logger user id), the
best auth design (asymmetric signing, see API.md "Auth"), and strict code standards (`final`,
`var`, record patterns, try-with-resources, …) enforced by tools. Order: **Q1 ∥ B0**, then
**A1** (A1 builds on Q1's gate; B0 is in other modules and only shares the token contract).

| ID | Task | Model | Depends | Status |
|---|---|---|---|---|
| Q1 | Java code-standards gate (Checkstyle + ErrorProne in this module) + cleanup of all existing gas-tracker code | sonnet | D2 | done |
| B0 | Dive logger: Ed25519-signed access tokens with `uid`, `email_verified`, `iss`, `kid`; ws + import-ws verify with the public key | opus | — | done (not deployed: needs the human's key secrets first) |
| A1 | Gas tracker identity: `uid` as user key, email-change refresh, PENDING members, public-key verification, ephemeral dev-login keys | sonnet (opus review) | Q1 | done |

**Q1** — backend AGENTS.md "Java code style" is the spec; the human's own edit of
`AllocationEngine` (`final var` loop variables, `instanceof ToVessel(final var vesselId)`) is the
reference. Add to **this module's pom only**: (1) `maven-checkstyle-plugin` bound to `validate`
(fails the build) with a tiny `checkstyle.xml` in the module: `FinalParameters`,
`FinalLocalVariable` (incl. enhanced-for variables), a `RegexpSinglelineJava` rule flagging local
declarations with an explicit reference type instead of `final var` (`^\s+final
(?!var\b)[A-Z]…\s\w+\s=`), with a `SuppressWithNearbyCommentFilter`
(`// checkstyle: explicit-type <reason>`) for the rare lambda target; (2) ErrorProne beyond
NullAway: override the module's `maven-compiler-plugin` `compilerArgs` (copy of the parent's,
kept in sync, with a comment) without `-XepDisableAllChecks`, so ErrorProne's default ERROR
checks run, and promote `MustBeClosedChecker`, `StreamResourceLeak`, `UnusedVariable`,
`UnusedMethod`, `MissingCasesInEnumSwitch`, `PatternMatchingInstanceof`,
`StatementSwitchToExpressionSwitch` to ERROR (verify each name exists in the ErrorProne version
in use; drop and report any that don't). Then make **all** existing main and test code pass
(records, record patterns, switch expressions, `final var`, try-with-resources, `_` for unused
lambda/catch/pattern variables). Also: `ExceptionHandling` logs an unreadable body at INFO
**without** the stack trace. No behaviour changes; all tests stay green.

**B0** — Dive-logger modules only (`std-dive-logger-ws`, `std-dive-logger-import-ws`, their conf/
manifests, `deploy/secret.example.yaml`, `.github/workflows/deploy.yml`); follow the dive
logger's own `.claude/AGENTS.md`. Access tokens: jjwt EdDSA (Ed25519) signature with the private
key from `STD_DIVE_LOGGER_WS_JWT_SIGNING_KEY` (PKCS#8 PEM), header `kid` = first 16 chars of
base64url(SHA-256(public key DER)), claims `iss = "std-dive-logger"`, `sub` = email (unchanged),
`uid` = user id, `email_verified`, `exp` (unchanged lifetime). `ws` verifies with its public key
(`STD_DIVE_LOGGER_WS_JWT_PUBLIC_KEY`); `import-ws` gets **only** the public key (it no longer needs
any signing secret). Refresh tokens stay HS384 with the refresh secret (ws-internal, unchanged).
The access-token secret `STD_DIVE_LOGGER_WS_JWT_SECRET` is removed once nothing reads it. Add
`tools/generate-jwt-keys.sh` (openssl Ed25519 PEM pair) and update the local verification recipe in
the dive logger's `.claude/AGENTS.md` (env vars) — with a fixed **dev-only** key pair documented
there. Tests: issued token verifies with the public key and carries the claims for a verified and
an unverified user; a token signed with another key or HS256 is rejected by ws and import-ws.
DoD: `mvn -pl std-dive-logger-ws,std-dive-logger-import-ws -am verify` + `spotless:check` (JDK
26). Never deploy or touch the cluster; list the GitHub secrets/variables the human must add.

**A1** — DOMAIN §2 (User, Member), §7.3, §10; API.md "Auth", §2. In this module:
- `t_user.pk_user_id` = dive-logger `uid` (no identity generation); `email` nullable + unique;
  `updated_at`. On every authenticated request, in one transaction: clear `email` on any other row
  holding the token's email, upsert own row (insert or update email; never overwrite
  `display_name`), then bind PENDING memberships invited with that (verified) email
  (`fk_user_id` set, `invited_email` cleared; if the user already has a row in that team, drop
  the pending row). Race-safe (`INSERT … ON CONFLICT (pk_user_id) DO UPDATE`).
- `t_team_member`: `fk_user_id` nullable + `invited_email`, exactly one of them set (CHECK),
  unique `(fk_team_id, invited_email)`. `MemberStatus` gains `PENDING`; add-member creates a
  PENDING member for an unknown email instead of a user row; 409 for ACTIVE or PENDING; LEFT
  reactivates. Loss participants = not LEFT (D3 consumes this).
- Verification: `DiveLoggerJwtDecoder` uses jjwt with a key locator over the configured Ed25519
  public keys (by `kid`; a single configured key also matches a token without `kid`), requires
  `iss`, `uid` (positive number, or negative only for dev keys), `sub` email, `exp`, and
  `email_verified` when configured. The HS256 shared secret disappears from this module.
- `dev-login`: an ephemeral Ed25519 key pair generated at startup (bean only in that profile),
  accepted by the decoder alongside the configured keys; tokens get `uid` = −(1 + floorMod(
  first 8 bytes of SHA-256(email) as long, 1e12)).
- Tests (`TestJwts` signs with a test Ed25519 key pair): email change keeps the same user and
  memberships; a stale holder of the email loses it; pending member → bound on first sign-in
  (and charged-member semantics unchanged); unverified email never binds; wrong key / wrong `iss`
  / missing `uid` / HS256 token → 401; dev-login tokens never collide with positive ids.

## Phase 2 — Backend calc (`ch.sthomas.stddivegastracker.calc`, no Spring, no JPA)

Plain JUnit 5 + AssertJ unit tests, no Spring context, no `slow` tag. Lane A (`calc.gas`,
`calc.fill`, `calc.inventory`) and lane B (`calc.allocation`, `calc.settlement`) are
parallel-safe; while two tasks are in flight, each formats only its own files
(`spotless:apply -DspotlessFiles='.*/calc/<pkg>/.*'`) and waits out the other's compile errors.
Parallel `verify` runs share `target/` and can fail transiently (integration tests losing their
classes mid-run); the orchestrator's `clean verify` after all lanes finish is authoritative.

| ID | Task | Model | Depends | Lane | Status |
|---|---|---|---|---|---|
| C1 | Mix, units, content/pressure conversion, `IdealGas` | sonnet | S1 | A | done |
| C2 | `VirialFit` compressibility from NIST data | sonnet | C1 | A | done |
| C3 | Fill solver (stage pressures, line loss, warnings) | sonnet | C1 | A | done |
| C4 | Allocation engine (TRUE_UP, POOLED, DAG, invariants) | sonnet (opus review) | S1 | B | done |
| C6 | Inventory replay + loss report | sonnet | C1 | A | done |
| C7 | Balances + settlement suggestions (pure) | sonnet | C4 | B | done |

**C1** — DOMAIN §3, §4.1, §4.3. Package `calc.gas`: `GasMix`, `GasComponent`, `GasClass`,
`Units`, `CompressibilityModel`, `IdealGas`, `GasContent`. Done 2026-10-26.

**C2** — DOMAIN §4.2. Fetch NIST isotherms at 293.15 K, 1–300 bar, step 5 bar, for He
(`ID=C7440597`), O2 (`C7782447`), N2 (`C7727379`) via
`https://webbook.nist.gov/cgi/fluid.cgi?Action=Data&Wide=on&ID=<ID>&Type=IsoTherm&Digits=6&PLow=1&PHigh=300&PInc=5&T=293.15&RefState=DEF&TUnit=K&PUnit=bar&DUnit=mol%2Fl&HUnit=kJ%2Fmol&WUnit=m%2Fs&VisUnit=uPa*s&STUnit=N%2Fm`
(tab-separated; `Z = p / (ρ·R·T)`, `R = 0.0831446261815324 L·bar/(mol·K)`; drop duplicate
phase-boundary rows). Commit the trimmed tables as
`src/test/resources/nist/{he,o2,n2}-293K.tsv` and the fit script as `tools/fit_compressibility.py`
(numpy least squares, no intercept: fit `Z−1` on `p, p², p³`). Implement `VirialFit` with the
coefficients as constants (comment: source, date, script). The cubic is only fitted to 300 bar:
above that, extend Z linearly from its 300-bar value and slope so the model still passes the
contract test up to 1000 bar. Tests: `VirialFitTest extends CompressibilityModelContractTest`;
every NIST row within 0.3 %; He sanity value from §4.2; mixture rule on a 21/35 trimix.
`calcModelVersion` constant `virial-nist-2026-1`.

**C3** — DOMAIN §5.1, §5.2, §5.4, §5.5, §5.6 (physics parts), §11.1. Package `calc.fill` (done:
one file `FillSolver` with nested `Input`, `StageInput`, `StageResult`, `Result`, `Warning`):
`FillSolver.solve(input, model, deadVolumeLitres)` → `Result` (per-stage added/component/line-loss/draw litres, end
mix, end pressure, `ANALYSIS_MISMATCH` warning). Validation errors as `IllegalArgumentException`
(non-increasing pressures, first stage ≤ start). No ANALYSIS mode (§5.3 is backlog). Tests:
golden §11.1 with `IdealGas`; the bisection result equals the IdealGas closed form within 1e-6 L;
every result run with **both** models (IdealGas, and VirialFit once C2 exists — else a test-only
non-ideal model) satisfies: Σ added = end content − start content, component sums match the end
mix, draws = added + line loss.

**C4** — DOMAIN §7 (all), §11.4–§11.6. Package `calc.allocation` (7 files): `AllocationEngine`,
`AllocationInput` (nested `Vessel`, `CostLine`, `Draw`, sealed `Beneficiary.ToMember/ToVessel`),
`AllocationResult` (nested `VesselAllocation` with the transitive `provisional` flag,
`DrawCharge`, `LossShare`, `MemberAllocation`; lookups `vessel(id)`, `drawCharge(id)`,
`member(id)`), enums `LossPolicy`, `VesselStatus`. Done 2026-10-26.

**C6** — DOMAIN §6. Package `calc.inventory`: event records (open, inflow, outflow, reading),
`InventoryReplay.replay(vessel, events, model)` → book content/mix/pressure, inflow/drawn/line-loss
totals, per-reading discrepancy, estimate from last reading, usable content, `LossReport` for a
closed vessel. Tests: hand-computed IdealGas scenarios incl. a house mix with two inflows; tie
ordering by id; discrepancy sign convention (`book − measured`); the same scenario with
`IdealGas` and `VirialFit` gives identical flow totals (inflow added, drawn, line loss) while open
content and pressures differ consistently (book pressure ↔ book content round-trips per model).

**C7** — DOMAIN §8. Package `calc.settlement`: `BalanceCalculator` (combines `AllocationResult`,
cost lines and payments → per-member `MemberBalance` components, unrounded) and
`SettlementSuggester` (rounded `HALF_EVEN` 2 dp, greedy, deterministic tie-break). Tests: §11.4
suggestions; balance identity (§7.5 #3) property test reusing C4's generator.

## Phase 3 — Backend persistence + API

Integration tests extend the module's `AbstractIntegrationTest` (shared Testcontainers Postgres +
JWT helper, one cached Spring context). Every endpoint: happy path, non-member → 404, and
non-admin → 403 where DOMAIN §10 restricts it, plus one validation → 400. Sequential (shared
migration file and services).

| ID | Task | Model | Depends | Status |
|---|---|---|---|---|
| D1 | Full schema + entities + repositories | sonnet | S1 | done |
| D2 | Teams + members (API.md §1–§2) | sonnet | D1 | done |
| D3 | Vessels, cost lines, readings, close/reopen, team snapshot service (API.md §3) | sonnet | A1, C4, C6 | done |
| D4 | Fills: preview/create/update/void/list (API.md §4) | sonnet | D3, C3 | done |
| D5 | Balances + payments (API.md §5) | sonnet | D4, C7 | done |
| D6 | Reports (API.md §6) | sonnet | D5 | done |
| D7 | Demo seed profile for local dev | haiku | D6 | done |
| D8 | OpenAPI doc fit for codegen + snapshot test | sonnet | D6 | done |
| D9 | Phase review: security, correctness, simplicity pass over Phase 3 | opus | D1–D8 | done |

**D1** — DOMAIN §2, §3, §5.4, §6, §7.3. Extend the single in-flight migration
`V1_0_0__init.sql` (collapse rule, see backend AGENTS.md) with exactly these tables: `t_team`
(incl. its settings), `t_team_member`, `t_vessel`, `t_vessel_cost_line`, `t_vessel_reading`,
`t_vessel_loss_participant`, `t_fill`, `t_fill_stage`, `t_payment`. Minimal storage rules:
- **Statuses are derived, not stored**: vessel CLOSED ⇔ `closed_at` set (with
  `closing_pressure_bar`), member LEFT ⇔ `left_at` set, fill VOIDED ⇔ `voided_at` set (with
  `void_reason`), stage from AIR ⇔ `fk_source_vessel_id` null, fill into a vessel ⇔
  `fk_target_vessel_id` set (else cylinder: `water_volume_litres` + `fk_charged_member_id`).
  Check constraints enforce each pairing.
- **Cross-aggregate references are id columns** (`Long` fields), never JPA associations.
  Aggregates: User, Team, TeamMember, Vessel (children: cost lines, readings, loss-participant
  ids as an `@ElementCollection`), Fill (children: stages, `@OneToMany` cascade + orphanRemoval,
  ordered by `stage_index`), Payment.
- No stored money per fill and no stored warnings (DOMAIN §5.4; `ANALYSIS_MISMATCH` is
  recomputable, `SOURCE_OVERDRAWN` only appears in create/preview responses).
- Conventions: `pk_<x>_id BIGINT GENERATED ALWAYS AS IDENTITY`, `fk_<x>_id` + an index on every
  FK column, `(fk_team_id, filled_at DESC)` index for the fills list, `created_at`/`updated_at
  TIMESTAMPTZ`, money `NUMERIC(12,2)`, fractions/pressures/volumes `DOUBLE PRECISION` with the
  DOMAIN §3 range checks, enums (`role`, `loss_policy`) as `VARCHAR` + `CHECK`, currency
  `CHAR(3)` upper-case.
- Entities in `model.entity` (reuse `calc.allocation.LossPolicy` and `model.team.Role`; no other
  new enums), one Spring Data repository per aggregate root in `data.repository`. **No
  DataService methods yet** beyond what the tests need — D2–D5 add the ones their features use.
Tests: Flyway migrates and Hibernate validates (`ddl-auto=validate`); each aggregate round-trips
(save, flush + clear, reload incl. children); the pairing/range/unique/FK constraints fire.

**D2** — DOMAIN §2, §10; API.md §1–§2. `TeamAccessService` (`requireMember`, `requireAdmin`,
returns the caller's member); create team (caller ADMIN); add member by email (JIT user row,
ACTIVE); role/status changes; leave; last-admin guard; `GET /v1/me` lists ACTIVE teams.
From D1: `(fk_team_id, fk_user_id)` is unique, so re-adding a LEFT member reuses the row
(`setLeftAt(null)`, reset `joinedAt` — add that setter); repositories are empty, add exactly the
derived queries you need (entity property names: `teamId`, `userId`, …).

**D3** — DOMAIN §6, §7, §10; API.md §3. Includes `TeamSnapshotService` (loads one team's
vessels/draws/cost lines/participants into the engine input + inventory events) — reused by
D4–D6. Close writes the participant snapshot (§7.3); reopen clears it; policy snapshot on create.
From A1: loss participants = members with `left_at IS NULL` (ACTIVE **and** PENDING); the engine's
`activeMemberIds` = ACTIVE only (`left_at IS NULL AND fk_user_id IS NOT NULL`); member queries
`LEFT JOIN t_user` (both `fk_user_id` and `t_user.email` can be null); any "pick a member" input
accepts PENDING and rejects LEFT. Tests: `bearer(email)` has a stable positive uid; call
`me(email)` to bind an added member before it acts as ACTIVE.
From D1/C6: events for `InventoryReplay` = the vessel's inflows (Σ stage `addedLitres` /
components of each fill into it), outflows (each stage drawing from it: `drawLitres`,
`lineLossLitres`, snapshotted source mix) and readings; cost lines are replaced by delete +
re-add (no setters); the DB does not check that ids referenced in a request belong to the same
team — the service must (DOMAIN §5.6, §10).

**D4** — DOMAIN §5, §6 (readings from `sourcePressureAfterBar`), §10; API.md §4. Uses
`FillSolver` with the production model; stores stage results + `calcModelVersion`; DAG check for
VESSEL targets; VESSEL-target `endAnalysis` updates the declared mix; `SOURCE_OVERDRAWN` warning;
preview runs the same code path without saving and prices with current rates.
From D1: on edit, `getStages().clear()`, **flush**, then add the new stages (else the
`(fk_fill_id, stage_index)` unique constraint fires); readings created from
`sourcePressureAfterBar` are linked by `t_vessel_reading.fk_fill_id` only — delete and re-create
them on edit, delete them on void. `stage_index` is 0-based; `FillSolver.Warning` stays calc-side,
the API warning list adds `SOURCE_OVERDRAWN` in the service.
From D3: start with `teamAccess.require…`, then `snapshots.snapshot(caller)` → `TeamState`
(`facts()`, `input()`, `allocation()`, `inventoryOf(vesselId)`, `member(id)`); a fill's charge =
Σ `allocation().drawCharge(stageId)` of its stages; check every source/target vessel with
`VesselRepository.findByIdAndTeamId` (404 path / 400 body) and keep the transfer graph acyclic
**before** saving (the engine throws on a cycle, which would break the whole team's banks list);
preview = run `FillSolver` + an in-memory snapshot with the extra draws, never a write.

**D5** — DOMAIN §8; API.md §5. Uses `calc.settlement.BalanceCalculator` / `SettlementSuggester`;
the service (not calc) checks that both payment members belong to the team. From D4: a member's
fill charges / `provisionalCharges` come from `snapshot.allocation()` (`ToMember` draws; provisional
= source vessel `provisional()`); `FillService.Prices` does the per-stage version privately —
extract it rather than copy it; voided fills are never in the snapshot; payment parties may be any
member of the team — ACTIVE, PENDING **or LEFT** (someone who left still settles their debt);
only fills refuse LEFT members.

**D6** — DOMAIN §6 (loss report), §7.6; API.md §6. Round with `model.Money` (no private copies).
From D5: engine/calculator member rows exist only for members named in the input — build member
lists from `TeamState.facts().members()`; reuse `AbstractPaymentIntegrationTest.crew()` fixtures.
From D3: `TeamState.facts().stages()` holds
only gas-moving stages, so the consumption report needs its own query (cylinder fills that only
took AIR count as fills with 0 L O2/He); policy comparison = rebuild `input().vessels()` with the
other policy and re-run `AllocationEngine.allocate` (V_in/V_res don't depend on the policy).

**D7** — Profile `demo-seed` (local only, like `dev-login`): on startup, if no team named
"Demo Team" exists, create it with 3 members (`demo-admin@example.test`, `alice@example.test`,
`bob@example.test`), dead volume 0.05 L, residual 20 bar, O2 + He banks with cost lines, a
nitrox bank blended in-house, ~15 fills across members, one closed bank, two payments. Idempotent.

**D8** — From D4: `Page<T>` is generic and fill `target`/`source` are sealed types with a `type`
discriminator — make springdoc emit proper `oneOf` + discriminator so the generated TS types are
discriminated unions. SpringDoc: `Instant` → integer (epoch millis), money → string, enums as enums,
`@Nullable` → not required. Test `OpenApiSnapshotTest` writes `target/openapi.json` and compares
with `src/test/resources/openapi.json` (fails on drift; regenerate with
`-Dopenapi.update=true`). The frontend's F1 generates types from that file.

**D9** — From D4: fills into a bank serialise per team (team-row lock + locked loop re-check);
adding a gauge reading initialises that bank's readings list (fine at current scale). Review only: authorization on every endpoint vs DOMAIN §10, money never `double`, no
`ch.sthomas.stddivelogger` imports, N+1 queries on list endpoints, error messages, contract tests
present, anything beyond DOMAIN/API removed, one end-to-end scenario (§11.4 via REST).

## Phase 4 — Frontend (`vue/`)

Mobile-first, five tabs (see the simplicity budget). Sequential within the lane (shared router
and stores). Each task: component tests for non-trivial logic in `src/__tests__/`, and the
Browser-pane mobile/dark check against a local backend with `demo-seed` (recipe in the frontend
AGENTS.md). Every new screen is checked against the budget table before it is called done.

| ID | Task | Model | Depends | Status |
|---|---|---|---|---|
| F1 | Generated API types + `lib/api/*` modules + team context + formatters | sonnet | D8 | done |
| F2 | App shell: bottom tab bar, team switcher, create team, display name | sonnet | F1 | done |
| F3 | Team tab: members (add by email, role, leave), team settings | sonnet | F2 | done |
| F4 | Banks tab: list with level bars, detail (readings, cost lines, close/reopen), add bank | sonnet | F2 | done |
| F5 | Fill tab: record fill with live preview; fills list, detail, edit, void | sonnet | F4 | done |
| F6 | Money tab: balances, who-pays-whom, record/delete payment, my breakdown | sonnet | F5 | done |

**F6 notes (from D5)** — `/balances` arrives filtered and sorted (by name; LEFT only while ≠ 0.00;
PENDING always); positive = the team owes the member; negatives come as `"-12.34"`;
`provisionalCharges > 0` → label "estimate"; Σ rows may differ from `inventoryValue` by 0.01 per
member (rounding); suggestions are the presets for "Record payment"; payment parties come from
`GET /members` (incl. LEFT/PENDING), not from balances; show Delete only to the payer, the
recipient or an ADMIN (`Team.memberId`, `Team.role`); refetch `/balances` after POST/DELETE;
show the backend's 400 `detail` texts as they are.
| F7 | Reports (Team tab): consumption, losses, policy comparison | haiku | F6 | done |
| F8 | Home tab + phase review (usability against the budget, a11y, mobile pass) | opus | F1–F7 | done |

**F1** — `scripts/gen-api.sh`: copies the backend's `src/test/resources/openapi.json` and runs
`openapi-typescript` → `src/lib/api/schema.d.ts` (committed). Thin typed modules
`lib/api/{me,teams,members,vessels,fills,balances,reports}.ts` on top of `useApi()`. Team context
from the URL (`/t/:teamId`), last team remembered per user in `safeLocalStorage`.
`lib/format/{money,units,mix}.ts` (`Intl.NumberFormat` with the team currency; `"21/35"` /
`EAN32` mix labels; litres/bar formatting) + tests. Replace the hand-written types in
`lib/api/me.ts`.

**F5** — the most important screen; follow the budget's fill flow literally. Cylinder-size quick
picks (7, 10, 12, 15, 2×7, 2×12 L), remembered last size; stage rows added with "+ He", "+ O2",
"+ Air" buttons (source preselected to the fullest IN_SERVICE bank of that gas, changeable);
"after" pressure per stage; live preview (debounced 300 ms `POST …/fills/preview`) showing litres
per gas, cost and warnings; Save. "More details": charged member, into a bank, start pressure/mix,
analyser reading, time, notes, bank gauge after. Numeric inputs: `inputmode="decimal"`, ≥ 44 px
tap targets, units visible, no layout shift while previewing.

## Phase 5 — Deployment (human applies; agents never run `kubectl apply`)

| ID | Task | Model | Depends | Status |
|---|---|---|---|---|
| P1 | Backend deploy: module `conf/` + `manifests/` (mirror `std-dive-logger-autocomplete`), image matrix + deploy workflow entries, own database + role in the dive logger's CNPG cluster, secret wiring (shared access-JWT secret), ws `EXTRA_CORS_URLS` + one-label hostnames | opus | D9 | files done, not applied |
| P2 | Frontend deploy: Dockerfile, nginx.conf, build script, build-on-tag + deploy workflows, `deploy/` manifests, `.env.staging/.production` | sonnet | F8, P1 | files done, not applied |

Hostnames (decided by the human, 2026-10-28; same scheme as the dive logger): web
`std-dive-gas-tracker[-dev].sthomas.ch`, API `ws.std-dive-gas-tracker[-dev].sthomas.ch`. The API name
is two labels deep, so it needs a `*.std-dive-gas-tracker[-dev].sthomas.ch` cert on the Traefik
listener (homelab-infra) — the `*.sthomas.ch` wildcard does not cover it. Both wildcards are added
to homelab-infra `gateway-certs.yaml` (2026-10-29, not pushed); they need their acme-dns delegation
before that push (see the backend `deploy/README.md`).

## Phase 6 — Backlog (not scheduled; do not build in v1)

- L1 Offline fill recording (PWA queue, idempotent create with client-generated ids).
- L2 Web push: payment reminders, low-bank alerts.
- L3 Link fills to dives in the dive logger.
- L4 Other consumables (absorbent, filters, compressor hours) as generic cost pools.
- L5 Admin "recompute all fills" when `calcModelVersion` changes.
- L6 CSV export of fills/balances.
- L7 Blend planner (DOMAIN §9, §11.3).
- L8 Analysis-only fill entry (DOMAIN §5.3, §11.2).
- L9 Member ledger with running balance + "as of" statements.
- L10 Payment confirmation workflow.
- L11 Several rooms per team (per-room equipment settings).
- L12 Invitations (accept/decline) instead of direct add.
- L13 Dive logger: accept several access-token public keys (zero-downtime key rotation; today a
  rotation costs one refresh round-trip per client).
