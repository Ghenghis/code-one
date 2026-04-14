# Local Development Setup

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Git

## Setup

```bash
git clone https://github.com/Ghenghis/code-one.git
cd code-one
pnpm install
```

## Verify

```bash
pnpm typecheck    # TypeScript type checking across all packages
pnpm build        # Build all packages
pnpm test         # Run all tests
pnpm lint         # ESLint across all packages
pnpm format:check # Prettier check
```

## Branch Workflow

```bash
# Create a feature branch
git checkout -b feat/kernel-command-bus

# Work, commit with conventional commits
git commit -m "feat(kernel): add command bus interface"

# Push and create PR
git push -u origin feat/kernel-command-bus
gh pr create
```

## Package Development

Each package can be developed independently:

```bash
cd packages/kernel
pnpm typecheck
pnpm test
pnpm build
```

## Turbo Cache

Turbo caches build/test/lint results. To clear:

```bash
pnpm clean
```

## Adding a New Package

1. Create directory under `packages/` or `apps/`
2. Add `package.json` with `@code-one/` scope
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. Add `src/index.ts`
5. Run `pnpm install` to register the workspace
