# Contributing to Code One

## Prerequisites

- Node.js ≥20.0.0
- pnpm ≥9.0.0 (`corepack enable && corepack prepare pnpm@latest --activate`)
- Git

## Setup

```bash
git clone https://github.com/Ghenghis/code-one.git
cd code-one
pnpm install
pnpm build
pnpm test
```

## Branch conventions

All work happens on branches. Never push directly to `main`.

| Pattern               | Use for                           |
| --------------------- | --------------------------------- |
| `feat/kernel-*`       | Tier 0 kernel features            |
| `feat/core-ide-*`     | Tier 1 IDE features               |
| `feat/ai-*`           | Tier 2 AI coding features         |
| `feat/intelligence-*` | Tier 3 intelligence features      |
| `feat/agent-*`        | Tier 4 agent features             |
| `feat/automation-*`   | Tier 4.5 automation fabric        |
| `feat/remote-*`       | Tier 5 remote/devops features     |
| `feat/skills-*`       | Tier 6 skills/MCP/plugins         |
| `feat/model-*`        | Tier 7 model lab features         |
| `research/*`          | Source reviews, experiment spikes |
| `fix/*`               | Bug fixes                         |
| `release/*`           | Release stabilization             |

## Commit style

Use conventional commits with subsystem scope:

```
feat(kernel): add command bus and module registry
feat(editor): integrate Monaco with tab state
feat(ai): add provider adapter interface
docs(research): synthesize OpenHands and LangGraph patterns
test(agent): add approval gate resume coverage
fix(preview): resolve stale webview reload loop
```

## Before submitting a PR

1. **Research note exists** for the subsystem (see `docs/research/`)
2. **ADR exists** for architectural decisions (see `docs/adr/`)
3. **Tests pass**: `pnpm test`
4. **Types check**: `pnpm typecheck`
5. **Lint passes**: `pnpm lint`
6. **Format is correct**: `pnpm format:check`
7. **Build succeeds**: `pnpm build`

## PR requirements

Every PR must include (see `.github/pull_request_template.md`):

- Scope summary (which subsystem/tier)
- Linked design section
- Linked research note
- Tests added/updated
- Screenshots or terminal proof where relevant
- Risk notes
- Rollback notes

## Tier boundary rule

**No module may depend on a higher-tier module.** This is enforced by the ModuleRegistry at runtime and should be verified before adding cross-package imports.

```
Tier 0 (kernel) ← Tier 1 (IDE) ← Tier 2 (AI) ← Tier 3 (intelligence)
                                                  ← Tier 4 (agent)
                                                    ← Tier 4.5 (automation)
                                                      ← Tier 5 (remote)
                                                        ← Tier 6 (skills)
                                                          ← Tier 7 (model lab)
```

Arrows mean "may depend on." Reverse direction is prohibited.

## Code style

- TypeScript strict mode
- Prefer interfaces over types for public contracts
- Prefer composition over inheritance
- No classes unless state management requires them
- Keep functions small and focused
- ESLint + Prettier enforced (see `.eslintrc` and `.prettierrc`)

## Running specific packages

```bash
# Run tests for a specific package
pnpm --filter @code-one/kernel test

# Build a specific package
pnpm --filter @code-one/shared-types build

# Run dev mode for desktop app
pnpm --filter @code-one/desktop dev
```

## Project structure

```
code-one/
├── apps/
│   ├── desktop/          # Electron app shell
│   └── agent-runner/     # Standalone agent process
├── packages/
│   ├── kernel/           # Tier 0: Platform kernel
│   ├── shared-types/     # Cross-cutting type contracts
│   ├── test-harness/     # Shared test utilities
│   ├── editor/           # Tier 1: Monaco integration
│   ├── workspace/        # Tier 1: File tree, projects
│   ├── terminal/         # Tier 1: xterm.js
│   ├── preview/          # Tier 1: Web preview
│   ├── ui/               # Tier 1: Shared UI components
│   ├── ai-gateway/       # Tier 2: Provider abstraction
│   ├── context-engine/   # Tier 3: RAG, memory, indexing
│   ├── agent-core/       # Tier 4: Agent loop, modes
│   ├── task-graph/       # Tier 4: Graph orchestration
│   ├── skills/           # Tier 6: Skill runtime
│   ├── git-tools/        # Tier 5: Git operations
│   ├── remote/           # Tier 5: SSH, SFTP, deploy
│   ├── mcp/              # Tier 6: MCP client
│   └── model-lab/        # Tier 7: Model catalog
└── docs/
    ├── adr/              # Architecture decision records
    ├── architecture/     # Runtime specs, system design
    ├── maps/             # Project maps
    ├── plans/            # Design docs, build blueprints
    ├── research/         # Source-backed research notes
    └── runbooks/         # Operational procedures
```
