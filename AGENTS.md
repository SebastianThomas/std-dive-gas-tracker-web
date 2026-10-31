# AGENTS.md — std-dive-gas-tracker-web (frontend)

Rules for any agent (or human) working in this repo. Read fully before the first edit.

| Read | For |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | your task's scope, outputs and definition of done; the subagent protocol |
| [`docs/DOMAIN.md`](docs/DOMAIN.md) | what the numbers mean (§ refs) — the frontend never re-derives them |
| [`docs/API.md`](docs/API.md) | request/response shapes |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | decisions so far; append an entry for every local choice you make |
| Backend rules: `/Users/sebas/IdeaProjects/std-dive-logger-backend/std-dive-logger-backend/std-dive-gas-tracker/AGENTS.md` | when a task touches the backend |

## What this is

Mobile-first web app for a team of divers sharing a gas-blending room: record fills, see bank
levels, see and settle what you owe. **It is used standing in the gas room on a phone** — design
for one hand, big targets, minimal typing. Online-only in v1.

- Frontend: `vue/` — Vue 3 (`<script setup lang="ts">`), Pinia, Vue Router, Vite 8, Vitest,
  ESLint + Prettier, Tailwind CSS 4. **Yarn 1** (`yarn.lock` committed).
- Backend: the separate `std-dive-gas-tracker` Spring Boot module (port 8090 locally).
- Auth: STD Dive Log accounts. Tokens come from the **dive-logger ws** (`VITE_AUTH_URL`); the gas
  backend (`VITE_BACKEND_URL`) only verifies them. Locally, a dev login (backend profile
  `dev-login`, `VITE_DEV_LOGIN=true`) skips the dive logger entirely.

## Keep it simple (the human's standing instruction)

The app must be **easy to use and not complicated**. Before adding anything, check it against the
simplicity budget in [`docs/PLAN.md`](docs/PLAN.md) — up to seven tabs (Home, Fill, Blend, Banks, Scrubber, Money, Team; a team can switch off gas or scrubber),
one primary action per screen, the usual fill recorded with a cylinder size and three pressures.

- Defaults over options: remember the last cylinder size; preselect the fullest bank of each gas;
  start mix = air. Rare inputs live under one collapsed "More details", never as extra steps.
- Plain words, never enum names or internals: "bank", "mix" (a blended product, in the Blend tab), "you owe" / "you're owed", "Exact per
  bank" (TRUE_UP), "Shared loss pool" (POOLED), "estimate" (provisional). One line of helper text
  beats a dialog.
- No screen, setting, filter, toggle or chart that no PLAN task asks for. Confirmation dialogs only
  for void fill / close bank / delete payment / remove member.
- Fewer components beat clever ones: a view + a couple of feature components; no generic
  form/table frameworks, no extra state libraries.

## Hard rules

1. **Never commit, push or rewrite git history.** The human commits work in progress
   themselves, sometimes mid-session — a clean `git status` after your edits is normal.
2. **Yarn only** for dependencies: `yarn add [-D] <pkg>` / `yarn remove`, run from `vue/`.
   Never `npm install` (creates a stray `package-lock.json`, desyncs `yarn.lock`). New
   dependencies need a DECISIONS entry. `npx`/`./node_modules/.bin/*` are fine for running tools.
3. **No domain math in the frontend.** Litres, mixes, charges, balances, rates, losses and plans
   come from the backend (`/fills/preview`, `/balances`, `/vessels`, …). The frontend formats and
   displays. The only allowed client logic: input parsing, formatting, sorting/filtering of
   returned lists, and UI state.
4. **Money is a string** from the API (`"12.30"`). Format with `lib/format/money.ts`
   (task F1; `Intl.NumberFormat`, team currency). Never `parseFloat` money to add it up — sums come from
   the backend.
5. **All backend calls go through `useApi()`** (`composables/useApi.ts`: bearer token, one
   refresh-and-retry on 401, session-change guard) via a typed module in `src/lib/api/<area>.ts`
   (pattern: `lib/api/me.ts`). No hand-rolled `fetch`/`axios` calls in components. Exception:
   the dive-logger auth endpoints in `stores/auth.ts`, `lib/globals/auth/`, `LoginView.vue`.
