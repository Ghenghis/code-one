# Code One — Master Action Plan

**Last updated:** 2026-04-14 (session 4 — post-audit)
**Overall completion:** ~40% backend, ~30% total
**Current branch:** `main`
**Repository:** https://github.com/Ghenghis/code-one

> If you are an AI agent picking this up for the first time, read this document
> end to end before doing anything. This is the single source of truth for
> project state, decisions, and remaining work.

---

## 1. Project Overview

Code One is a desktop-first modular AI development platform built on Electron.
It combines IDE workflows, autonomous agents, remote operations, and extensible
skills in a single cohesive workspace.

**Architecture:** 8 tiers (0-7) + Tier 4.5 Automation Fabric
**Monorepo:** pnpm workspaces + Turbo
**Key docs:**

- Architecture: `docs/plans/2026-04-14-hybrid-ide-design.md`
- Build blueprint: `docs/plans/2026-04-14-e2e-build-blueprint.md`
- Glossary: `docs/GLOSSARY.md`
- ADRs: `docs/adr/`
- Research: `docs/research/`

---

## 2. Critical Build Order Decision

**ALL backend/infrastructure across ALL milestones FIRST. GUI/UI/UX COMPLETELY LAST.**

This is non-negotiable. The user has stated this multiple times. Do not start any
React components, visual panels, themes, or styling until every backend engine
across every tier is implemented and tested.

---

## 3. Technology Decisions (Already Made)

| Decision                | Choice                                 | ADR/Source            |
| ----------------------- | -------------------------------------- | --------------------- |
| Monorepo                | pnpm + Turbo                           | ADR-0001              |
| Desktop shell           | Electron                               | ADR-0003              |
| Build tooling           | Electron Forge + Vite plugin           | User chose 2026-04-14 |
| Persistence             | SQLite via better-sqlite3, WAL mode    | ADR-0004              |
| Testing                 | Vitest, 3-layer pyramid                | ADR-0005              |
| Layout (deferred)       | allotment for split panes              | User chose 2026-04-14 |
| State mgmt (deferred)   | Zustand only                           | User chose 2026-04-14 |
| UI framework (deferred) | React 19                               | Design doc            |
| IPC pattern             | Typed preload contextBridge, no remote | Design doc            |

---

## 4. What Is DONE

### Milestone 0 — Repository Foundation (100%)

Branch: `feat/repo-bootstrap` (merged to main)

- pnpm monorepo with 17 packages + 2 apps
- ESLint, Prettier, TypeScript strict mode
- CI pipeline (GitHub Actions): install, lint, format:check, typecheck, test, build
- PR template, ADR template, issue templates
- Branch protections documented
- All packages scaffolded with stubs

### Milestone 1 — Tier 0 Kernel (100%)

Branch: `feat/kernel-core` (merged to main)

Package: `packages/kernel` — 8 source files, 8 test files, 90 tests

| Subsystem        | Implementation                        | Tests         |
| ---------------- | ------------------------------------- | ------------- |
| EventBus         | Append-only pub/sub, typed events     | Full coverage |
| CommandBus       | Command dispatch, keybinding registry | Full coverage |
| ModuleRegistry   | 6-state lifecycle, tier enforcement   | Full coverage |
| PermissionEngine | Capability-based, 3-layer eval        | Full coverage |
| SettingsManager  | 3-scope chain (default/user/project)  | Full coverage |
| LayoutManager    | Panel tree, tab groups, sidebar state | Full coverage |
| LoggerFactory    | Structured logging, named loggers     | Full coverage |
| createKernel()   | Single entry point, clean shutdown    | Full coverage |

### Shared Types (100% for current tiers)

Package: `packages/shared-types` — 9 type definition files

