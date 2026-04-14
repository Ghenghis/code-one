#!/usr/bin/env bash
set -euo pipefail

echo "=== CI Verification ==="

echo "[1/5] Install"
pnpm install --frozen-lockfile

echo "[2/5] Lint"
pnpm lint

echo "[3/5] Format check"
pnpm format:check

echo "[4/5] Typecheck"
pnpm typecheck

echo "[5/5] Test"
pnpm test

echo ""
echo "=== All checks passed ==="
