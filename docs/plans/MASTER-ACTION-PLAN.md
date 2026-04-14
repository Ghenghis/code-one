# Code One — Master Action Plan

**Last updated:** 2026-04-14
**Overall completion:** ~15% backend, ~12% total
**Current branch:** `feat/desktop-electron-shell`
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

| Decision | Choice | ADR/Source |
|----------|--------|------------|
| Monorepo | pnpm + Turbo | ADR-0001 |
| Desktop shell | Electron | ADR-0003 |
| Build tooling | Electron Forge + Vite plugin | User chose 2026-04-14 |
| Persistence | SQLite via better-sqlite3, WAL mode | ADR-0004 |
| Testing | Vitest, 3-layer pyramid | ADR-0005 |
| Layout (deferred) | allotment for split panes | User chose 2026-04-14 |
| State mgmt (deferred) | Zustand only | User chose 2026-04-14 |
| UI framework (deferred) | React 19 | Design doc |
| IPC pattern | Typed preload contextBridge, no remote | Design doc |

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

| Subsystem | Implementation | Tests |
|-----------|---------------|-------|
| EventBus | Append-only pub/sub, typed events | Full coverage |
| CommandBus | Command dispatch, keybinding registry | Full coverage |
| ModuleRegistry | 6-state lifecycle, tier enforcement | Full coverage |
| PermissionEngine | Capability-based, 3-layer eval | Full coverage |
| SettingsManager | 3-scope chain (default/user/project) | Full coverage |
| LayoutManager | Panel tree, tab groups, sidebar state | Full coverage |
| LoggerFactory | Structured logging, named loggers | Full coverage |
| createKernel() | Single entry point, clean shutdown | Full coverage |

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

### Electron Shell (IN PROGRESS — ~75%)

Branch: `feat/desktop-electron-shell` (active, pushed to remote)

| Task | Status | Commit |
|------|--------|--------|
| Electron Forge dependencies | Done | `558333a` |
| Forge + Vite configuration | Done | `c7e22c7` |
| IPC channel registry (11 channels, 5 tests) | Done | `a4ceb79` |
| IPC handler factory (10 handlers, 12 tests) | Done | `41b2ae6` |
| Preload script + typed API (11 methods, 2 tests) | Done | `a9a80bf` |
| Design docs committed | Done | `2954f87` |
| Main process entry (kernel bootstrap, IPC wiring) | Done | `1eae2a7` |
| Minimal renderer placeholder | TODO | — |
| End-to-end verification | TODO | — |

---

## 5. What REMAINS — Complete Task List

### Phase 1: Backend Infrastructure (no GUI)

#### Priority 1: Finish Electron Shell (branch: `feat/desktop-electron-shell`)

Remaining tasks on this branch:

**Task 7: Create minimal renderer placeholder**
- Create `apps/desktop/src/renderer/index.html` (basic HTML, CSP headers, `<div id="root">`)
- Create `apps/desktop/src/renderer/index.ts` (verify IPC bridge, display kernel connection status as text only)
- No React, no styling — just enough HTML for Electron to load a page
- Commit: `feat(desktop): add minimal renderer placeholder with IPC verification`

**Task 8: End-to-end verification**
- Run all tests: `pnpm test` — all must pass
- Run typecheck: `pnpm typecheck` — no errors
- Run lint: `pnpm lint` — no errors
- Launch app: `cd apps/desktop && pnpm start` — window opens, kernel connects
- Verify IPC: window shows "Code One — Kernel connected"
- Verify shutdown: close window, kernel shuts down cleanly
- Final commit, push, create PR to main

#### Priority 2: AI Gateway — Milestone 3 Backend

Branch: `feat/ai-gateway`
Package: `packages/ai-gateway`
Types: `packages/shared-types/src/providers.ts` (already defined)