- `events.ts` — BaseEvent, AgentEvent union (14 event types), TrustLevel, MemoryScope
- `commands.ts` — CommandDescriptor, CommandHandler, ICommandBus
- `modules.ts` — ModuleManifest, ModuleLifecycle, ModuleStatus, IModuleRegistry
- `permissions.ts` — Capability, PermissionPolicy, PermissionRequest, IPermissionEngine
- `settings.ts` — SettingsScope, SettingsSchemaEntry, SettingsBackend, ISettingsManager
- `layout.ts` — LayoutNode, PanelNode, SplitNode, TabState, LayoutState, ILayoutManager
- `ipc.ts` — IPCRequest, IPCResponse, IPCEvent, IPCError, IPCChannelDescriptor
- `logger.ts` — LogLevel, LogEntry, ILogger, ILoggerFactory
- `providers.ts` — ProviderConfig, FallbackChain, ProviderHealth, ChatMessage, CostRecord
- `modes.ts` — ModeDefinition, ToolDefinition, ToolPermissionSet, ToolRegistry
- `graph.ts` — GraphNode, TaskGraph, Checkpoint, RepositoryMap, MemoryStore

### Test Harness

Package: `packages/test-harness` — Shared test utilities (createTempDir, waitFor, deferred, captureConsole)

### Milestone 2 Infra — Electron Shell (100% DONE)

