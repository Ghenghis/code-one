#!/usr/bin/env bash
set -euo pipefail

echo "=== Code One — Bootstrap ==="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required. Run: npm install -g pnpm"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "Git is required."; exit 1; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Node.js 20+ required. Current: $(node -v)"
  exit 1
fi

echo "Node: $(node -v)"
echo "pnpm: $(pnpm -v)"
echo "Git:  $(git --version)"

# Install dependencies
echo ""
echo "Installing dependencies..."
pnpm install

# Verify
echo ""
echo "Running typecheck..."
pnpm typecheck

echo ""
echo "Running build..."
pnpm build

echo ""
echo "Running tests..."
pnpm test || true

echo ""
echo "=== Setup complete ==="
