# ADR-0001: Monorepo with pnpm Workspaces and Turbo

**Date:** 2026-04-14  
**Status:** accepted  
**Tier:** 0  
**Deciders:** project founders

## Context

The Hybrid IDE has 16+ packages across 7 tiers plus 2 apps. We need a build and dependency management strategy that supports:
- independent package development
- shared type contracts
- parallel builds
- clean dependency graphs
- easy local development

## Decision

Use a pnpm workspace monorepo with Turbo for task orchestration.

- **pnpm** for package management (strict dependency resolution, workspace protocol)
- **Turbo** for build orchestration (parallel builds, caching, dependency-aware task graph)
- **TypeScript project references** for cross-package type checking
- **Shared tsconfig.base.json** for consistent compiler options

## Rationale

- pnpm is the most space-efficient package manager and enforces strict dependency isolation
- Turbo provides fast parallel builds with caching, reducing CI time
- Project references enable incremental TypeScript compilation
- This combination is battle-tested in large monorepos (Vercel, Turborepo itself)

## Alternatives considered

- **npm/yarn workspaces**: Less strict dependency management, slower installs
- **Nx**: More opinionated, heavier framework, less flexibility
- **Lerna**: Mostly deprecated in favor of Turbo/Nx
- **Polyrepo**: Would make shared types and cross-package development painful

## Research sources

- Turbo documentation
- pnpm workspace documentation
- Industry standard for TypeScript monorepos

## Consequences

### Positive
- Each package can be built, tested, and linted independently
- Shared types are always in sync
- Adding new packages is trivial
- CI builds are fast due to Turbo caching

### Negative
- Developers need to understand pnpm workspace protocol
- TypeScript project references require `composite: true` configuration

### Risks
- Lock file conflicts in multi-developer workflows (mitigated by pnpm's merge-friendly lockfile format)

## Validation

- All 20 workspace packages resolve and install cleanly
- `pnpm typecheck` passes across all packages
- `pnpm build` produces correct output in dist/ directories
