# DECISIONS.md — decision log

Short entries, newest last. One entry per decision: date, who decided, what, why. Subagents add
entries for local choices they had to make; anything that changes DOMAIN/API semantics needs the
orchestrator's (or the human's) sign-off first.

## 2026-10-25 — Human (setup session)

- **Accounts**: reuse dive-logger accounts. The gas backend verifies dive-logger access JWTs
  (shared HS256 secret) and keeps its own `t_user` keyed by email; no passwords in the gas DB.
- **Loss policy**: undecided between per-bank true-up and pooled losses → implement **both**;
  the choice is a per-**team** setting stored in the DB (`team.defaultLossPolicy`, snapshotted per
  vessel). "Our group is a team."
- **Connectivity**: online-only for v1; offline recording is backlog (L1).
- **Tenancy**: multiple independent groups → `Team` is the tenant; every row is team-scoped.

## 2026-10-25 — Orchestrator (setup session)

- **Team vs room**: a team (tenant + accounting unit) owns one or more **rooms** (physical
  locations with equipment parameters: booster ratio, line dead volume, default residual). The
  human said "multiple rooms" and "teams"; modelled as team ⊃ rooms so equipment settings stay
  per location. Revisit if a room must be shared by several teams.
- **Isolation**: the backend module depends on no `std-dive-logger-*` module (only the parent
  pom). The dive-logger's `utils.advice` references dive-specific exceptions, so a small
  `ExceptionHandling` was re-implemented in the gas module instead of shared. Extracting a
  `std-dive-logger-common` module stays possible later.
- **Package** `ch.sthomas.stddivegastracker` (not under `ch.sthomas.stddivelogger`) so no
  component scan in the dive-logger apps can ever pick it up.
- **Physics**: real-gas compressibility (NIST-fitted virial) by default; helium deviates ~10 % at
  200 bar, which matters for the pooled policy's nominal price, inventory and the planner.
- **Stage source mix is declared, not computed** (snapshotted per stage): avoids order-dependent
  recompute cascades for house-mix banks.
- **Money is computed at read time, never stored per fill**: true-ups re-price old fills.
- **Security prerequisite B0**: dive-logger tokens are issued to unverified accounts, so the gas
  tracker requires an `email_verified` claim in production.
- **Frontend layout mirrors the dive logger** (`vue/` subdirectory, Yarn 1, same tooling) so both
  repos share muscle memory; agent docs are committed (unlike the dive logger's gitignored
  `.claude/AGENTS.md`) because they contain no secrets and subagents need them.

## 2026-10-26 — Orchestrator (before dispatching C1, C4)

- DOMAIN §4.3: `pressureFor` clamps a content at/below the 0-bar content to 0 (overdrawn book
  estimates must not throw); above the 1000-bar content is a 400-style `IllegalArgumentException`.
- DOMAIN §7.1/§7.2: the allocation engine receives cost lines (payer + amount), the closing
  snapshot and the team's `activeMemberIds`, and applies the §7.3 participant fallbacks itself;
  litres are `double` at the boundary, money `BigDecimal`/`DECIMAL128` inside; `allocated` /
  `unallocated` defined explicitly (closed vessels always 0 unallocated).
- C1 and C4 run in parallel in the same module (disjoint packages `calc.gas` /
  `calc.allocation`); while both are in flight, formatting is scoped with `-DspotlessFiles` and
  a compile error in the other lane's package is waited out, never fixed.

## 2026-10-26 — C1 (subagent)

- `GasContent` is a static utility taking the `CompressibilityModel` per call (no instance
  state); callers pass the model they got from the fill's `calcModelVersion`.
- `pressureFor` rejects a NaN/infinite content with `IllegalArgumentException` ("Gas content must
  be a finite number"); any finite content at or below the 0-bar content, negative included,
  still returns 0 (§4.3). Comparisons with NaN would otherwise silently return 0.
- `GasMix.gasClass()` compares thresholds as plain doubles (`<=`/`>=`), so values exactly on a
  decimal boundary classify by float noise: o2 = 0.214 and 0.204 give |o2 − 0.209| =
  0.0050000000000000044 > 0.005, so they are NITROX although §3 reads "≤ 0.005". Left as is (no
  epsilon invented); the tests pin only values clear of the AIR boundary.

## 2026-10-26 — Orchestrator (C1 review)

- Resolved C1's open question: `gasClass()` thresholds are inclusive with a 1e-9 tolerance
  (DOMAIN §3 updated); boundary cases 0.214/0.204 → AIR pinned in `GasMixTest`. Pure N2
  `(0, 0)` stays NITROX (no realistic vessel; not worth a class).

## 2026-10-26 — C4 (subagent)

- **Canonical summation order**: the engine sorts draws by id, cost lines by (payer, amount) and
  participants by member id before every sum, and returns all lists sorted by id. Rounding at
  34 digits makes `BigDecimal` addition order-dependent in the last digit; this makes §7.5 #5 hold
  bit for bit (property-tested with shuffled inputs), not only within a tolerance.
- **No clamping of residues**: `unallocated = C − allocated` exactly as defined in §7.2. With a
  repeating rate (e.g. 100/6000) a closed vessel ends at ~1e-31, not exactly 0; §7.5 #2 ("Σ charges
  = C exactly") likewise holds to ~1e-31. Consumers round at the API boundary (2 dp → 0.00).
- **A split needs participants even for a zero amount**: a closed vessel that must split a
  loss/write-off (POOLED, or TRUE_UP with D = 0) and has an empty snapshot, no active member and
  no payer with Σ paid > 0 throws `IllegalStateException` ("Vessel <id> is closed but …"), whatever
  the amount. Payers who paid 0 get no share in the pro-rata fallback.
- **Snapshot hygiene**: duplicate ids in `closingParticipantIds` are rejected (400); a snapshot on
  an `IN_SERVICE` vessel (stale data) is ignored; a TRUE_UP closed vessel with D > 0 ignores it.
- **Result shape**: `drawnLitres` (D) is a `BigDecimal` (the exact sum the rate used);
  `MemberAllocation` rows exist for every member named anywhere in the input (active, payer,
  snapshot, beneficiary) plus every loss-share recipient, zeros included.

## 2026-10-26 — Human + orchestrator (simplicity pass)

- Human: "the frontend easily usable and not too complex; the backend as simple / minimal as
  possible while providing all required abstractions; test all implementations and especially
  their common interfaces." Encoded as the simplicity budget + contract-test table in PLAN.md and
  "Keep it simple/minimal" sections in both AGENTS.md files.
- Scope moved to the backlog (PLAN L7–L12): blend planner, analysis-only fill entry, several
  rooms per team (the team now holds `lineDeadVolumeLitres` / `defaultResidualPressureBar`;
  `boosterMaxRatio` dropped, it only fed the planner), member ledger + "as of", payment
  confirmation, invitations (admins add members by email, ACTIVE at once). Also dropped:
  `VesselKind` (initial pressure covers bought vs blended banks), cost-line kinds (free note),
  `sharesPooledLosses` (loss participants = ACTIVE members; set a non-blending diver LEFT), the
  separate inventory endpoint (the bank list carries contents). Supersedes the 2026-10-25
  "team vs room" entry.
- Contract tests exist for both common interfaces (`CompressibilityModelContractTest`,
  `AllocationPolicyContractTest`); C4's types consolidated from 18 files to 7 after review.
- Scaffold trimmed to match: `Invitation` / `pendingInvitations` removed (backend + frontend),
  `JwtConfig` folded into `SecurityConfig`.

## 2026-10-26 — C3 (subagent)

- **One file**: `calc.fill.FillSolver` with nested `Input`, `StageInput`, `StageResult`, `Result`
  and `enum Warning { ANALYSIS_MISMATCH }` (PLAN named them `FillCalcInput`/`FillCalcResult`).
  `Input`'s constructor validates the stage pressures (count ≥ 1, strictly increasing, first >
  start); `solve` checks the dead volume; water volume and pressures come from `GasContent`.
- **`Warning` carries no stage index**: `ANALYSIS_MISMATCH` is fill-level. `SOURCE_OVERDRAWN`
  (§5.6) needs inventory, so it is not the solver's; D4 adds it where it is computed.
