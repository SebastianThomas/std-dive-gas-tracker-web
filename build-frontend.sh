#!/usr/bin/env bash
# Builds and pushes the web image. Usage: ./build-frontend.sh [version] [staging|production]
set -euo pipefail

IMAGE="sthomasch/std-dive-gas-tracker-web"
PLATFORM="${PLATFORM:-linux/amd64}"
VERSION="${1:-}"
BUILD_MODE="${2:-production}"

# Vite bakes the API URLs per mode, so dev and prod need separate images.
# staging    -> :staging + :<version>-staging   (deployed to std-dive-logger-dev)
# production -> :latest  + :<version>           (deployed to std-dive-logger-prod)
if [[ "$BUILD_MODE" == "staging" ]]; then
    FLOATING="staging"
    SUFFIX="-staging"
else
    FLOATING="latest"
    SUFFIX=""
fi

TAGS=(-t "$IMAGE:$FLOATING")
[[ -n "$VERSION" ]] && TAGS+=(-t "$IMAGE:${VERSION}${SUFFIX}")

docker build . --platform "$PLATFORM" --build-arg BUILD_MODE="$BUILD_MODE" "${TAGS[@]}"

docker push "$IMAGE:$FLOATING"
[[ -n "$VERSION" ]] && docker push "$IMAGE:${VERSION}${SUFFIX}"
