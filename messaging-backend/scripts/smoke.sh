#!/usr/bin/env bash
# End-to-end smoke: boots the full stack via compose, runs the smoke client in a
# golang container on the host network, asserts a DM is delivered.
set -euo pipefail
cd "$(dirname "$0")/.."

cleanup() { docker compose down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> building + starting stack"
docker compose up -d --build

echo "==> waiting for server health"
for i in $(seq 1 60); do
  if curl -sf http://localhost:8080/health >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -sf http://localhost:8080/health >/dev/null || { echo "server never became healthy"; docker compose logs server; exit 1; }

echo "==> running smoke client"
docker run --rm --network host -e GOFLAGS=-mod=mod -e GOSUMDB=off \
  -e SMOKE_BASE="http://localhost:8080" \
  -v "$PWD":/app -w /app golang:1.23-alpine go run ./cmd/smoke
echo "==> smoke passed"