| Task | Description | Tests Needed |
|------|-------------|-------------|
| Provider interface | Abstract `IProvider` with `chat()`, `complete()`, `health()` | Interface compliance |
| OpenAI-compatible adapter | Handles any OpenAI-compatible endpoint | Streaming, error handling |
| Ollama adapter | Local model communication | Connection, model listing |
| Provider registry | Register/lookup providers by ID | CRUD, lookup |
| Fallback chain engine | Ordered provider list, auto-failover on rate limit/timeout/error | Failover triggers, chain traversal |
| Health monitor | Per-provider latency, error rate, uptime tracking | Health state transitions |
| Token tracker | Per-provider per-session token counting | Accumulation, reset |
| Cost governor | Budget levels: warn, downgrade-model, block | Budget enforcement |
| Streaming bridge | SSE/streaming to IPC events | Stream relay |
| IPC handlers | Wire gateway to desktop IPC | Round-trip |

Exit criteria:
- Any OpenAI-compatible endpoint works
- Swap providers without code changes
- Fallback activates within 3s of primary failure
- Token usage tracked per provider per session
- All handlers have unit tests

#### Priority 3: Context Engine — Milestone 4

Branch: `feat/context-engine`
Package: `packages/context-engine`
Types: `packages/shared-types/src/graph.ts` (RepositoryMap types already defined)

| Task | Description |
|------|-------------|
| Tree-sitter parser | Parse source files into AST, extract symbols |
| Symbol index | Store symbols with file, line, kind, name |
| Repo map builder | Build file-to-symbol graph |
| PageRank ranker | Rank files by structural importance |
| Active file prioritizer | Boost files open/recently edited |
| Diagnostics ingestion | Feed LSP diagnostics into context |
| Embedding store | Store/retrieve vector embeddings (local or API) |
| RAG retriever | Query relevant chunks given a prompt |
| Memory layer | Scoped memory (session/user/project) read/write |
| Context assembler | Combine sources, compress, respect token budget |

Exit criteria:
- Top-5 recall >= 70% on test queries
- 10k+ file repos index in <30s, queries <2s
- Memory scoped and reviewable
- Context compression reduces tokens by >= 40%

#### Priority 4: Agent Core — Milestone 5

Branch: `feat/agent-core`
Packages: `packages/agent-core`, `packages/task-graph`
Types: `packages/shared-types/src/events.ts`, `modes.ts`, `graph.ts`

| Task | Description |
|------|-------------|
| Append-only event stream | Typed event persistence (SQLite) |
| Tool call registry | Register/lookup tools, validate schemas |
| Agent loop | Plan → Act → Observe → Decide cycle |
| Mode system | Ask, Architect, Code, Debug, Agent + custom modes |
| Tool permission resolver | Mode → allowed tools mapping |
| Approval gate engine | Block risky actions, present to user for decision |
| Checkpoint manager | Snapshot state, restore on rollback |
| Interrupt/resume | Pause agent, resume from checkpoint |
| Task graph executor | Planner, executor, reviewer nodes |
| Graph state reducers | Merge concurrent node outputs |
| Subagent spawner | Spawn child agents with isolated context |
| Subagent isolation | No parent memory leakage, budget limits |

Exit criteria:
- Agent can plan, act, pause, resume, complete (5-step scenario)
- All risky actions gated with approval
- Session replay from events (10+ events)
- Rollback to checkpoint (state diff verified)
- Subagent isolation enforced
- Task graph supports 3+ concurrent nodes

#### Priority 5: Remote/DevOps — Milestone 6

Branch: `feat/remote`
Package: `packages/remote`, `packages/git-tools`

| Task | Description |
|------|-------------|
| SSH connection manager | Profile storage, key auth, password auth |
| SSH terminal bridge | Pipe SSH session to IPC |
| SFTP file operations | Upload, download, list, stat |
| Tunnel manager | Cloudflare tunnel create/destroy |
| Docker client | Container start/stop/logs via Docker API |
| Git status provider | Branch, staged, unstaged, untracked |
| Git operations | Commit, push, pull, branch, checkout |
| PR workflow | Create PR via GitHub API (gh) |
| Deploy actions | Trigger deploy to configured targets |
| Audit logger | Log all remote actions (who, what, when, target) |

