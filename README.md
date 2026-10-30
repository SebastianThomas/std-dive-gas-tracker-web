# STD Dive Gas Tracker — web

Shared blending-gas tracking for dive teams: inventory of O2/He banks and in-house mixes, every
fill per diver, and fair cost sharing including blending losses (per-bank true-up or pooled,
chosen per team).

- Frontend (this repo, `vue/`): Vue 3, Vite, Pinia, Tailwind 4.
- Backend: the `std-dive-gas-tracker` module in the std-dive-logger backend repo (Spring Boot,
  own Postgres DB). Logins are STD Dive Log accounts.
- Specs: [`docs/DOMAIN.md`](docs/DOMAIN.md) (what is computed), [`docs/API.md`](docs/API.md)
  (REST contract), [`docs/PLAN.md`](docs/PLAN.md) (implementation plan),
  [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Development

```bash
cd vue
yarn install
yarn dev        # https://localhost:5193 (mkcert: `brew install mkcert && mkcert -install`)
```

Needs the gas backend on `http://localhost:8090` (`mvn spring-boot:run` in its module directory);
locally the login page offers a development login. Checks: `yarn type-check && yarn lint:check
&& yarn test:ci && yarn build`.