Branch: `feat/desktop-electron-shell` (merged to main via PR #2)

- Electron Forge + Vite plugin build tooling
- 11 typed IPC channels delegating to kernel subsystems
- Preload script with contextBridge `window.codeone` API (11 methods)
- Main process bootstrapping kernel with clean shutdown
- 19 tests (channel registry: 5, IPC handlers: 12, preload API: 2)
- Verified: app launches, tests pass, typecheck clean, lint clean

### Milestone 3 — AI Gateway (100% DONE)

Branch: `feat/ai-gateway` (merged to main via PR #3)

Package: `packages/ai-gateway` — 8 source files, 7 test files, 111 tests

| Subsystem                     | Implementation                               | Tests    |
| ----------------------------- | -------------------------------------------- | -------- |
| IProvider + BaseProvider      | Health tracking, errorRate sliding window    | 21 tests |
| OpenAI-compatible adapter     | Chat + SSE streaming, SSE \r\n handling      | 22 tests |
| Provider registry             | Register/unregister, health-filtered queries | 12 tests |
| Health monitor                | Periodic ping, timer unref                   | 11 tests |
| Fallback chain router         | Ordered failover, 3 exhausted strategies     | 21 tests |
| Token tracker + cost governor | Per-model pricing, budget enforcement        | 18 tests |
| AIGateway facade              | Unified entry point composing all subsystems | 13 tests |

### Milestone 4 — Context Engine (60% — core merged, advanced features deferred)

Branch: `feat/context-engine` (merged to main via PR #4)

Package: `packages/context-engine` — 6 source files, 5 test files, 66 tests

| Subsystem        | Implementation                                              | Tests         |
| ---------------- | ----------------------------------------------------------- | ------------- |
| SymbolIndex      | In-memory symbol store, file/name/kind/prefix/fuzzy lookups | Full coverage |
| PageRank         | Iterative with damping, dangling node redistribution        | Full coverage |
| RepoMapBuilder   | Files, symbols, deps, active-file boost, PageRank           | Full coverage |
| InMemoryStore    | 4-scope KV with TTL, substring search                       | Full coverage |
| ContextAssembler | Greedy budget fill, per-kind limits, truncation             | Full coverage |

Deferred to M4b: tree-sitter parser, embedding store, RAG retriever, LSP diagnostics ingestion.

### Milestone 5 — Agent Core (50% — core merged, task-graph/subagents deferred)

Branch: `feat/agent-core` (merged to main via PR #5)

Package: `packages/agent-core` — 6 source files, 5 test files, 80 tests

| Subsystem         | Implementation                                         | Tests         |
| ----------------- | ------------------------------------------------------ | ------------- |
| EventStream       | Append-only, typed subscriptions, causal chains        | Full coverage |
| ToolRegistryImpl  | CRUD, mode-based allow/deny, glob patterns             | Full coverage |
| ApprovalGate      | Risk/trust matrix, auto-approve, pending flow          | Full coverage |
| CheckpointManager | Create/restore with structuredClone, prune             | Full coverage |
| AgentLoop         | Plan-Act-Observe-Decide, pause/resume, auto-checkpoint | Full coverage |

Deferred to M5b: task graph executor, subagent spawner, subagent isolation, built-in mode presets, agent-runner app.

---

## 5. What REMAINS — Complete Task List

### Phase 1: Backend Infrastructure (no GUI)

#### Priority 1: Agent Core Completion — Milestone 5b

Branch: `feat/agent-core-v2`
Packages: `packages/agent-core`, `packages/task-graph`, `apps/agent-runner`

| Task                  | Description                                           |
| --------------------- | ----------------------------------------------------- |
| Task graph executor   | Planner, executor, reviewer nodes                     |
| Graph state reducers  | Merge concurrent node outputs                         |
| Subagent spawner      | Spawn child agents with isolated context              |
| Subagent isolation    | No parent memory leakage, budget limits               |
| Built-in mode presets | Pre-register Ask, Architect, Code, Debug, Agent modes |
| Agent-runner app      | Standalone agent process                              |

Exit criteria:

- Task graph supports 3+ concurrent nodes
- Subagent isolation enforced (no memory leakage)
- Session replay from events (10+ events)
- Built-in modes functional with correct tool permissions

#### Priority 2: Git + Terminal — Milestone 6

Branch: `feat/remote`
Packages: `packages/git-tools`, `packages/terminal` (backend only)

| Task                    | Description                                        |
| ----------------------- | -------------------------------------------------- |
| Git status provider     | Branch, staged, unstaged, untracked                |
| Git operations          | Commit, push, pull, branch, checkout               |
| PR workflow             | Create PR via GitHub API (gh)                      |
| Terminal backend        | node-pty bridge, IPC pipe to renderer              |
| Agent command execution | Agent can run terminal commands and observe output |

Exit criteria:

- Git operations functional and shell-safe
- Terminal backend pipes output via IPC
- Agent can execute commands and read stdout/stderr

#### Priority 3: MCP + Skills — Milestone 7

Branch: `feat/skills-mcp`
Packages: `packages/skills`, `packages/mcp`

| Task                       | Description                                    |
| -------------------------- | ---------------------------------------------- |
| MCP client                 | Connect to MCP servers, discover tools         |
| MCP tool bridge            | Register MCP tools in kernel tool registry     |
| Tool schema validator      | Validate tool schemas against spec             |
| Skill manifest format      | JSON schema for skill packages                 |
| Skill installer            | Install, activate, uninstall from local/remote |
| Skill permission scoping   | Skill-private memory, capability grants        |
| Skill runtime              | Execute skill logic in sandboxed context       |
| Plugin contribution points | Modules can add commands, settings, menus      |

Exit criteria:

- MCP tools appear in registry (tested with 2+ servers)
- Skills install/activate/uninstall without side effects
- Plugin crashes don't bring down host
- Skill memory scopes enforced
- Schema validation rejects malformed schemas (5+ negative tests)

#### Priority 4: Context Engine Completion — Milestone 4b

Branch: `feat/context-engine-v2`
Package: `packages/context-engine`

| Task                      | Description                                     |
| ------------------------- | ----------------------------------------------- |
| Tree-sitter parser        | Parse source files into AST, extract symbols    |
| Embedding store           | Store/retrieve vector embeddings (local or API) |
| RAG retriever             | Query relevant chunks given a prompt            |
| LSP diagnostics ingestion | Feed LSP diagnostics into context               |

Exit criteria:

- Top-5 recall >= 70% on test queries
- 10k+ file repos index in <30s, queries <2s
- Context compression reduces tokens by >= 40%

#### Priority 5: Remote/DevOps — Milestone 8

Branch: `feat/remote`
Package: `packages/remote`

| Task                   | Description                                      |
| ---------------------- | ------------------------------------------------ |
| SSH connection manager | Profile storage, key auth, password auth         |
| SSH terminal bridge    | Pipe SSH session to IPC                          |
| SFTP file operations   | Upload, download, list, stat                     |
| Tunnel manager         | Cloudflare tunnel create/destroy                 |
| Docker client          | Container start/stop/logs via Docker API         |
| Deploy actions         | Trigger deploy to configured targets             |
| Audit logger           | Log all remote actions (who, what, when, target) |

Exit criteria:

- SSH key + password auth works
- SFTP 100MB+ file transfer without corruption
- Deploy produces audit log entries
- Tunnel creation <5s, survives network interruption

#### Priority 6: Model Lab — Milestone 9

Branch: `feat/model-lab`
Package: `packages/model-lab`

| Task                     | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| Model catalog            | List local (GGUF) and cloud API profiles                    |
| Endpoint profile manager | Save/switch inference configs                               |
| Benchmark harness        | Reproducible eval (same prompt + model = same score +/- 5%) |
| Job runner               | Launch fine-tune jobs (LoRA/QLoRA hooks)                    |
| Hardware profiler        | VRAM usage, throughput, latency reporting                   |

Exit criteria:

- Local GGUF and cloud profiles coexist (switch without restart)
- Benchmarking reproducible
- Heavy features optional (app starts without them)
- Catalog loads 3+ providers in <1s

#### Priority 7: SQLite Persistence — Milestone 10

Branch: `feat/persistence`
Packages: All packages with in-memory stores

| Task                          | Description                               |
| ----------------------------- | ----------------------------------------- |
| SQLite migration system       | Schema versioning, up/down migrations     |
| EventStream persistence       | Replace in-memory array with SQLite table |
| MemoryStore persistence       | Replace in-memory map with SQLite table   |
| CheckpointManager persistence | Store snapshots in SQLite BLOB            |
| SettingsManager backend       | SQLite settings backend                   |
| TokenTracker persistence      | Persist cost records across sessions      |

Exit criteria:

- All stores survive process restart
- WAL mode enabled (ADR-0004)
- Migration system handles schema upgrades
- No data loss on crash (WAL journal recovery)

### Phase 2: GUI Layer (LAST)

Only start this after ALL of Phase 1 is complete and tested.

Branch: `feat/gui-layer`
Packages: `packages/ui`, `packages/editor`, `packages/workspace`, `packages/terminal` (renderer), `packages/preview`

| Task                      | Description                                                      |
| ------------------------- | ---------------------------------------------------------------- |
| React 19 + Vite renderer  | Replace minimal placeholder with React root                      |
| Zustand stores            | useLayoutStore, useSettingsStore, useCommandStore synced via IPC |
| AppShell component        | allotment split layout (left/center/right/bottom)                |
| Panel system              | Lazy-loaded panels registered by ID + position                   |
| Tab groups                | Center area tab management                                       |
| Monaco editor integration | Multi-tab, syntax highlighting, minimap                          |
| File tree panel           | File CRUD with drag-drop                                         |
| Terminal renderer         | xterm.js frontend for terminal backend                           |
| Preview panel             | Webview / WebContainers                                          |
| Chat panel                | Streaming markdown, code insertion                               |
| Settings UI               | Scoped settings editor                                           |
| Diagnostics panel         | ESLint, TypeScript, custom linters                               |
| Global search             | File + content + regex search                                    |
| Theme system              | Dark, light, high contrast                                       |
| Status bar                | Branch, diagnostics, mode, provider health                       |
| Onboarding wizard         | First-run provider setup, theme, project import                  |
| Command palette           | Searchable command list                                          |
| Approval UI               | Diff preview for agent approval gates                            |

---

## 6. Package Map (What Goes Where)

| Package          | Tier | Milestone | Status     | Purpose                                                                           |
| ---------------- | ---- | --------- | ---------- | --------------------------------------------------------------------------------- |
| `shared-types`   | —    | M0-M5     | Done       | TypeScript type contracts                                                         |
| `kernel`         | 0    | M1        | Done       | Command/event/module/permission/settings/layout/logging                           |
| `test-harness`   | —    | M0        | Done       | Shared test utilities                                                             |
| `ai-gateway`     | 2    | M3        | Done       | Provider abstraction, streaming, fallback, cost                                   |
| `context-engine` | 3    | M4        | Done (60%) | Symbol index, repo map, memory, assembler. Deferred: tree-sitter, RAG, embeddings |
| `agent-core`     | 4    | M5        | Done (50%) | Event stream, agent loop, approval, checkpoint. Deferred: task-graph, subagents   |
| `task-graph`     | 4    | M5b       | Stub       | LangGraph-style orchestration, checkpoints                                        |
| `git-tools`      | —    | M6        | Stub       | Git operations                                                                    |
| `terminal`       | 1    | M6/GUI    | Stub       | node-pty backend (M6), xterm.js renderer (GUI)                                    |
| `mcp`            | 6    | M7        | Stub       | MCP client, tool bridge                                                           |
| `skills`         | 6    | M7        | Stub       | Skill runtime, installer                                                          |
| `remote`         | 5    | M8        | Stub       | SSH, SFTP, tunnels, Docker                                                        |
| `model-lab`      | 7    | M9        | Stub       | Model catalog, benchmarks, job runner                                             |
| `editor`         | 1    | GUI       | Stub       | Monaco integration                                                                |
| `workspace`      | 1    | GUI       | Stub       | File tree, project management                                                     |
| `preview`        | 1    | GUI       | Stub       | Webview, app launcher                                                             |
| `ui`             | 1    | GUI       | Stub       | Shared React components                                                           |

Apps:
| App | Status | Purpose |
|-----|--------|---------|
| `desktop` | Done (M2 infra) | Electron main process, IPC, shell |
| `agent-runner` | Stub | Standalone agent process (M5) |

---

## 7. How To Continue From Any Point

### Step 1: Assess current state

```bash
git branch -a                     # See all branches
git log --oneline main..HEAD      # Commits ahead of main
pnpm test                         # Run all tests
pnpm typecheck                    # Check types
```

### Step 2: Find what's in progress

Check this document's section 4 ("What Is DONE") and section 5 ("What REMAINS").
Cross-reference with git branches:

- If `feat/ai-gateway` exists and isn't merged → finish it first
- Otherwise check section 5 for the next priority

### Step 3: For each milestone

1. Read the corresponding research note in `docs/research/` BEFORE implementing
2. Create branch from main: `git checkout main && git checkout -b feat/<name>`
3. Implement with TDD (write test → fail → implement → pass → commit)
4. Push frequently: `git push -u origin feat/<name>`
5. When complete, create PR to main with scope summary, tests, exit criteria proof
6. Merge only after CI passes

### Step 4: Verify before moving on

Each milestone has exit criteria. Run them. Don't skip. Evidence goes in the PR.

---

## 8. Conventions and Rules

### Commit style

```
feat(kernel): add command bus and module registry
feat(ai): add provider adapter interface
test(agent): add approval gate resume coverage
fix(preview): resolve stale webview reload loop
docs(research): synthesize OpenHands and LangGraph patterns
```

### Branch naming

```
feat/desktop-electron-shell
feat/ai-gateway
feat/context-engine
feat/agent-core
feat/remote
feat/skills-mcp
feat/model-lab
feat/gui-layer
```

### Testing

- Kernel (Tier 0): >= 90% statement coverage
- All other tiers: >= 80% statement coverage
- TDD preferred: write test first, verify fail, implement, verify pass
- Use `packages/test-harness` utilities
- AI/agent systems: use eval harness for non-deterministic behavior

### Anti-chaos rules

1. No giant branches covering multiple tiers
2. No "misc fixes" commits
3. No direct edits on main
4. No uncited architectural decisions
5. No agent execution without audit logs
6. No risky tool without approval path
7. No hidden side effects in skills/plugins
8. No claiming completion without run proof

---

## 9. Key File Locations

| What                  | Where                                             |
| --------------------- | ------------------------------------------------- |
| Architecture design   | `docs/plans/2026-04-14-hybrid-ide-design.md`      |
| Build blueprint       | `docs/plans/2026-04-14-e2e-build-blueprint.md`    |
| Electron shell design | `docs/plans/2026-04-14-electron-shell-design.md`  |
| Electron impl plan    | `docs/plans/2026-04-14-electron-main-ipc-plan.md` |
| Runtime specs         | `docs/architecture/runtime-specs.md`              |
| Glossary              | `docs/GLOSSARY.md`                                |
| Contributing guide    | `docs/CONTRIBUTING.md`                            |
| CI pipeline           | `.github/workflows/ci.yml`                        |
| Turbo config          | `turbo.json`                                      |
| Workspace config      | `pnpm-workspace.yaml`                             |
| Base TS config        | `tsconfig.base.json`                              |
| Kernel entry          | `packages/kernel/src/index.ts`                    |
| All type contracts    | `packages/shared-types/src/index.ts`              |
| IPC channels          | `apps/desktop/src/shared/channels.ts`             |
| IPC handlers          | `apps/desktop/src/main/ipc-handlers.ts`           |
| Preload API           | `apps/desktop/src/preload/api.ts`                 |
| Main process          | `apps/desktop/src/main/index.ts`                  |

---

## 10. Merged PRs

| PR  | Branch                        | Merged     | Contents                                                                                                   |
| --- | ----------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| #1  | `feat/e2e-gap-fixes`          | 2026-04-14 | ADRs 0003-0005, runtime specs, GLOSSARY, INDEX, CONTRIBUTING, providers/modes/graph types, CI format:check |
| #2  | `feat/desktop-electron-shell` | 2026-04-14 | Electron Forge + Vite, IPC bridge, preload API, main process, 19 tests, Master Action Plan                 |
| #3  | `feat/ai-gateway`             | 2026-04-14 | Provider system, OpenAI adapter, fallback router, cost governor, health monitor, gateway facade. 111 tests |
| #4  | `feat/context-engine`         | 2026-04-14 | Symbol index, PageRank, repo map, memory store, context assembler. 66 tests                                |
| #5  | `feat/agent-core`             | 2026-04-14 | Event stream, tool registry, approval gate, checkpoint manager, agent loop. 80 tests                       |

No open PRs. Next: M5b (task graph + subagents).

---

## 11. Resumption Checklist

If starting a new session or recovering from a crash:

- [ ] Read this file (`docs/plans/MASTER-ACTION-PLAN.md`)
- [ ] Run `git status` and `git branch` to see current state
- [ ] Run `pnpm install` (dependencies may need refresh)
- [ ] Run `pnpm test` to verify everything passes
- [ ] Check section 4 to see what's done
- [ ] Check section 10 for any pending PRs to merge first
- [ ] Check section 5 to find the next task
- [ ] Read the relevant design doc / research note before implementing
- [ ] Continue from where the last session left off
- [ ] Push after every meaningful checkpoint
- [ ] Update this file when milestones complete

---

## 12. Version History

| Date       | Change                                                                                 | By            |
| ---------- | -------------------------------------------------------------------------------------- | ------------- |
| 2026-04-14 | Initial master plan created                                                            | Claude + User |
| 2026-04-14 | M2 infra complete (PR #2 merged). PR #1 merged. AI gateway started.                    | Claude + User |
| 2026-04-14 | M3 AI Gateway complete (PR #3). M4 Context Engine (PR #4). M5 Agent Core (PR #5).      | Claude + User |
| 2026-04-14 | Comprehensive project audit. Revised milestone sequence (M5b→M6→M7→M4b→M8→M9→M10→GUI). | Claude + User |