Exit criteria:
- SSH key + password auth works
- SFTP 100MB+ file transfer without corruption
- Deploy produces audit log entries
- Git operations visible and shell-safe
- Tunnel creation <5s, survives network interruption

#### Priority 6: Skills/MCP — Milestone 7

Branch: `feat/skills-mcp`
Packages: `packages/skills`, `packages/mcp`

| Task | Description |
|------|-------------|
| Skill manifest format | JSON schema for skill packages |
| Skill installer | Install, activate, uninstall from local/remote |
| Skill permission scoping | Skill-private memory, capability grants |
| Skill runtime | Execute skill logic in sandboxed context |
| MCP client | Connect to MCP servers, discover tools |
| MCP tool bridge | Register MCP tools in kernel tool registry |
| Tool schema validator | Validate tool schemas against spec |
| Plugin contribution points | Modules can add commands, settings, menus |

Exit criteria:
- Skills install/activate/uninstall without side effects
- MCP tools appear in registry (tested with 2+ servers)
- Plugin crashes don't bring down host
- Skill memory scopes enforced
- Schema validation rejects malformed schemas (5+ negative tests)

#### Priority 7: Model Lab — Milestone 8

Branch: `feat/model-lab`
Package: `packages/model-lab`

| Task | Description |
|------|-------------|
| Model catalog | List local (GGUF) and cloud API profiles |
| Endpoint profile manager | Save/switch inference configs |
| Benchmark harness | Reproducible eval (same prompt + model = same score +/- 5%) |
| Job runner | Launch fine-tune jobs (LoRA/QLoRA hooks) |
| Hardware profiler | VRAM usage, throughput, latency reporting |

Exit criteria:
- Local GGUF and cloud profiles coexist (switch without restart)
- Benchmarking reproducible
- Heavy features optional (app starts without them)
- Catalog loads 3+ providers in <1s

### Phase 2: GUI Layer (LAST)

Only start this after ALL of Phase 1 is complete and tested.

Branch: `feat/gui-layer`
Packages: `packages/ui`, `packages/editor`, `packages/workspace`, `packages/terminal`, `packages/preview`

| Task | Description |
|------|-------------|
| React 19 + Vite renderer | Replace minimal placeholder with React root |
| Zustand stores | useLayoutStore, useSettingsStore, useCommandStore synced via IPC |
| AppShell component | allotment split layout (left/center/right/bottom) |
| Panel system | Lazy-loaded panels registered by ID + position |
| Tab groups | Center area tab management |
| Monaco editor integration | Multi-tab, syntax highlighting, minimap |
| File tree panel | File CRUD with drag-drop |
| Terminal panel | xterm.js + node-pty |
| Preview panel | Webview / WebContainers |
| Chat panel | Streaming markdown, code insertion |
| Settings UI | Scoped settings editor |
| Diagnostics panel | ESLint, TypeScript, custom linters |
| Global search | File + content + regex search |
| Theme system | Dark, light, high contrast |
| Status bar | Branch, diagnostics, mode, provider health |
| Onboarding wizard | First-run provider setup, theme, project import |
| Command palette | Searchable command list |
| Approval UI | Diff preview for agent approval gates |

---

## 6. Package Map (What Goes Where)