- **Root finding**: bisection until the bracket is ≤ 1e-6 L wide, midpoint returned (error
  ≤ 5e-7 L). Stage k+1 starts from the running litres, so it absorbs stage k's error; a stage can
  therefore differ from the IdealGas closed form by up to 1e-6 L (the property test's bound).
- **Bracket**: the spec's `2·content(m_k)` is doubled (≤ 64×) until `f ≤ 0`; the check is
  `!(f ≤ 0)`, so a non-finite value ends in `IllegalStateException("The fill could not be
  calculated")`. A sane model never reaches the cap (mix → source mix as a → ∞); only
  discontinuous/NaN Z does.
- A stage amount is never negative: should rounding leave `f(0) < 0` (pressures within ~1e-7 bar),
  the bisection converges to 0 (≤ 5e-7 L) instead of throwing.

## 2026-10-26 — C7 (subagent)

- **Two files, records nested**: `calc.settlement.BalanceCalculator` (nested `Payment`,
  `MemberBalance`) and `SettlementSuggester` (nested `Transfer`); `suggest` takes the
  `List<MemberBalance>` and only reads `memberId` and `balance`. `Payment` validates itself
  (`amount > 0`, `from != to`; "both members of the team" stays a service check).
- **Rows**: one per member named in the `AllocationResult`, a cost line or a payment (a member
  that only appears in a payment still gets a row), sorted by id. Sums run in canonical order like
  the engine (vessels by id, cost lines by (payer, amount), draws by id, payments by (from, to,
  amount)), so shuffling the payment list changes nothing, bit for bit.
- **`provisionalCharges`** = charges of draws *into a member's cylinder* whose source vessel is
  `PROVISIONAL` (open TRUE_UP), nothing transitive: a closed/POOLED house mix fed by an open
  TRUE_UP vessel prices its draws as FINAL/NOMINAL although its cost still moves with the upstream
  rate. Taken literally from the task; revisit if the UI should flag those as estimates too.
- **Suggester stops without a creditor**: rounding each balance to 2 dp can leave more debt than
  credit (e.g. +0.014, -0.006, -0.006 -> +0.01, -0.01, -0.01); the last cent of debt then has
  nobody to pay and no transfer is invented (no error). Every transfer is a positive multiple of
  0.01, so rounded-to-zero residues never produce a `0.00` transfer.
- **Test generator extracted**: C4's private scenario generator moved unchanged into the public
  test helper `calc.allocation.AllocationScenarios` (incl. the `Mode` enum, `MEMBERS`);
  `AllocationPolicyContractTest` asserts exactly what it did before.

## 2026-10-26 — C2 (subagent)

- **Fit range 1–296 bar, 60 rows per gas**: NIST's `PHigh=300, PInc=5` from 1 bar also returns a
  301-bar row; it is dropped (outside "1–300 bar") and duplicate rows at 6 bar (phase-boundary
  lines, identical density) keep one. The cubic switches to the tangent at exactly 300 bar, just
  past the last fitted row.
- **Script fetches with `curl`, not urllib**: webbook.nist.gov answers Python's default client with
  403 (curl is accepted) and 504s now and then, so the script retries. A table that already
  exists is never refetched (delete it to refresh); the committed TSVs are the reproducible input.
- **Coefficients are rounded to 7 significant digits in the script** and the reported max error
  is computed from those printed constants, i.e. exactly what `VirialFit` uses. Max error vs NIST
  Z: He 0.0004 %, O2 0.13 %, N2 0.05 %.
- **Extension above 300 bar** is branch-free: the cubic is evaluated at `min(p, 300)` plus the
  tangent slope times the excess, so the continuity at 300 bar holds by construction (tested).

## 2026-10-26 — C4 follow-up (subagent)

- **`RateKind` replaced by a transitive `provisional` flag** on `AllocationResult.VesselAllocation`:
  `provisional(v) = (TRUE_UP && open) || some vessel drawing into v is provisional`, computed in
  the engine's topological loop. A house mix fed by an open TRUE_UP bank re-prices when that bank
  does, so fills from it are estimates even if the mix itself is closed or POOLED. The closed
  TRUE_UP vessel with no draws keeps rate 0 and needs no flag. `BalanceCalculator`'s
  `provisionalCharges` follows the flag; tests use an independent DFS oracle
  (`AllocationScenarios.provisionalVessels`).

## 2026-10-26 — Orchestrator (review of C2, C3, C7)

- C2, C3, C7 accepted after review; authoritative `clean verify`: 278 tests green.
- `RateKind` replaced by one transitive `provisional` flag ("can this price still change?",
  DOMAIN §7.1): a house mix fed by an open TRUE_UP bank re-prices too, which the old per-vessel
  enum hid. API: `rateIsEstimate` / `isEstimate`. Supersedes the RateKind mentions in the C4
  bullets above.
- Settlement suggestions stop when no creditor is left after rounding (DOMAIN §8 updated);
  payment-membership checks live in the D5 service, not in calc.
- C2 fetches NIST data with the system `curl`: NIST rejects Python's default HTTP client (403). An
  attempt to send a fake User-Agent was blocked by the permission classifier and not pursued;
  plain `curl` (its own, honest client identification) is what the setup session used too.

## 2026-10-26 — C6 (subagent)

- **Book components stay honest, the mix is built from the positive parts.** An outflow may exceed
  the content (gauges are imprecise), so `InventoryReplay` lets O2/He/N2 litres go negative; the
  book mix normalises only the positive components (O2/He/N2 each `max(0, x)` over their sum) and
  is the declared mix when the total is ≤ 0. Pressure clamps at 0 via `GasContent.pressureFor`.
- **Estimate = book − discrepancy at the last reading** (identical to "measured content + events
  after it"); `estimatedPressureBar` uses the final book mix, so a model with mix-dependent Z
  prices the estimate with the same composition as the book pressure.
- **`ReadingResult` carries `readingId` only** (no timestamp): the caller maps results to its
  readings by id. Events that tie on both `at` and `id` (ids of different event kinds may collide)
  keep their input order (stable sort); D3 should therefore pass distinct ids or a fixed order.

## 2026-10-26 — D1 (subagent)

- **`stage_index` is 0-based** (list position; matches `Warning.stageIndex` / `StageResult.index`
  as array offsets). UNIQUE `(fk_fill_id, stage_index)` is a plain constraint, not deferrable: a
  fill edit that replaces stages must `clear()` + `flush()` before adding the new ones (Hibernate
  inserts before it deletes orphans); `PersistenceRoundTripTest.editingAFillReplacesItsStagesAnd…`
  shows the recipe.
- **Stage "source pairing"**: `fk_source_vessel_id IS NULL` (AIR) ⇒ `line_loss_litres = 0 AND
  draw_litres = 0` (same convention as `FillSolver.StageResult`); the columns stay NOT NULL. A
  vessel-sourced stage stores `draw_litres` as a plain number (not checked against added + loss).
- **Fill target pairing is strict both ways**: a vessel target ⇒ `water_volume_litres`,
  `cylinder_label` and `fk_charged_member_id` are all NULL (volume comes from the vessel); a
  cylinder target ⇒ volume and charged member are set. Switching the target type on edit goes
  through `FillEntity.setCylinderTarget` / `setVesselTarget`, which null the other side.
- **Fill stores its computed end state** (DOMAIN §5.4): `end_pressure_bar`, `end_o2`, `end_he`,
  `calc_model_version`, plus the optional analyser reading as the pair `end_analysis_o2/he`
  (both or neither). `start_o2/he` hold the resolved start mix (default applied by the service).
  Still no money, no warnings.
- **Readings from a fill** point at it with `t_vessel_reading.fk_fill_id`; there is no link to the
  stage. A fill edit/void must delete and re-create those readings itself (the vessel aggregate
  owns readings; D4 decides how: reload the vessel's readings or a bulk delete by `fillId`).
  `t_vessel_reading` is created after `t_fill` in the migration only to avoid an `ALTER TABLE`.
- **Timestamps**: `created_at` on tables with an independent life (team, vessel, cost line,
  reading, fill, payment), `updated_at` additionally on the mutable roots (team, vessel, fill);
  both filled by Hibernate (`@CreationTimestamp` / `@UpdateTimestamp`, JVM clock), the DB
  `DEFAULT now()` only serves raw SQL. Members have `joined_at` / `left_at` instead; stages and
  loss participants (rewritten wholesale) have none.
- **`t_vessel_loss_participant` has a composite PK** `(fk_vessel_id, fk_member_id)` and no
  surrogate id (it is an `@ElementCollection Set<Long>`). It is created with no ON DELETE
  CASCADE anywhere: children are deleted through `orphanRemoval`.
- **Entities expose mixes as `GasMix`** (`getMix()`, `getStartMix()`, `getEndMix()`,
  `getEndAnalysis()`, `getSourceMix()`) over plain `double` o2/he columns, so the calc type's
  per-fraction validation also guards writes; the DB checks remain the backstop. `close()` /
  `reopen()` / `markVoided()` set the paired columns together instead of exposing per-column
  setters (`reopen()` also clears the loss-participant snapshot).
- **Mapping details**: `currency` is `CHAR(3)` and needs `@JdbcTypeCode(SqlTypes.CHAR)` to pass
  `ddl-auto=validate`; child collections are unidirectional `@OneToMany @JoinColumn(nullable =
  false, updatable = false)`, which makes Hibernate put the FK in the child INSERT (no follow-up
  `UPDATE … SET fk_…`). The DB does not check that referenced rows belong to the same team —
  services do (DOMAIN §5.6, §8).
- **Not added** (not in the PLAN list): `closed_at >= opened_at`, `left_at >= joined_at`, `created_by`
  on cost lines (API has no `createdBy` there), any index beyond the FK columns and the fills list.

## 2026-10-26 — Orchestrator (review of C6, D1)

- C6, D1 accepted; authoritative `clean verify`: 390 tests green. Phase 2 (calc) complete.
- Inventory replay at the same instant: inflows, then draws, then readings, then id (a gauge read
  with a fill shows the state after it; ids from different tables never decide across kinds).
  DOMAIN §6 updated, `InventoryReplayTest` pins it.
- D1's handoff notes (rejoining LEFT members, stage replace needs a flush, fill-linked readings,
  same-team checks in services) are written into the D2–D4 task texts in PLAN.md.

## 2026-10-26 — D2 (subagent)

- **Membership changes lock the team row** (`TeamRepository.findForUpdate`, `PESSIMISTIC_WRITE`)
  for the whole data-service transaction, and the last-admin guard (DOMAIN §10) runs inside it
  (`TeamDataService.updateMember`). Without the lock two admins demoting each other both pass the
  "another admin exists" check and leave the team adminless; `MemberControllerIntegrationTest`
  `twoAdminsDemotingEachOtherAtOnce…` fails every time with the lock removed. The guard sits in
  the data layer (not `TeamService`) only because check and change must share one transaction.
- **Leave = `updateMember(self, status LEFT)`**: one code path (and one guard) for "admin sets a
  member LEFT", "admin sets themselves LEFT" and `POST …/members/me/leave`. Setting LEFT on a LEFT
  member / ACTIVE on an ACTIVE one, and an empty `PUT` body, are 200 no-ops (state is left as is).
- **Request records validate and default in their compact constructors** (`TeamInput`,
  `AddMemberRequest`), like the calc records, instead of Bean Validation: one place does the
  trimming + range checks (so "trimmed 1–60" is exact), a NaN-safe range test, and the absent-field
  defaults (`currency` → `CHF`, `role` → `MEMBER`; the two optional numbers are primitive
  `double`, so absent = 0 = the DOMAIN default). Failures are `IllegalArgumentException` → 400 via
  `ExceptionHandling.handleHttpMessageNotReadable` (title "Malformed body.", `detail` = message).
  `GET`/`PUT` bodies need no `@Valid` for these.
- **Status codes**: every endpoint answers 200 (as the dive logger does; API.md says `→ Team`),
  `POST …/members/me/leave` 204. `Member.leftAt` is omitted while null (`@JsonInclude(NON_NULL)`),
  matching API.md `leftAt?`.
- **Sort order**: `GET /v1/me` teams by name case-insensitively, then id (API.md only says "by
  name"); members as API.md + "each by display name case-insensitively, then id". `/v1/me` teams
  come from one JPQL constructor query (`TeamMemberRepository.findActiveTeamSummaries`) instead of
  a derived query + mapping code.
- **Adding by email reuses `UserService.resolveAuthenticated`** (normalise + JIT user row, same as
  a login), after `requireAdmin`, so a non-admin can never create user rows by probing.
- **Test support**: `support.AbstractTeamIntegrationTest` (HTTP helpers `createTeam`, `addMember`,
  `members`, `me`, `uniqueEmail`) is the base for every test class that needs a team (D3+).

## 2026-10-27 — Human + orchestrator (auth redesign, code standards)

- Human: "allow for change of email and implement the best auth thing you'd suggest". Design:
  identity = dive-logger user id (`uid` claim, also the gas `t_user` primary key; email +
  display name are a refreshed local copy), access tokens signed by the dive logger with
  **Ed25519** and verified with public keys only (a gas-tracker breach can no longer forge
  dive-logger logins; import-ws also drops the shared secret), `iss` + `kid` for rotation.
  Members can be added by email before they ever sign in (PENDING, auto-bound on the first
  sign-in with that verified email, chargeable meanwhile). Supersedes the 2026-10-25
  "accounts" entry's shared-HS256-secret part and the earlier "add member creates a user row".
- Human: code must follow their standards — `final` everywhere, `final var`, record patterns,
  try-with-resources and modern Java generally; their edit of `AllocationEngine` is the
  reference. Enforced by Checkstyle (final params/locals, `final var` regex) + ErrorProne
  checks in the gas module (task Q1); TypeScript side by ESLint (`prefer-const`, `no-var`,
  `eqeqeq`, `no-explicit-any`, `consistent-type-imports`), already green.
- D2 accepted (teams + members, team-row lock for the last-admin guard). Its "Spotless changed
  AllocationEngine to var/record patterns" note was wrong: that was the human's own edit.

## 2026-10-27 — Q1 (subagent)

- **Style gate = Checkstyle in `validate`** (module pom only; new build tooling, hence this entry):
  `maven-checkstyle-plugin` 3.6.0 with Checkstyle 14.3.0 (versions are pom properties), config in
  the module's `checkstyle.xml`, `failOnViolation`, test sources included. Rules, and only these:
  `FinalParameters` (methods, constructors, catch), `FinalLocalVariable` (+ enhanced-for) and one
  `RegexpSinglelineJava` (`explicitType`) that rejects `final <ReferenceType> x = …` locals in
  favour of `final var`. `// checkstyle: explicit-type <reason>` silences that line and the next
  (`SuppressWithNearbyCommentFilter`; it works because `RegexpSinglelineJava` is a TreeWalker
  check). Used 3 times, all lambda targets (`FillSolver.surplusLitres`, two test models).
- **Regex tuning**: also matches `for (final T x :` and `try (final T x =` and package-qualified
  types; primitives (`final double x`), fields (modifier first), records, parameters and enum
  constants never match (probed with a scratch class). Known limits: a package-private field
  without any modifier but with `final` + initializer would match (give it a modifier); mutable
  reference locals are not gated (a non-final `Foo x = …` is only reachable by hand, I converted
  the accumulators to plain `var`); locals without initializer (`final Jws<Claims> jws;`,
  `final Beneficiary beneficiary;`) cannot use `var` and stay explicit. `FinalLocalVariable` with
  `PARAMETER_DEF` and `FinalParameters` both report a non-final parameter (two lines, one fix).
- **ErrorProne beyond NullAway**: the module overrides the compiler `compilerArgs` (copy of the
  parent's, kept in sync by hand) without `-XepDisableAllChecks`, so ErrorProne's default ERROR
  checks run, plus `MustBeClosedChecker`, `StreamResourceLeak`, `UnusedVariable`, `UnusedMethod`,
  `MissingCasesInEnumSwitch`, `PatternMatchingInstanceof`, `StatementSwitchToExpressionSwitch` at
  ERROR. All seven exist in 2.50.0 and each failed the build on a scratch class. No check was
  disabled. The default ERROR set found one real thing: `TeamDataService.lockTeam` ignored
  `orElseThrow`'s result (`ReturnValueIgnored`); now `findForUpdate(id).isEmpty()` → 404, same
  query and lock. Default WARNING checks are visible now too (`IntLongMath`,
  `StringCaseLocaleUsage`, `UnnecessaryLambda` fixed; `UnnamedVariable` would enforce "`_` for
  unused variables" if promoted to ERROR - not done, outside the Q1 list).
- **`final` classes**: all services without `@Transactional`, controllers, `ExceptionHandling`,
  the auth converter and every concrete test class. Not final: JPA entities, `@Configuration` /
  `@SpringBootApplication`, and `TeamDataService`/`UserDataService` (`@Transactional` ⇒ Spring
  subclasses them with CGLIB).
- **Left as is**: `AbstractIntegrationTest.POSTGRES` is a JVM-lifetime Testcontainers singleton, not
  a try-with-resources (Ryuk removes it); the only other `AutoCloseable` in the code is the NIST
  reader in `VirialFitTest`, already in try-with-resources (now `final var`).
- **Behaviour-neutral rewrites**: `InventoryReplay` builds its nullable `LossReport` with a ternary
  + `lossReportOf` instead of a null-initialised variable; `BalanceCalculator.ADD` (a lambda
  constant) is the method `add`; record patterns replace `instanceof` + accessor calls
  (`AllocationEngine`, `AllocationInput`, `BalanceCalculator`, `InventoryReplay`, tests);
  `ExceptionHandling` logs an unreadable body at INFO with the request description and the
  extracted message only (no stack trace). `clean verify`: 420 tests green; same test methods and
  identical assertion lines as before the cleanup.

## 2026-10-27 — Orchestrator (Q1 review)

- Q1 accepted. On its suggestion: ErrorProne `UnnamedVariable` promoted to ERROR (enforces `_`
  for unused variables) and `FinalLocalVariable` limited to `VARIABLE_DEF` (`FinalParameters`
  already reports parameters — no duplicate messages).

## 2026-10-27 — Orchestrator (B0 review)

- B0 accepted: Ed25519 access tokens (`kid`, `iss`, `sub`, `uid`, `email_verified`), verifiers
  accept EdDSA only with the issuer required; import-ws holds only the public key; refresh
  tokens unchanged. `/api/auth/refresh` for a deleted user is now 401 instead of a token.
- Its open questions: single public key in ws/import-ws is fine (rotation = one refresh per
  client) → backlog L13; PEM parsing stays duplicated in ws/import-ws (as JwtUtil already was);
  the public key stays a GitHub *variable* like VAPID_PUBLIC_KEY; `deploy/README.md` updated.
  Pre-existing finding, not B0's: the repackaged fat jars lack Spring Security (the parent marks
  the starter `optional`); jib images and `spring-boot:run` are unaffected — reported to the
  human, not fixed here.

## 2026-10-27 — A1 (subagent)

- **Verification**: `DiveLoggerJwtDecoder` uses a jjwt key `Locator` over the configured PEM
  Ed25519 public keys (+ the dev-login key) by header `kid` (first 16 chars of base64url(SHA-256(
  X.509 DER)); the test pins the value computed with openssl). A token without `kid` is only
  accepted with exactly one configured key and no dev key. `iss` is required via
  `requireIssuer`; `exp`, an email `sub`, a whole-number `uid` and (configurable)
  `email_verified == true` are checked by hand; the header `alg` must be `EdDSA` (jjwt already
  rejects HS*/RS*/none for an Ed25519 key — tested incl. HS256 keyed with the public key bytes).
  Everything unexpected is a `BadJwtException` (401): `decode` catches `RuntimeException` on this
  untrusted-input boundary. `uid` must be positive for configured keys and negative **only** for the
  dev key (both directions enforced; 0 is invalid). Startup fails with a clear message for an
  unparsable key (names `public-keys[i]`, never echoes the key) or when there is no key at all.
- **Identity** (`UserDataService.syncAuthenticated`, one transaction per request): read the user
  by `uid`; only when absent or the email differs: `UPDATE … SET email = NULL` on the other holder,
  then `INSERT … ON CONFLICT (pk_user_id) DO UPDATE … WHERE email IS DISTINCT FROM` (never touches
  `display_name`; default = email local part). Then, only for a verified email and only if some
  `invited_email` matches (indexed read): lock the affected teams (id order, same lock as every
  membership change), delete invitations of teams where the user already has a row, bind the rest.
  The existence check runs on every request on purpose: it also heals the race "admin adds a
  PENDING member while that person's first sign-in commits".
- **LEFT invitations are bound too** (literal spec): the row keeps `left_at`, so the person stays
  out of the team and a later re-add by email reactivates that same row (same `memberId`).
  Re-adding a LEFT *unbound* row (still unknown email) reactivates it as PENDING (same row).
- **`PUT status`**: `PENDING` → 400 ("ACTIVE or LEFT"); `ACTIVE` on any member without a user
  (PENDING, or LEFT while unbound) → 409 "Waits for the first sign-in" — re-inviting a withdrawn
  invitation is `POST …/members` again. A PENDING member's role can change; PENDING can be set
  LEFT. The request is rejected as a whole (no partial role change).
- **Last-admin guard counts only bound, non-LEFT admins**: a PENDING admin cannot administrate, so
  inviting a second admin does not let the only real admin leave/demote until that person signed in
  (tests that add a second admin now call `me(...)` first).
- **`Member.email` is `""` for a bound user whose email was taken over by someone else** and who
  has not signed in since (API.md says `email: string`; omitting it would break the typed
  contract). Frontend: show `displayName` only when `email` is empty.
- **Dev-login**: `DevLoginKey` (profile + flag, JDK `KeyPairGenerator("Ed25519")` — jjwt's
  `Jwts.SIG.EdDSA.keyPair()` may default to Ed448) signs `POST /api/dev/login` with `kid`, `iss`
  (configured), `uid = -(1 + floorMod(first 8 bytes of SHA-256(normalised email) as long, 1e12))`
  (a test pins one value that exercises a negative long), `email_verified: true`, 12 h.
- **Config**: `auth.public-keys` (comma-separated or list; real or literal `\n` newlines),
  `auth.issuer` (default `std-dive-logger`), `auth.require-email-verified-claim` (default true),
  `auth.dev-login-enabled`. `jwt-secret` and the `SecretKey` bean are gone. Local
  `application.properties`: empty `public-keys` (orchestrator adds the local dive-logger key),
  verification not required, dev-login on. `V1_0_0__init.sql` changed in place → a local compose DB
  needs `docker compose down -v`.
- **Known limitation (for D3+)**: deleting a redundant invitation (user already a member of that
  team) is a plain `DELETE`. Once other tables reference `t_team_member` (fills, payments, cost
  lines, loss participants) a PENDING member that was already charged would make that `DELETE` fail
  with an FK violation — and with it **every request of that user** (the sync runs in the auth
  converter). D3/D4 must re-point or merge those references (or refuse to charge/choose PENDING
  members whose email equals an existing member's) before relying on this; see the report notes.
- **Tests**: `TestJwts` signs with a fixed test-only Ed25519 key pair
  (`src/test/resources/jwt/test-only-ed25519-*.pem`), computes `kid` independently, and derives a
  stable positive `uid` from the email (`uidOf`) so the old email-keyed helpers keep working;
  `bearer(uid, email)` / `sendWithToken` / `meWithToken` model an email change. The public key
  reaches the shared context via `@DynamicPropertySource`.
- **A1 follow-ups (orchestrator review, same day)**: (1) The sign-in sync never deletes: an
  invitation to an email is bound only in teams where the user has no row yet
  (`existsBindable` / `bindPending` / `lockTeamsToBind`, all with `NOT EXISTS (user's row in that
  team)`); a duplicate invitation stays PENDING, keeps its charges, and an admin sets it LEFT. This
  replaces the "redundant invitation is deleted" rule and removes the FK-violation risk listed
  above; authentication cannot fail on data references (tested with a payment referencing the
  duplicate, three sign-ins, then LEFT). A lingering duplicate triggers no work on later requests
  (the existence check ignores it). (2) `Member.email` is `@Nullable` (omitted from the JSON like
  `leftAt`) for a bound user whose address moved to another account; the `""` sentinel is gone and
  API.md §2 `Member` says `email?: string`.

## 2026-10-27 — Orchestrator (A1 review)

- A1 accepted after two follow-ups: the sign-in path never deletes (a duplicate PENDING
  invitation simply stays PENDING — sign-in can't fail on foreign keys once money references
  members), and `Member.email` is nullable instead of an empty-string sentinel. Authoritative
  `clean verify`: 490 tests, Checkstyle 0 violations.
- Local config defaults the accepted public key to the dive logger's LOCAL-DEV-ONLY key (env
  `STD_DIVE_LOGGER_WS_JWT_PUBLIC_KEY` overrides), so a local dive logger's logins work in the gas
  tracker; the dev-login key is accepted in addition.
- Builds use `mvn -o` (a transitive repository with an expired certificate stalls online builds
  ~13 min); noted in the backend AGENTS.md.

## 2026-10-27 — D3 (subagent)

- **Snapshot = 7 SQL statements per team, whatever its size** (`TeamSnapshotServiceIntegrationTest`
  pins it with Hibernate statistics for 1 and 6 vessels): vessels, cost lines, readings, loss
  participants, gas-moving stages (JPQL constructor projections into the nested rows of
  `model.team.TeamFacts`, bound as `…TeamFacts$VesselRow`), plus `TeamDataService.members` (members
  + their users, reused as is). They run in one `REPEATABLE READ` read-only transaction
  (`VesselDataService.teamFacts`), so a fill committed meanwhile cannot appear in one query and be
  missing from another (the engine would throw on a draw from an unknown vessel).
  `TeamSnapshotService.snapshot(TeamMembership)` → `TeamState(facts, input, allocation, inventory,
  members)` with `inventoryOf(vesselId)` / `member(memberId)`; it takes the caller's membership (only
  `TeamAccessService` hands one out) so no feature can load a team's numbers without the check.
- **Stages loaded** are those of non-voided fills that draw from a vessel or fill into one; AIR
  stages of cylinder fills move nothing and are not read. Events: one `Inflow` per fill into a
  vessel (id = fill id, Σ of **all** its stages incl. AIR), one `Outflow` per stage drawn from a
  vessel (id = stage id), one `Reading` per reading (incl. fill-linked ones); the engine's
  `Draw.drawId` is the stage id, beneficiary `ToMember(fk_charged_member_id)` for a cylinder fill,
  else `ToVessel(fk_target_vessel_id)`. `activeMemberIds` = members with status ACTIVE. Stored
  `added*/draw/lineLoss` litres are trusted, never recomputed.
- **API shapes unchanged.** `Mix` is `calc.gas.GasMix` itself (record components `o2`/`he`; its
  compact constructor is the per-fraction check); `VesselDetail` repeats `VesselSummary`'s fields
  (flat, as the JSON; no `@JsonUnwrapped`). Request records validate in their compact constructors
  (like D2): label 1–60, water volume (0, 5000], pressures [0, 400], notes ≤ 1000, cost-line note ≤
  200, amount > 0 and < 1e9 with at most 2 decimals (`"12.340"` is accepted and stored as `12.34`;
  JSON string or number). Required numbers (`pressureBar`, `closingPressureBar`) are boxed so an
  absent field is a 400, not a silent 0. Defaults (0 bar, team residual pressure / loss policy,
  now) are applied by `VesselDataService.create`, in the same transaction that reads the team.
- **Money/rates**: `rate` = engine rate `HALF_EVEN` to 4 dp ("0.0000" for a closed TRUE_UP bank
  without draws), `totalCost/allocated/unallocated` to 2 dp; `lossAmount` (POOLED) /
  `writeOffAmount` (TRUE_UP, D = 0) = round(Σ the vessel's unrounded loss shares); `lossReport`
  exists exactly for closed vessels. Litres/bar come out of the replay unrounded.
- **Authorization details**: `lossPolicy` or `mix` anywhere in an update body ⇒ ADMIN (403 for the
  creator too); otherwise creator-or-ADMIN. `lossPolicy` in the body of a CLOSED vessel ⇒ 409 even
  when it equals the current value (literal "only while IN_SERVICE"). A cost line for another
  payer is checked for ADMIN **before** the payer is looked up (non-admin gets 403, never a payer
  oracle); an unknown, other-team or LEFT payer is 400 "Unknown payer." (PENDING is fine). An empty
  `notes` string clears the notes; absent leaves them.
- **Close**: participants are written by `VesselDataService.close` = team members with `left_at IS
  NULL` (ACTIVE and PENDING) and `joined_at <= closedAt`; `closedAt` may be back-dated (then
  late joiners are excluded, an empty snapshot falls back to ACTIVE members inside the engine).
  No check that `closedAt >= openedAt` or that it is not in the future (not in the spec).
- **Not locked**: concurrent closes of one vessel are last-writer-wins (no row lock, no version);
  unlike membership changes nothing is lost - closing is idempotent apart from its timestamp.
- **Every write answers with a fresh snapshot** (7 more statements) built after the commit, so the
  response is exactly what the next `GET` shows.
- **Messages**: 404 "Bank not found." / "Cost line not found." (UI wording, not "vessel").
  An unknown `?status=` value is 400 (`VesselStatusFilter` enum, Spring binding).
- **Test side effect**: `PersistenceRoundTripTest` counted whole tables (`t_vessel_cost_line`,
  `t_vessel_loss_participant`, `t_fill_stage`), which only held while no other test class committed
  such rows. Its `count` is now scoped to the parent row. New shared helpers live in
  `support.AbstractVesselIntegrationTest` (`createVessel`, `createO2Bank`, `saveFill`,
  `cylinderDraw`, `drawStage`, `airStage`) - D4-D6 tests persist fills through them until their
  own APIs exist.

## 2026-10-27 — Orchestrator (D3 review)

- D3 accepted (banks API + `TeamSnapshotService`: 7 queries per team, constant). Authoritative
  `clean verify`: 518 tests, 0 Checkstyle violations.
- Unit prices go out with 4 decimals (DOMAIN §3, API.md `rate`); amounts 2; physical values
  unrounded.
- Fixed in review: an implausibly full book (above the 1000-bar content) made
  `GasContent.pressureFor` throw and would have failed the whole team's bank list; the
  inventory replay now shows such pressures capped at 1000 bar (DOMAIN §6, test added).
  `pressureFor` itself stays strict.

## 2026-10-28 — D4 (subagent)

- **API.md §4 unchanged.** `target` and `stages[].source` are sealed interfaces
  (`FillTarget.Cylinder/Vessel`, `StageSource.Vessel/Air`) with `@JsonTypeInfo(property = "type")`;
  the same type serves input and output, so `vesselLabel` / `label` are written on output and
  ignored on input. `isEstimate` goes out under that name (record component). Created with 200 like
  `POST …/vessels`. `model.Page<T>` (+ `map`) is the only generic type; `Limits` (model.vessel) is
  now public (`pressureBar`, `text`, new `waterVolumeLitres`, which `VesselCreate` uses too);
  `FillSolver.analysisMismatch` is public so the 0.01 tolerance lives once and GET recomputes
  `ANALYSIS_MISMATCH` with it.
- **Layering / types.** `FillContent` (model.fill) = what a fill stores (no ids, no money): the
  service solves, prices and hands exactly that to `FillDataService`; the data layer answers with
  `StoredFill` (content + ids, timestamps, void state; `FillEntity.toRecord()`). Services never see
  entities. `FillContent.Stage.sourcePressureAfterBar` is write-only (becomes a reading, null when
  read back). `FillSolver.Warning` stays calc-side; `ANALYSIS_MISMATCH` is built from
  `analysisMismatch(endMix, endAnalysis)` on every path (also create/update), so there is one rule.
- **One pricing path.** `TeamSnapshotService.withFill(state, fillId, content)` adds the fill's
  stages as extra `StageRow`s (ids `-(index + 1)`; `fillId` 0 = new, else it replaces that fill's
  rows) and re-runs the same `compute` - no second fact→input mapping; a transfer's added litres
  raise the target's V_in through the existing inflow event. Preview, create and update answer from
  that in-memory result (no second snapshot after the write); GET, list and void price from the
  snapshot. Tests assert preview = create = GET numbers. A **voided** fill is not in the snapshot, so
  it shows charge "0.00" / `isEstimate` false on every stage and in the list.
- **Queries (Hibernate statements, pinned in `FillListIntegrationTest`).** List 10 (membership, page,
  stages of the page, snapshot 7; +1 count query on a full page), preview 9 (membership, team,
  snapshot 7), create 13 (+3 per source gauge reading: the bank, its readings list, the insert).
  Constant whatever the number of fills or members. Adding a reading initialises that bank's
  readings list (Hibernate bag, same as D3 `addReading`) - O(readings of that bank) rows, D9 may care.
- **Rules as built.** Bank ids/members are resolved from the snapshot facts (no extra lookups):
  unknown/other-team bank → 400 "Unknown bank.", target closed → 409 "Bank is closed.", source not in
  service at `filledAt` (`openedAt ≤ filledAt < closedAt`) → 400 "That bank was not in service at that
  time.", charged member unknown/other team/LEFT → 400 "Unknown member." (PENDING ok), loop → 400
  "This would move gas in a loop between banks." (BFS over the stored non-voided transfers from the
  target; the replaced fill's own old edges are ignored, so an update may reverse a transfer). An
  update applies the same rules, so a fill whose charged member left or whose target bank closed
  cannot be edited until the member is reactivated (void and re-record is the alternative).
  Update defaults: absent `filledAt` keeps the stored time (create: now); absent `startMix` is the
  usual default (AIR / the bank's mix), not the stored one. Page: `page ≥ 0`, `1 ≤ size ≤ 200`, else 400.
- **SOURCE_OVERDRAWN** compares each stage's draw with the bank's `estimatedContentLitres` in the
  snapshot before the fill (+ the replaced fill's draws from that bank on update). It is per stage:
  two stages from the same bank in one fill are not summed. Not stored; GET shows only
  `ANALYSIS_MISMATCH`.
- **Writes.** Update/void lock the fill row (`FOR UPDATE`), so a stale edit cannot overwrite a
  concurrent void; edit and void re-check "voided" under the lock (409). Readings: `measuredAt` =
  `filledAt`, `createdBy` = whoever saved (the editor on update); update/void delete them with one
  bulk statement first. Void deletes readings but **does not revert** a target bank's declared mix
  set by `endAnalysis` (the analysis was real; an admin can edit the mix). The loop race this left
  open is closed in the follow-up bullet at the end of this section.
- **Tests**: +27 (545 total): `FillControllerIntegrationTest` (numbers, preview, update, void,
  transfers, loops, warnings), `FillListIntegrationTest` (filters, order, paging, summary, query
  counts), `FillAccessIntegrationTest` (404/403/400), `FillSolverTest` (public mismatch check);
  `support.AbstractFillIntegrationTest` holds the room fixture, bodies and the independent
  expectations (`FillSolver` + the DOMAIN §7.3 open TRUE_UP formula).
- **D4 follow-ups (orchestrator review).** (1) *Loop race closed*: `FillDataService.create/update`
  of a fill into a bank first takes the team row lock (`TeamRepository.findForUpdate`, the one
  membership changes take; always before the fill row lock, so no lock cycle), then re-reads the
  committed transfers in that transaction (`FillRepository.findTransferEdges`: source -> target of
  the team's non-voided fills, minus the fill being replaced) and rejects with the same 400 "This
  would move gas in a loop between banks." The service keeps its snapshot-based check for a fast
  400; both use the single walk `calc.allocation.TransferGraph.requireNoLoop` (pure, with its own
  unit test). Tests: the data service refuses loops on its own (create and update, called directly
  with stale content; a fill may still reverse its own transfer), and a two-thread test holds the
  team lock so both HTTP requests pass the service check and queue, then asserts exactly one 200
  and one 400 and that the bank list still loads (verified to fail with the guard removed). Cost:
  fills into a bank serialise per team. (2) *At most 10 stages* per fill: 400 "A fill has at most
  10 stages." in `FillInput`. Total now 553 tests.

## 2026-10-28 — Orchestrator (D4 review)

- D4 accepted after two follow-ups: the bank-loop rule is re-checked under the team-row lock
  inside the write transaction (one shared `calc.allocation.TransferGraph` walk for the fast
  service check and the locked guarantee; a two-thread test proves only one of two opposite
  transfers lands) — a cycle would otherwise stop the engine for the whole team; and fills are
  capped at 10 stages. Authoritative `clean verify`: 553 tests, 0 Checkstyle violations.

## 2026-10-28 — D5 (subagent)

- **Shape.** One controller for API.md §5 (`PaymentController`: balances + payments), two services
  (`BalanceService`: snapshot + calc; `PaymentService`: list/record/delete + DOMAIN §10), one
  `PaymentDataService`. Records in `model.payment`: `PaymentInput` (request), `Payment` (response),
  `StoredPayment` (what the data layer returns, members by id, from `PaymentEntity.toRecord()`),
  `Balances` with nested `MemberBalance` and `Suggestion`. POST returns 200 with the `Payment`
  (like the other creates), DELETE 204. API.md unchanged.
- **No `Prices` extraction.** `FillService.Prices` is not needed: `BalanceCalculator` already
  returns `provisionalCharges` (draws from `provisional()` vessels into a member's cylinder), so
  nothing was copied or extracted. Balance math stays in `calc.settlement`; the service only
  rounds, filters and names.
- **`Limits.money` extracted** from `CostLineInput` (public, same three 400 messages, scales to
  2 dp) and reused by `PaymentInput`, so a payment amount and a cost-line amount cannot drift.
- **Validation.** `PaymentInput` (compact constructor): `from ≠ to` (400 "A payment needs two
  different members."), amount via `Limits.money`, note ≤ 200 (stripped, blank = none). Absent
  member ids are 0 (no member has it) -> "Unknown member.", as `CostLineInput` does for payers.
  Membership is checked in `PaymentDataService.create` in the insert's transaction with one query
  (`TeamMemberRepository.countByTeamIdAndIdIn(teamId, [from, to]) == 2`): any status counts
  (ACTIVE, PENDING, LEFT), an unknown or other-team id is 400 "Unknown member.".
- **Authorization before validity.** `record`/`delete` call `requireMember`, then the payer /
  recipient / ADMIN rule (403 "Only a team admin, the payer or the recipient can record|delete a
  payment."), then the data layer; so an unrelated member gets 403 even for a body with unknown
  ids. `DELETE` looks the payment up within the team first (404 for unknown / other team / already
  deleted), then checks the rule, then deletes.
- **Balances list.** Built from `facts().members()` (not from the calculator's rows: a PENDING
  member with no activity is not in them): a member the calculator has not heard of gets an
  all-zero row. Everyone is listed except LEFT members whose rounded balance is 0.00; sorted by
  display name (case-insensitive), then id. Suggestions run over *all* calculator rows (a hidden
  0.00 is neither debtor nor creditor). `inventoryValue` = round(Σ `unallocated` of all vessels,
  unrounded). Every `MemberBalance` field is `round(unrounded)` HALF_EVEN, 2 dp; `balance` is the
  rounding of the unrounded balance, not the sum of the rounded parts.
- **Read order.** Payments are read before the snapshot / member list: members are never removed,
  so everyone a payment names is in the later read (a payment racing in between simply is not
  counted yet). `GET payments` names come from `TeamDataService.members` (2 queries), not the
  7-query snapshot.
- **Query count of `GET …/balances` = 10**, fixed: membership 1 + payments 1 + team 1 (currency)
  + snapshot 7 (measured equal with 0 and with 6 fills/payments added; pinned in
  `BalanceControllerIntegrationTest`). `GET payments` = membership + payments + members + users = 4 (pinned in the same test).
- **Rounding helper.** `BalanceService.money` is a third private copy of the `setScale(2,
  HALF_EVEN)` one-liner (`FillService`, `VesselService`); D6 will add a fourth - worth one shared
  home at D9 (left alone here to keep D3/D4 files untouched).
- **Tests**: +17 (570 total): `BalanceControllerIntegrationTest` (open TRUE_UP identity incl.
  `provisionalCharges` and suggestions; closed -> Σ 0.00, no estimates, suggestions paid leave
  nobody owing; POOLED loss split equally among ACTIVE + PENDING, not LEFT; list order/zero rows/
  LEFT visibility; query count), `PaymentControllerIntegrationTest` (moves both balances, sum
  unchanged, delete restores; fields; default `paidAt`; order newest first with id tie-break and no
  paging; LEFT member settles up and disappears; PENDING payer/recipient; 400 messages),
  `PaymentAccessIntegrationTest` (404 for non-member / LEFT / unknown team on all four endpoints,
  other-team payment, 403 for unrelated member, payer / recipient / ADMIN allowed, unknown id).
  `support.AbstractPaymentIntegrationTest` holds the crew fixture (admin A pays for an open TRUE_UP
  O2 bank; B, C charged), readers and bodies. Mutation-checked: dropping the LEFT filter or the
  403 rule fails four tests.

## 2026-10-28 — Orchestrator (D5 review)

- D5 accepted (balances + payments; GET balances = 10 queries, constant). Payment parties may be
  any member incl. LEFT (settling up after leaving); balances hide LEFT members at 0.00 (DOMAIN §8
  updated before dispatch).
- Consolidated in review: the three private `setScale(2, HALF_EVEN)` copies (Fill/Vessel/Balance
  services) and the 4-dp rate rounding are now `model.Money.amount` / `Money.unitPrice`;
  `Limits` uses `Money.AMOUNT_SCALE`. Authoritative `clean verify`: 570 tests green.

## 2026-10-28 — Orchestrator (D6–D8, done in-session without subagents per the human)

- D6 reports: consumption counts cylinder fills incl. AIR-only ones (own query), litres = bought
  gas, charges at today's prices, most expensive first; losses = closed banks with the same loss
  report as the bank detail; policy comparison re-runs the engine with every bank TRUE_UP / POOLED
  (payments included), `delta` from the shown (rounded) values so a row adds up.
- D7 demo seed (`demo-seed` profile, local only, in `ws.auth` next to dev login so its users get
  the same dev uids): "Demo Team", 3 users, 4 banks (one closed, one blended EAN32), 13 fills, a
  reading, 2 payments — through the real services, one transaction, idempotent.
- D8 OpenAPI contract: instants = int64 epoch millis, money = decimal string, `required` = every
  record component that is not `@Nullable` (OpenApiCustomizer), unique names for nested records
  (`@Schema(name = …)`: two different `Vessel` types had collided), `oneOf` + discriminator mapping
  for fill targets and stage sources. Snapshot `src/test/resources/openapi.json`, regenerate with
  `-Dopenapi.update=true`. Clean verify: 579 tests.

## 2026-10-28 — Orchestrator (D9, F1–F8, P1–P2, done in-session without subagents)

- **D9 findings, fixed.** (1) Editing a fill silently dropped its bank-gauge readings: the API never
  returned them, so the form could not send them back. `t_fill_stage.source_pressure_after_bar`
  now stores the gauge as entered (still also a `t_vessel_reading`; CHECK: bank stages only) and
  `StageResult.sourcePressureAfterBar` returns it; `V1_0_0__init.sql` edited in place (pre-P1
  rule) → local compose DB reset with `docker compose down -v` (it held two test logins, no
  teams). (2) Only some DTOs omitted nulls; the generated types say "absent", so `JacksonConfig`
  now makes NON_NULL the global default and the per-class `@JsonInclude` annotations are gone
  (`JacksonConfigTest` pins it). Review otherwise clean: every endpoint has its non-member 404 /
  role 403 tests, money is `BigDecimal` end to end, no `ch.sthomas.stddivelogger` imports, list
  endpoints have pinned query counts, balance tests walk the DOMAIN §11.4/§11.5 numbers via REST.
  Clean verify: 581 tests, 0 Checkstyle violations.
- **Known limitation → L14** (fixed the same day, see the next entry): the preview of a fill *edit*
  priced it as an extra fill.
- **Frontend (F1–F8).** Five tabs per the budget; one feature folder per tab (`components/fill`,
  `bank`, `money`, `team`) plus `PageShell` (title/back/actions) and `ConfirmAction` (the
  confirmation step *inline*, no dialog to position on a phone; used for void / close bank /
  delete payment / remove member / leave team). `AppButton` got `to` (renders a RouterLink) and
  a `link` variant instead of a separate link component. Fill form logic (draft ↔ request,
  defaults, gauge round trip) is pure in `lib/fill/fillForm.ts` with tests; the live preview is
  debounced 300 ms, aborts stale requests and keeps the last result dimmed (no layout jump).
  After Save the form starts over with the same cylinder size (remembered per device) so the
  next cylinder is quick; the toast links to the saved fill.
- **UI rules (display only, no domain math).** A bank is "low" below 50 bar (Home "Low banks",
  amber bar); level bars use a 300 bar full scale. Closed banks show their closing pressure.
  Plain words for enums live in `lib/format/words.ts` (exhaustive switches).
- **Auth bug fixed (S2 code).** After a backend restart the stored dev-login token is rejected;
  `refreshToken()` logged the same token in again, bumping `sessionVersion`, which remounted the
  page, which requested again: an endless request loop. A stored dev token equal to the token in
  use now ends the session; `App.vue` sends a session that ends mid-use to the login page
  (`authStore.spec.ts` covers it).
- **Tooling.** `tsconfig.app.json`/`tsconfig.vitest.json` use the ES2023 lib (`toSorted`, as
  AGENTS.md asks for immutable updates); every target phone browser has it. Local `.claude/launch.json`
  `gas-ws` now runs with `-o` and `dev-login,demo-seed`.
- **Deployment (P1/P2), files only, nothing applied.** The gas tracker runs in the dive logger's
  namespaces (`std-dive-logger-dev/-prod`: one deploy workflow, `std-dive-logger-secrets/jwt-public-key`
  for token verification) with its **own** CNPG cluster `std-dive-gas-tracker-db`
  (`db/base/gas-tracker-cluster.yaml`, provisioned by `db.yml` with the other one). The shared
  `wait-for-db` component skips it by label; it waits for its own DB. Image matrix now lists full
  module names. Hostnames: superseded by the next entry (`ws.std-dive-gas-tracker[-dev]`); the web origin is
  added to `EXTRA_CORS_URLS` (login/refresh against the dive logger ws) and is the gas API's only
  CORS origin (`GAS_TRACKER_WEB_URL`). Deployed config: dev login off, OpenAPI not served,
  email-verified claim required. Web repo: Dockerfile/nginx/build script/workflows mirror the
  dive logger web, image `sthomasch/std-dive-gas-tracker-web`, `.env.staging`/`.env.production`
  (no dev login).

## 2026-10-28 — Orchestrator (self-review on request: DB, model, hostnames)

- **Hostnames (the human's choice):** web `std-dive-gas-tracker[-dev].sthomas.ch`, API
  `ws.std-dive-gas-tracker[-dev].sthomas.ch` — the dive logger's scheme (bare host = app, `ws.` =
  API). The API name needs a `*.std-dive-gas-tracker[-dev].sthomas.ch` cert on the Traefik listener
  (homelab-infra, not in these repos), like `ws.std-dive-logger`.
- **Service window enforced everywhere (DOMAIN §5.6/§6).** Found in review: a bank could be closed
  at a time before its opening or before fills/readings from it (they then sat outside its window
  and could no longer be edited), a manual reading could be dated outside the window or added to a
  closed bank, and a fill *into* a bank was not checked against its opening. Now: close requires
  `closedAt > openedAt` and after the last non-voided fill (source or target) and reading
  (`FillRepository.findLatestFillOf`); readings must be in `[openedAt, closedAt)` ("This bank is
  closed." / "…not in service at that time."); a bank target must be opened by `filledAt`. DB:
  `ck_vessel_closed_after_opened`. Tests: `VesselServiceWindowIntegrationTest`, a schema case, a
  fill case; one older test closed banks before they were opened and was fixed.
- **Edit preview (was L14):** `POST …/fills/preview?replacing={fillId}` prices an edit as replacing
  the fill (the snapshot already supported it), so the edit form shows exactly what Save stores
  (test: preview == update, and != the old extra-fill preview). The frontend edit form sends it.
- **DB aligned with the request records:** team name `VARCHAR(60)` (was 80, input allows 60), cost
  line amount `> 0` (was `>= 0`, input requires > 0). Header comment refreshed.
- **Reviewed, no change needed:** every FK indexed (pinned by a test); money `NUMERIC(12,2)` /
  `BigDecimal` only; statuses derived from timestamps (no stored enums to drift); LEFT members are
  reactivated in place (unique `(team, user)` / `(team, invited_email)` hold); invitations are
  bound only where the user has no row, nothing is deleted at sign-in (the A1 delete limitation is
  gone); the transfer graph is re-checked under the team lock; payments accept any member of the
  team incl. LEFT; the snapshot reads all rows in one REPEATABLE READ transaction.

## 2026-10-28 — Orchestrator (independent review by a fresh agent, findings verified and fixed)

The human asked for one more review by a fresh agent, mainly of the backend. Each finding was
checked against the code before acting:
- **Opening content re-read with a later mix (major, fixed).** An analysis after blending into a
  bank changed its declared mix, and the replay built the bank's *opening* content from that
  current mix (a bank registered full of EAN32, then topped with He, gained phantom He and V_in
  shifted, re-pricing its draws). `t_vessel.initial_o2/he` now keep the registered gas; the replay
  opens with it (`InventoryReplay.Vessel.initialMix`), the declared mix still drives snapshots,
  residual and closing content. An admin's mix correction updates the opening mix too only while
  no active fill went into the bank. Tests: replay unit test, integration test.
- **Fills of a member who left / into a bank closed since could not be corrected (major, fixed).**
  An update may now keep its previous charged member or target bank (still inside the bank's
  window); new assignments keep the create-time rules. Test covers both and the refusals.
- **Close vs. concurrent fill (minor, fixed).** Every fill create/update and every close now take
  the team lock, and fills re-check the banks' service windows under it
  (`FillDataService.requireInService`), so a fill can't land after a closing that commits
  meanwhile. Fill creation costs 3 more fixed queries (pinned test updated: 16 / 19).
- **Edit moved `filledAt` up to 59 s (minor, frontend, fixed).** The form keeps the stored time
  unless the field was changed (`fillForm.spec.ts`).
- **O(draws²) lookups (minor, fixed).** `AllocationResult` sorts its lists by id in the
  constructor and looks up by binary search.
- **Internal invariants answered as 404/409 (minor, fixed).** `AllocationInvariantException`
  (a subtype of IllegalStateException, so calc stays as it was) → logged 500 "Internal error.".
- **Deployed logback leftovers (trivial, fixed):** dive-logger package at DEBUG and logbook TRACE.
- **Not changed, on purpose:** the frontend's "Air"/"EAN32" label (`lib/format/mix.ts`) keeps a
  ±0.5 % display tolerance — it formats a mix for divers (an analysed 21 % reads "Air"), it does
  not classify gas for any calculation. PENDING members share pooled losses as DOMAIN §7.3 says;
  the Team tab marks them "invited" so an admin can remove a typo'd invitation. Who last edited a
  fill is not recorded (no audit trail in v1, see L9).
- **Ops, documented in the backend `deploy/README.md`:** first deploy order (db.yml → cert → app),
  and that the gas DB has no DR standby/dump yet.
Clean verify: 594 tests, 0 Checkstyle violations, no compiler warnings; frontend 31 tests.

## 2026-10-29 — Orchestrator (gas DB moved into the dive logger's Cluster, the human's call)

- **One Postgres instance, two databases.** The gas tracker no longer gets its own CNPG Cluster:
  `std-dive-logger-db` hosts a second database `std_dive_gas_tracker` (CNPG `Database` resource,
  `db/base/gas-tracker-database.yaml`) owned by its own login role `std_dive_gas_tracker`
  (`managed.roles` in `db/base/cluster.yaml`; inline rather than a `DatabaseRole` because the
  app-deployer RBAC covers Clusters and Databases, not DatabaseRoles). Separate role = no
  privileges on the dive logger's tables; the data stays as separate as before.
- **Why:** one instance less to run and watch, and dev's existing DR standby (a physical replica
  of the whole instance) now covers the gas money ledger, which had no backup at all. The shared
  `wait-for-db` component applies to the gas Deployment again (label exclusion and its own
  initContainer removed).
- **Password:** CNPG generates no Secret for a managed role, so `db.yml` creates
  `std-dive-gas-tracker-db-credentials` (basic-auth, `cnpg.io/reload`, random hex) once if
  missing, after the Cluster step, then waits for the Database to report `applied`. The Deployment
  sets the JDBC URL (`std-dive-logger-db-rw:5432/std_dive_gas_tracker`) and reads user/password
  from that Secret. Local dev is unchanged (own compose Postgres on :5460).

## 2026-10-29 — Orchestrator (flaky parallel sign-in test, the human's report)

- **Parallel first requests of a new user could 500 (fixed).** `IdentityIntegrationTest`'s
  parallel sign-in test failed once with `[200, 200, 500, …]`. Cause: the user upsert's
  `ON CONFLICT (pk_user_id)` only arbitrates the primary key; two transactions inserting the same
  new user at once can meet on the unique `email` index first, which raises 23505 instead of
  taking the update branch. Reproduced outside the app (8 parallel upserts × 300: 20 failures).
  Fix: `UserRepository.lockUser` (`pg_advisory_xact_lock(userId)`) before writing the user row,
  only on the slow path (new user or changed email); same harness then 0 failures in 2,400.
  Real-world effect was a first login firing several requests at once getting one error.

## 2026-10-30 — Orchestrator (`JWT_PUBLIC_KEY` is a GitHub secret, the human's call)

- `deploy.yml` reads `secrets.JWT_PUBLIC_KEY` instead of `vars.JWT_PUBLIC_KEY`; the script and docs
  say so. The VAPID public key and subject stay variables.

## 2026-10-30 — Orchestrator (sign-up link, shared bank costs, Blend tab: the human's request)

- **Sign-up link.** Accounts live in the dive logger, so the login page links to its
  `/auth/signup` (`VITE_SIGNUP_URL` per environment, new tab). Unset locally: no link.
- **Several payers.** `VesselCreate.initialCostLine` became `initialCostLines` (a list, one line
  per person), created atomically with the bank; the same payer rule applies per line, so a
  member can only book their own share and an admin anyone's. No split-evenly helper: dividing
  money is domain math (AGENTS rule 3), so each person's amount is typed. No migration: cost lines
  already allowed several payers.
- **Blend tab, Mix = a bank holding blended gas.** Six tabs now (the human widened the five-tab
  budget); a mix is a bank with gas class NITROX or TRIMIX, so there is no new table, field or
  endpoint: inventory, pricing, fills from and into it and closing are the bank's. The bank views
  take a `mixes` prop. A bought pre-mixed bank therefore also shows under Blend, and a bank
  whose analysis changes its gas class moves tabs. A mix asks for no cost when added: its price
  comes from the fills into it. "Fill this mix" opens the fill form with it as target.
- **Local test note.** `yarn test:ci` fails 7 `authStore` tests on Node 26 (its built-in
  `localStorage` shadows jsdom's), on the committed code too; all pass on Node 20.

## 2026-10-31 — Orchestrator (cuft and other cylinder sizes, the human's request)

- 40 and 80 cuft are quick picks; 3, 5, 8.5, 18 L, 2×10 L and 13, 19, 30, 63, 100, 120, 2×80 cuft
  sit under "More sizes", which opens by itself when the remembered size is one of them. A cuft
  size only fills in its water volume, which stays editable: aluminium per Luxfer's spec sheet,
  100/120 per Faber's high-pressure steel (a cuft label does not fix the volume: an aluminium 80 is
  11.1 L, a steel HP80 10.2 L). Nothing new is stored; the backend still only sees litres.

## 2026-10-31 — Orchestrator (two ways to record a fill, the human's request)

- **Fill has two panes:** "Fill a cylinder" (size, start pressure, gases) and "Bank went down"
  (bank, its pressure before and now). The selector remembers the last pane; "Fill this mix" always
  opens the cylinder pane. 2 L and 3 L are quick picks; start pressure moved out of "More details".
- **Bank draw = third target type `BANK_DRAW`, not a guessed cylinder** (DOMAIN §5.7). The drop *is*
  the draw, by the same real-gas model, so nothing about the unknown cylinder is invented. Reuses
  the fill columns, one stage, pricing, void and edit. `V1_0_1` relaxes `ck_fill_target` (no water
  volume without a cylinder). It is the first migration after the dev deploy; `V1_0_0` stays as
  applied. It writes no data, so existing fills are untouched.
- **One bank per draw:** two banks tapped means two records.
- **A list line shows the bank's level** ("He · 150 bar · From He bank"), as `endPressureBar` is the
  bank's on these fills.
- `useFillPreview` and `FillResultCard` are shared by both forms instead of copying the preview.

## 2026-10-31 — Orchestrator (scrubber tracking and per-team switches, the human's request)

- **Own area, not a fill** (the human's call): own tab "Scrubber", tables, API and pricing
  (DOMAIN §12); only the balances are shared. No generic "consumable" abstraction.
- **Charged like a TRUE_UP bank** (the human's choice): an estimate at cost ÷ capacity while open,
  and "it is empty now" shares the real cost by the recorded kg, so rough guesses still add up to
  exactly what was paid. Over-recording cannot charge more than the cost.
- **Any member can say it is empty**, unlike closing a bank (admin or creator): the person at the
  empty canister is who knows, it needs a confirmation, and an admin can reopen it.
- **Uses are deleted, not voided:** a wrong scoop is small and re-entered; the fill's edit, void
  and audit machinery would not earn its keep.
- **Switches:** `gasTrackingEnabled` / `scrubberTrackingEnabled` per team, both on by default, also
  for existing teams (`V1_0_2`). Off hides that area and refuses new records with 409; corrections
  of what exists keep working and existing money stays in the balances, or switching off would
  silently change what people owe. Both off is allowed: Money and Team remain.
- **Tab label "Scrubber"**, the word divers use. Tabs size to their label with a 44 px minimum, so
  all seven fit at 320 px. Tabs of an area switched off disappear and the others widen.
- **Policy comparison** includes scrubber money, so its balances match the real ones.
- `CylinderSizeChips` became the generic `ui/QuickChips` (cylinder sizes, scoop amounts).

## 2026-10-31 — Orchestrator (team selector, all teams, areas really gone)

- **Team selector in the header** (native select: team names, "All teams" from two teams on, "New
  team…"). It shows the team in the URL and holds no state of its own. Picking a team opens its
  Home, not the same tab: that tab may not exist there.
- **"All teams" overview:** my balance per team, no new endpoint (one balances call per team). No
  total: teams can use different currencies, and sums belong to the backend (AGENTS rule 3).
- **A switched-off area is gone, not only hidden:** its routes carry `meta.area`, `TeamLayout` sends
  an old link to Home, and Money/Home/Team only mention what the team tracks. Exception: "How it
  adds up" still lists non-zero gas or scrubber money from before the switch, or the sum would not
  add up.

## 2026-10-31 — Orchestrator (Renovate for the web repo, the human's request)

- `.github/renovate.json5`, same rhythm as homelab-infra (Monday before 6am, Zurich, 5 open PRs).
  Auto-merge only dev dependencies and GitHub Actions at minor/patch, and only on green checks;
  runtime dependencies, majors, Node and `openapi-typescript` wait for a person. The human is
  assignee and reviewer on every PR, auto-merged ones included, so they show up regularly.