6. **Types come from the backend contract.** Until task F1, hand-written types mirror
   `docs/API.md` field-for-field; from F1 on, use the generated `src/lib/api/schema.d.ts` and
   never redeclare a backend DTO by hand. A backend shape change = regenerate + fix the
   compile errors, in the same change.
7. **Verification before "done"** (below) — every time, all of it.

## Verification (definition of done for every frontend change)

From `vue/`, in this order, all green:

```
yarn type-check        # vue-tsc --build --force (bare --noEmit misses cross-file errors)
yarn lint:check        # eslint (use `yarn lint` to auto-fix)
yarn test:ci           # vitest --run
yarn build             # type-check + vite build
./node_modules/.bin/prettier --check src/
```

Then **look at it**: Browser pane (`preview_start` name `gas-web-dev`, https://localhost:5193 —
mkcert cert, the first `navigate` may need `force: true`), against a running backend, at
`resize_window` preset `mobile` (375×812, touch emulation — no hover) **and** 320×568, in light
**and** dark (`colorScheme: dark`, or the header toggle). Check: no horizontal page scroll, button
rows wrap sanely, popovers/dialogs stay on-screen, tap targets ≥ 44 px and not overlapping,
numeric fields open the decimal keypad. Reset the viewport (`preset: desktop`) when done. If a
check couldn't be run, say which and why — never imply it passed.

## Running it locally

1. Backend: `preview_start` name `gas-ws` (or `mvn spring-boot:run` in the backend module dir with
   the JDK 26 `JAVA_HOME`, see backend AGENTS.md). It starts its own Postgres (docker compose,
   :5460). Wait for `GET http://localhost:8090/actuator/health` → `UP`.
2. Frontend: `preview_start` name `gas-web-dev`.
3. Log in with the **Development login** box (any email; `demo-admin@example.test` once the
   `demo-seed` profile from task D7 exists — enable it with
   `-Dspring-boot.run.profiles=dev-login,demo-seed`).
4. Real login (only when testing the auth flow itself): run the dive-logger ws locally per its
   own `.claude/AGENTS.md` ("Verifying a frontend change end-to-end") with CORS extended to
   `https://localhost:5193`; log in as `test@test.ch` / `abc123` through the form.

Both launch configs live in `.claude/launch.json` (gitignored, absolute paths).

## Source layout (`vue/src`)

```
views/              routed pages, one per route (<Name>View.vue)
components/<area>/  feature components, one folder per tab (fill/, bank/, scrubber/, money/, team/)
components/ui/      small primitives: AppButton (also links via `to`), TextField, SelectField,
                    AppCard, LoadState, ConfirmAction (no component library)
components/layout/  AppHeader, BottomNav, TeamLayout, PageShell
composables/        useApi + use<Thing> composables with state/lifecycle
stores/             Pinia: auth, theme; team context arrives with F1
lib/api/            typed API modules (one per API.md section) + generated schema.d.ts (F1)
lib/format/         money / units / mix / dates / plain words (pure, tested)
lib/fill/           fill form draft <-> request (pure, tested)
lib/globals/        env constants, URL resolution, auth transport
lib/utils/          small pure helpers
__tests__/          ALL unit tests (*.spec.ts), named after what they cover
```

## Routes (planned — add a route here before implementing it)

Phones get a bottom tab bar: **Home · Fill · Blend · Banks · Scrubber · Money · Team**; ≥ 768 px may show the same
as a top nav. The current team id is in the URL — never only in a store.

