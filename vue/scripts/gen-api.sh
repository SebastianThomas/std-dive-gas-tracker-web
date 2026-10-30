#!/usr/bin/env bash
# Regenerates src/lib/api/schema.d.ts from the backend's committed OpenAPI snapshot (task D8).
# Run after the backend's OpenApiSnapshotTest was updated (-Dopenapi.update=true).
set -euo pipefail
cd "$(dirname "$0")/.."
SNAPSHOT="${OPENAPI_SNAPSHOT:-/Users/sebas/IdeaProjects/std-dive-logger-backend/std-dive-logger-backend/std-dive-gas-tracker/src/test/resources/openapi.json}"
./node_modules/.bin/openapi-typescript "$SNAPSHOT" --output src/lib/api/schema.d.ts
./node_modules/.bin/prettier --write src/lib/api/schema.d.ts >/dev/null
echo "Generated src/lib/api/schema.d.ts from $SNAPSHOT"