| Package | Tier | Milestone | Status | Purpose |
|---------|------|-----------|--------|---------|
| `shared-types` | — | M0-M1 | Done | TypeScript type contracts |
| `kernel` | 0 | M1 | Done | Command/event/module/permission/settings/layout/logging |
| `test-harness` | — | M0 | Done | Shared test utilities |
| `ai-gateway` | 2 | M3 | Stub | Provider abstraction, streaming, fallback, cost |
| `context-engine` | 3 | M4 | Stub | Repo map, RAG, memory, ranking |
| `agent-core` | 4 | M5 | Stub | Event stream, agent loop, modes, approval |
| `task-graph` | 4 | M5 | Stub | LangGraph-style orchestration, checkpoints |
| `git-tools` | 5 | M6 | Stub | Git operations |
| `remote` | 5 | M6 | Stub | SSH, SFTP, tunnels, Docker |
| `skills` | 6 | M7 | Stub | Skill runtime, installer |
| `mcp` | 6 | M7 | Stub | MCP client, tool bridge |
| `model-lab` | 7 | M8 | Stub | Model catalog, benchmarks, job runner |
| `editor` | 1 | GUI | Stub | Monaco integration |
| `workspace` | 1 | GUI | Stub | File tree, project management |
| `terminal` | 1 | GUI | Stub | xterm.js integration |
| `preview` | 1 | GUI | Stub | Webview, app launcher |
| `ui` | 1 | GUI | Stub | Shared React components |

Apps:
| App | Status | Purpose |
|-----|--------|---------|
| `desktop` | In progress (M2 infra) | Electron main process, IPC, shell |
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

- If `feat/desktop-electron-shell` exists and isn't merged → finish it first
- If it's merged → move to next priority in section 5

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

| What | Where |
|------|-------|
| Architecture design | `docs/plans/2026-04-14-hybrid-ide-design.md` |
| Build blueprint | `docs/plans/2026-04-14-e2e-build-blueprint.md` |
| Electron shell design | `docs/plans/2026-04-14-electron-shell-design.md` |
| Electron impl plan | `docs/plans/2026-04-14-electron-main-ipc-plan.md` |
| Runtime specs | `docs/architecture/runtime-specs.md` |
| Glossary | `docs/GLOSSARY.md` |
| Contributing guide | `docs/CONTRIBUTING.md` |
| CI pipeline | `.github/workflows/ci.yml` |
| Turbo config | `turbo.json` |
| Workspace config | `pnpm-workspace.yaml` |
| Base TS config | `tsconfig.base.json` |
| Kernel entry | `packages/kernel/src/index.ts` |
| All type contracts | `packages/shared-types/src/index.ts` |
| IPC channels | `apps/desktop/src/shared/channels.ts` |
| IPC handlers | `apps/desktop/src/main/ipc-handlers.ts` |
| Preload API | `apps/desktop/src/preload/api.ts` |
| Main process | `apps/desktop/src/main/index.ts` |

---

## 10. Pending PRs To Merge

### PR #1: `feat/e2e-gap-fixes` → main

Contains critical docs and type additions not yet on main:
- `docs/GLOSSARY.md` — Canonical term definitions
- `docs/INDEX.md` — Documentation reading order
- `docs/CONTRIBUTING.md` — Setup, branch conventions, PR process
- `docs/adr/0003-electron-platform.md` — Why Electron
- `docs/adr/0004-sqlite-persistence.md` — SQLite schema, WAL, retention
- `docs/adr/0005-testing-strategy.md` — Three-layer pyramid, eval harness
- `docs/architecture/runtime-specs.md` — Context compression, subagent isolation, SQLite DDL, hook conflicts, cost governor
- `packages/shared-types/src/providers.ts` — Multi-provider abstraction types
- `packages/shared-types/src/modes.ts` — Mode and tool system contracts
- `packages/shared-types/src/graph.ts` — Task graph, checkpoint, repo map, memory types
- `.github/workflows/ci.yml` — Added format:check and security audit steps

**Action:** Merge this PR to main before starting any new milestone branch.

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

| Date | Change | By |
|------|--------|----|
| 2026-04-14 | Initial master plan created | Claude + User |
| | M0, M1 complete. Electron shell 75%. | |
| | Infrastructure-first build order established. | |