| Path | View | Task |
|---|---|---|
| `/login` | LoginView | S2 |
| `/` | redirect to the last team's home; no team yet → create-team form | F2 |
| `/join/:token` | JoinTeamView (invite link) | Invites |
| `/teams` | TeamsOverviewView (all teams: my balance in each) | Team selector |
| `/teams/new` | TeamCreateView | F2 |
| `/t/:teamId` | Home: my balance, low banks, my last fills, "Record a fill" | F8 |
| `/t/:teamId/fill`, `/t/:teamId/fills`, `/t/:teamId/fills/:fillId` | FillRecordView, FillListView, FillDetailView | F5 |
| `/t/:teamId/banks`, `/t/:teamId/banks/new`, `/t/:teamId/banks/:vesselId` | BankListView, BankCreateView, BankDetailView | F4 |
| `/t/:teamId/blend`, `/t/:teamId/blend/new`, `/t/:teamId/blend/:vesselId` | BankListView, BankCreateView, BankDetailView with `mixes` (a mix = a bank with gas class NITROX or TRIMIX) | Blend |
| `/t/:teamId/scrubber`, `/t/:teamId/scrubber/new`, `/t/:teamId/scrubber/:canisterId` | ScrubberListView, ScrubberCreateView, ScrubberDetailView | Scrubber |
| `/t/:teamId/money` | MoneyView (balances, who pays whom, payments) | F6 |
| `/t/:teamId/team` (+ `/reports`) | TeamView (members, settings), ReportsView | F3, F7 |

## UI conventions

- Tailwind 4 utilities only; `dark:` variants for every colour (the variant follows
  `data-theme`, see `styles/global.css`). No global colour overrides, no `!important`. Text
  always gets an explicit colour class in both themes.
- Use `AppButton` / `TextField` (extend them rather than restyling raw elements). Inputs are
  `text-base` (16 px — smaller makes iOS zoom). Numbers: `inputmode="decimal"`, unit suffix
  (`bar`, `L`, `%`), accept both `,` and `.` as decimal separator.
- Units shown everywhere: pressures `bar`, gas `L`, mixes as `21/35` (O2/He %) or `EAN32`.
  Show provisional amounts as such (DOMAIN §7.3: open TRUE_UP banks re-price).
- Errors: `catch (err) { toast.error(extractErrorDetail(err)) }` (vue-sonner). The backend's
  ProblemDetail `detail` is user-facing; don't invent messages that hide it.
- Loading/empty/error states for every list. Destructive actions (void, close bank, reject)
  need a confirmation step.
- Accessibility: every input labelled, icon-only buttons get `aria-label`, decorative icons
  `aria-hidden="true"`, status text in `role="status"`. Icons: FontAwesome classes
  (`fa-solid fa-…`).
- Vue gotchas (from the dive logger): an absent `boolean` prop is `false`, not `undefined` —
  name optional boolean props so `false` is the default meaning.

## Tests

- Vitest + `@vue/test-utils` + jsdom, files in `src/__tests__/` only.
- Test formatting helpers, stores and any non-trivial component logic (form → request mapping,
  stage builder state, visibility rules). Mock API modules (`vi.mock('@/lib/api/fills')`), not
  axios. Env flags: `vi.stubEnv('VITE_…', …)` + `vi.unstubAllEnvs()`.
- Don't snapshot-test markup.

## TypeScript / Vue code style (enforced by ESLint where possible)

- `const` by default, `let` only when reassigned, never `var` (`prefer-const`, `no-var`).
- No `any` (`@typescript-eslint/no-explicit-any`); `unknown` + narrowing instead. Type-only
  imports use `import type` (`consistent-type-imports`). `===` only (`eqeqeq`).
- `<script setup lang="ts">` with typed `defineProps`/`defineEmits`/`defineModel`; no Options
  API. Small pure functions in `lib/` with explicit parameter and return types for exports.
- Discriminated unions + exhaustive `switch` (with a `never` check) over boolean flag soup.
- `async`/`await` with `try`/`catch`/`finally`; no floating promises (prefix intentional
  fire-and-forget with `void`).
- Immutable updates (spread / `toSorted` / `map`) for reactive state; no in-place mutation of
  props.

## Cross-repo contract discipline

The backend is the source of truth for shapes (OpenAPI → `schema.d.ts` from F1 on). When a task
needs a shape change, change the backend first (or stop and report), update `docs/API.md`, then
regenerate. Instants are epoch millis (numbers), money strings, fractions 0..1, pressures gauge
bar.
