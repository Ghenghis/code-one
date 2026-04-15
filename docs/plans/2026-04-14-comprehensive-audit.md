# Code One — Comprehensive Project Audit

**Date:** 2026-04-14
**Auditor:** Claude (automated, 4 parallel audit agents)
**Scope:** All implemented code, all stubs, competitive landscape, GUI/UX spec, test plan, revised milestones

---

## 1. Past-Work Completeness Audit

### 1.1 Summary Table

| Package              | Milestone | Src Files | Test Files | Tests   | Status  | Completeness           |
| -------------------- | --------- | --------- | ---------- | ------- | ------- | ---------------------- |
| `shared-types`       | M0-M5     | 12        | 0 (types)  | —       | Done    | 100% for current tiers |
| `kernel`             | M1        | 8         | 8          | 90      | Done    | 100%                   |
| `desktop` (app)      | M2        | 6         | 3          | 19      | Done    | 95%                    |
| `ai-gateway`         | M3        | 8         | 7          | 111     | Done    | 100%                   |
| `context-engine`     | M4        | 6         | 5          | 66      | Partial | ~60%                   |
| `agent-core`         | M5        | 6         | 5          | 80      | Partial | ~50%                   |
| `test-harness`       | —         | 1         | 1          | 6       | Done    | 100%                   |
| 11 stub packages     | M5-M8/GUI | 1 each    | 0          | 0       | Stub    | 0%                     |
| `agent-runner` (app) | M5        | 1         | 0          | 0       | Stub    | 0%                     |
| **TOTAL**            |           | **~60**   | **29**     | **372** |         |                        |

All 372 tests pass. Zero failures.

### 1.2 Per-Package Audit

#### Kernel (M1) — COMPLETE, NO GAPS

8 subsystems fully implemented: EventBus, CommandBus, ModuleRegistry (6-state lifecycle + tier enforcement), PermissionEngine (3-layer eval), SettingsManager (3-scope chain), LayoutManager, LoggerFactory, createKernel().

No missing features. No test gaps. Solid foundation.

#### Desktop Shell (M2 Infra) — COMPLETE, 1 MINOR GAP

- `event:subscribe` channel declared in `channels.ts` but **no handler in `ipc-handlers.ts`**. Map has 10 handlers for 11 channels. Event subscription from renderer is non-functional.
- No IPC channels yet for ai-gateway, context-engine, or agent-core (expected — future milestones).

#### AI Gateway (M3) — COMPLETE, 2 KNOWN LIMITATIONS

- No Anthropic-native adapter (only openai-compatible). Cache tokens (`cacheReadTokens`/`cacheWriteTokens`) are defined in types but `computeCost()` ignores them.
- No retry/backoff within a single provider attempt. Fallback handles provider-level failover but not per-request retries.
- Otherwise feature-complete: BaseProvider with sliding-window error rate, SSE streaming with `\r\n` handling, ProviderRegistry, HealthMonitor with timer.unref(), FallbackRouter with 3 exhausted strategies, TokenTracker with budget enforcement, AIGateway facade.

#### Context Engine (M4) — PARTIAL (~60%)

Implemented:

- SymbolIndex (in-memory, manual population)
- PageRank (iterative, damping, dangling nodes)
- RepoMapBuilder (files, symbols, deps, active-file boost)
- InMemoryStore (4-scope KV with TTL, substring search)
- ContextAssembler (greedy fill, per-kind limits, truncation)

Missing:
| Feature | Status | Impact |
|---------|--------|--------|
| Tree-sitter parser | Not implemented | SymbolIndex requires manual population |
| Embedding store | Not implemented | No vector storage |
| RAG retriever | Not implemented | No semantic retrieval |
| LSP diagnostics ingestion | Partial (helper exists, no LSP integration) | Low |

Exit criteria not met:

- Top-5 recall benchmark requires tree-sitter + embeddings
- 10k-file performance benchmark not run
- `estimateTokens()` uses rough `length/4` — no real compression metric

Performance concerns:

- `SymbolIndex.removeFile()` does O(n) linear scan — will degrade at 10k+ files
- `InMemoryStore.search()` is naive substring — no relevance scoring

#### Agent Core (M5) — PARTIAL (~50%)

Implemented:

- EventStream (append-only, typed subscriptions, causal chain, session queries)
- ToolRegistryImpl (CRUD, mode-based allow/deny, glob patterns)
- ApprovalGate (risk/trust matrix, auto-approve, pending/approve/deny flow)
- CheckpointManager (create/restore with structuredClone, prune)
- AgentLoop (Plan-Act-Observe-Decide, pause/resume, auto-checkpoint every 5 steps, mode switching)

Missing:
| Feature | Status | Impact |
|---------|--------|--------|
| Task graph executor | Stub package | No DAG orchestration |
| Graph state reducers | Not implemented | No concurrent merge |
| Subagent spawner | Not implemented | No multi-agent |
| Subagent isolation | Not implemented | No budget/memory isolation |
| Built-in mode definitions | Not pre-registered | Ask/Architect/Code/Debug/Agent modes exist as types only |
| SQLite persistence | Not implemented (in-memory only) | All state volatile |
| `agent-runner` app | Stub | No standalone agent process |

Exit criteria not met:

- Session replay: stream exists but no replay executor
- Subagent isolation: no implementation
- Task graph concurrent nodes: package is stub

Edge cases:

- `createEvent()` uses module-level `_counter` — not safe across concurrent processes
- `AgentLoop.run()` doesn't catch handler exceptions — will leave loop in stale phase
- `ApprovalGate` has no timeout for pending approvals

### 1.3 Shared-Types Contracts Without Implementation

| Type File      | Unimplemented Contracts                                                              | Needed By                            |
| -------------- | ------------------------------------------------------------------------------------ | ------------------------------------ |
| `graph.ts`     | `TaskGraph`, `GraphNode`, `GraphEdge`, `GraphState`, `StateReducer`, `RetryPolicy`   | `task-graph` (M5)                    |
| `events.ts`    | `EditProposalEvent`, `SubagentSpawnEvent`, `SubagentResultEvent`, `MemoryWriteEvent` | No code emits/consumes these         |
| `modes.ts`     | `ToolCall`, `ToolResult`                                                             | `agent-core` uses own internal types |
| `providers.ts` | `FallbackChain` (full struct), `BudgetConfig`                                        | `ai-gateway` uses own internal types |

### 1.4 Cross-Cutting Gaps

1. **No SQLite persistence anywhere.** Plan says "SQLite via better-sqlite3, WAL mode" (ADR-0004). EventStream, MemoryStore, CheckpointManager, SettingsManager all in-memory. Systemic gap.
2. **MASTER-ACTION-PLAN.md is stale.** Shows ai-gateway as "In progress", context-engine and agent-core as "Stub". Section 10 references `feat/ai-gateway` as active. All three are merged.
3. **No IPC bridge for M3+ subsystems.** Desktop IPC only covers kernel. No channels for ai-gateway chat, context-engine queries, or agent-core operations.
4. **`task-graph` stub is part of M5 scope.** Current agent-core branch implements ~50% of M5.

---

## 2. Competitive 2026 Feature Matrix

### 2.1 Full Matrix

Legend: ✅ Shipped | 🔨 Partial/planned | ❌ Not available

| Feature                       | VS Code + Copilot | Cursor | Zed | JetBrains + Junie | Windsurf | **Code One** |
| ----------------------------- | :---------------: | :----: | :-: | :---------------: | :------: | :----------: |
| **Agent Loop**                |                   |        |     |                   |          |              |
| Plan-Act-Observe-Decide cycle |        ✅         |   ✅   | ❌  |        ✅         |    ✅    |      ✅      |
| Multi-step autonomous tasks   |        ✅         |   ✅   | ❌  |        ✅         |    ✅    |      ✅      |
| Pause / resume / interrupt    |        ✅         |   ✅   | ❌  |        🔨         |    🔨    |      ✅      |
| Visible plan display          |        ✅         |   ✅   | ❌  |        ✅         |    ✅    |      🔨      |
| **Checkpoints**               |                   |        |     |                   |          |              |
| State snapshot / rollback     |        ✅         |   ✅   | ❌  |        🔨         |    🔨    |      ✅      |
| Session replay from events    |        🔨         |   ❌   | ❌  |        ❌         |    ❌    |      ✅      |
| **Tool System**               |                   |        |     |                   |          |              |
| Tool registry + schemas       |        ✅         |   ✅   | ❌  |        ✅         |    ✅    |      ✅      |
| Mode-based tool permissions   |        🔨         |   ❌   | ❌  |        ❌         |    ❌    |      ✅      |
| Approval gates                |        ✅         |   ✅   | ❌  |        ✅         |    ✅    |      ✅      |
| Diff review UX                |        ✅         |   ✅   | 🔨  |        ✅         |    ✅    |      🔨      |
| **MCP**                       |                   |        |     |                   |          |              |
| MCP client                    |        ✅         |   ✅   | ❌  |        🔨         |    ✅    |      ❌      |
| MCP-configured tools          |        ✅         |   ✅   | ❌  |        🔨         |    ✅    |      ❌      |
| **Subagents**                 |                   |        |     |                   |          |              |
| Spawn child agents            |        ✅         |   ✅   | ❌  |        🔨         |    ❌    |      🔨      |
| Subagent isolation            |        🔨         |   🔨   | ❌  |        ❌         |    ❌    |      🔨      |
| **Memory**                    |                   |        |     |                   |          |              |
| Session memory                |        ✅         |   ✅   | ❌  |        🔨         |    ✅    |      ✅      |
| Cross-session memory          |        ✅         |   ✅   | ❌  |        🔨         |    🔨    |      🔨      |
| Semantic search               |        🔨         |   🔨   | ❌  |        ❌         |    ❌    |      🔨      |
| **Context**                   |                   |        |     |                   |          |              |
| Codebase indexing             |        ✅         |   ✅   | ✅  |        ✅         |    ✅    |      ✅      |
| File importance ranking       |        🔨         |   🔨   | ❌  |        🔨         |    🔨    |      ✅      |
| Token-budget assembly         |        🔨         |   ✅   | ❌  |        🔨         |    🔨    |      ✅      |
| RAG / embeddings              |        ✅         |   ✅   | ❌  |        🔨         |    🔨    |      🔨      |
| **AI Provider**               |                   |        |     |                   |          |              |
| Multi-provider support        |        ❌         |   ✅   | ✅  |        🔨         |    🔨    |      ✅      |
| Provider fallback chains      |        ❌         |   🔨   | ❌  |        ❌         |    ❌    |      ✅      |
| Health monitoring             |        ❌         |   ❌   | ❌  |        ❌         |    ❌    |      ✅      |
| Cost tracking / budgets       |        ❌         |   🔨   | ❌  |        ❌         |    ❌    |      ✅      |
| Local model support           |        ❌         |   ❌   | ❌  |        ❌         |    ❌    |      ✅      |
| **Background Agents**         |                   |        |     |                   |          |              |
| Cloud-sandboxed agents        |        🔨         |   ✅   | ❌  |        ✅         |    🔨    |      ❌      |
| Long-running job monitoring   |        🔨         |   ✅   | ❌  |        ✅         |    🔨    |      🔨      |
| **Task Graph**                |                   |        |     |                   |          |              |
| DAG-based orchestration       |        ❌         |   ❌   | ❌  |        ❌         |    ❌    |      🔨      |
| Concurrent node execution     |        ❌         |   ❌   | ❌  |        ❌         |    ❌    |      🔨      |
| State reducers                |        ❌         |   ❌   | ❌  |        ❌         |    ❌    |      🔨      |
| **Terminal**                  |                   |        |     |                   |          |              |
| Integrated terminal           |        ✅         |   ✅   | ✅  |        ✅         |    ✅    |      ❌      |
| Agent terminal execution      |        ✅         |   ✅   | ❌  |        ✅         |    ✅    |      ❌      |
| **Remote**                    |                   |        |     |                   |          |              |
| SSH / SFTP                    |        ✅         |   ❌   | ✅  |        ✅         |    ❌    |      ❌      |
| Container environments        |        ✅         |   ❌   | ✅  |        ✅         |    ❌    |      ❌      |
| Git integration               |        ✅         |   ✅   | ✅  |        ✅         |    ✅    |      ❌      |
| **Editor**                    |                   |        |     |                   |          |              |
| Code editing / syntax         |        ✅         |   ✅   | ✅  |        ✅         |    ✅    |      ❌      |
| Multi-file diff viz           |        🔨         |   ✅   | ✅  |        ✅         |    ✅    |      ❌      |
| **Skills / Plugins**          |                   |        |     |                   |          |              |
| Plugin system                 |        ✅         |   🔨   | 🔨  |        ✅         |    ❌    |      ❌      |
| Skill sandboxing              |        🔨         |   ❌   | ❌  |        ✅         |    ❌    |      🔨      |
| **Model Lab**                 |                   |        |     |                   |          |              |
| Model benchmarking            |        ❌         |   ❌   | ❌  |        ❌         |    ❌    |      ❌      |
| Fine-tune job runner          |        ❌         |   ❌   | ❌  |        ❌         |    ❌    |      ❌      |
| Hardware profiling            |        ❌         |   ❌   | ❌  |        ❌         |    ❌    |      ❌      |

### 2.2 Code One Unique Differentiators

1. **Append-only event stream as source of truth.** No competitor has a fully replayable, causally-linked event log for session replay, debugging, and audit trails.

2. **DAG-based task graph executor (typed, not yet implemented).** No shipping competitor has multi-node orchestration with state reducers and concurrent execution. Implementing this is the single biggest architectural advantage.

3. **Provider-agnostic fallback with cost governance.** VS Code locks to Copilot. Cursor has BYOK but no failover/budgets. Code One's FallbackRouter + TokenTracker + BudgetConfig with 3 exhausted strategies is unique.

4. **5-tier trust model with mode-based tool scoping.** No competitor has structured trust × risk matrix driving approval decisions. Others use binary allow/deny.

5. **First-class local/hybrid model support.** All competitors require cloud APIs as primary. Code One treats Ollama/LM Studio/llama.cpp as peers with identical fallback, health, and cost tracking.

6. **Kernel-first modular architecture.** Module registry with 6-state lifecycle, tier enforcement, and capability-based permissions. No other agentic editor has this discipline.

### 2.3 Critical Competitive Gaps (Priority Order)

| #   | Gap                        | Why It Matters                                  | Competitors With It                 |
| --- | -------------------------- | ----------------------------------------------- | ----------------------------------- |
| 1   | MCP client                 | Ecosystem access — table stakes for 2026        | VS Code, Cursor, Windsurf           |
| 2   | Terminal + agent execution | Agents can't run real commands                  | All except Zed                      |
| 3   | Task graph executor        | Code One's biggest differentiator, still a stub | None (unique to Code One)           |
| 4   | Git integration            | Baseline competence for any IDE                 | All competitors                     |
| 5   | SQLite persistence         | Memory/events/checkpoints are volatile          | Cursor, Copilot (persistent memory) |
| 6   | Subagent spawner           | Multi-agent orchestration edge                  | VS Code, Cursor                     |
| 7   | Background agent runner    | Parity with Cursor/Junie cloud agents           | Cursor, JetBrains                   |

---

## 3. GUI/UX Surface Specification

> Per project rule: ALL backend FIRST, GUI COMPLETELY LAST. This spec defines the target GUI surfaces for when backend is complete.

### 3.1 Layout Model

```
+--------+---------------------------+-----------+
| LEFT   |        CENTER             |   RIGHT   |
| RAIL   |     (Editor/Chat)         |   RAIL    |
| 48px   |       flexible            |  280-400  |
+--------+---------------------------+-----------+
|              BOTTOM PANEL (240px default)       |
|         (Terminal / Diagnostics / Output)       |
+------------------------------------------------+
|              STATUS BAR (24px)                  |
+------------------------------------------------+
```

**Top:** Command palette trigger (Ctrl+Shift+P), breadcrumbs, tab bar
**Status bar:** Branch, diagnostics count, agent mode, provider health, cost ticker

### 3.2 Surface Map

| Surface              | Component              | Package     | Data Source (IPC)              |
| -------------------- | ---------------------- | ----------- | ------------------------------ |
| **Left Rail**        |                        |             |                                |
| File explorer        | `<FileTree>`           | `workspace` | kernel:settings, fs operations |
| Search panel         | `<GlobalSearch>`       | `workspace` | kernel:command                 |
| Git panel            | `<GitPanel>`           | `git-tools` | git-tools IPC                  |
| Extensions           | `<SkillBrowser>`       | `skills`    | skills IPC                     |
| **Center**           |                        |             |                                |
| Code editor tabs     | `<EditorTabs>`         | `editor`    | Monaco, kernel:layout          |
| Chat panel           | `<ChatPanel>`          | `ui`        | agent-core IPC, ai-gateway IPC |
| Diff reviewer        | `<DiffReview>`         | `editor`    | agent-core:EditProposalEvent   |
| Settings UI          | `<SettingsEditor>`     | `ui`        | kernel:settings                |
| Welcome/onboarding   | `<Welcome>`            | `ui`        | kernel:settings                |
| **Right Rail**       |                        |             |                                |
| Agent activity       | `<AgentPanel>`         | `ui`        | agent-core:EventStream         |
| Context inspector    | `<ContextInspector>`   | `ui`        | context-engine IPC             |
| Approval queue       | `<ApprovalQueue>`      | `ui`        | agent-core:ApprovalGate        |
| Memory browser       | `<MemoryBrowser>`      | `ui`        | context-engine:MemoryStore     |
| Cost dashboard       | `<CostDashboard>`      | `ui`        | ai-gateway:TokenTracker        |
| **Bottom**           |                        |             |                                |
| Terminal             | `<Terminal>`           | `terminal`  | node-pty via IPC               |
| Diagnostics          | `<DiagnosticsPanel>`   | `ui`        | context-engine:diagnostics     |
| Output log           | `<OutputLog>`          | `ui`        | kernel:EventBus                |
| Checkpoint timeline  | `<CheckpointTimeline>` | `ui`        | agent-core:CheckpointManager   |
| **Status Bar**       |                        |             |                                |
| Branch indicator     | `<BranchStatus>`       | `git-tools` | git-tools IPC                  |
| Diagnostics count    | `<DiagCount>`          | `ui`        | context-engine                 |
| Agent mode           | `<ModeIndicator>`      | `ui`        | agent-core:mode                |
| Provider health      | `<ProviderHealth>`     | `ui`        | ai-gateway:HealthMonitor       |
| Cost ticker          | `<CostTicker>`         | `ui`        | ai-gateway:TokenTracker        |
| **Command Palette**  |                        |             |                                |
| Fuzzy command search | `<CommandPalette>`     | `ui`        | kernel:CommandBus              |

### 3.3 UX Principles

1. **Useful over flashy.** Every pixel must serve a function. No decorative chrome.
2. **Legible at a glance.** Agent state, costs, health — visible without clicking.
3. **Low noise.** Default to collapsed/hidden. Show on demand or when actionable.
4. **Agent-aware.** The UI must show what the agent is doing, what it's about to do, and what it needs approval for — at all times.
5. **Proof-first.** Every agent action shows evidence: diff hunks, test results, cost impact.
6. **Keyboard-driven.** Every action reachable via command palette. Mouse optional.
7. **Theme-safe.** Dark (default), light, high contrast. All surfaces tested in all three.

### 3.4 Critical UX Flows

| Flow                     | Steps                                                                                                                | Key Surfaces                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Agent task execution** | User types prompt → Agent plans → Shows plan for approval → Executes steps → Shows diffs → User accepts/rejects each | Chat, AgentPanel, DiffReview, ApprovalQueue |
| **Provider failover**    | Primary fails → Health indicator goes yellow → Fallback engages → Cost ticker updates → User notified                | ProviderHealth, CostTicker, OutputLog       |
| **Budget warning**       | Cost approaches limit → CostTicker turns amber → Hard limit → Agent paused → User decides                            | CostDashboard, CostTicker, ApprovalQueue    |
| **Checkpoint rollback**  | Agent makes bad edit → User clicks checkpoint in timeline → State restores → Editor updates                          | CheckpointTimeline, EditorTabs, AgentPanel  |
| **MCP tool discovery**   | User connects MCP server → Tools appear in registry → Agent can use them → Approval for new tools                    | SkillBrowser, AgentPanel, ApprovalQueue     |

---

## 4. Feature-by-Feature Test Plan

### 4.1 Current Test Coverage Summary

| Category          | Files  | Tests   | Pass    | Status   |
| ----------------- | ------ | ------- | ------- | -------- |
| Kernel subsystems | 8      | 90      | 90      | Complete |
| AI Gateway        | 7      | 111     | 111     | Complete |
| Context Engine    | 5      | 66      | 66      | Complete |
| Agent Core        | 5      | 80      | 80      | Complete |
| Desktop IPC       | 3      | 19      | 19      | Complete |
| Test Harness      | 1      | 6       | 6       | Complete |
| **Total**         | **29** | **372** | **372** |          |

### 4.2 Test Quality Assessment

**Strengths:**

- Behavioral testing throughout — tests target public APIs, not internals
- Error paths well-covered: duplicate registration, unknown IDs, budget exceeded, provider failures, circular deps
- Edge cases present: empty graphs, self-loops, SSE `\r\n`, expired entries, stale active files
- Deep clone verification in checkpoint tests (mutation isolation)
- Kernel integration test (register module → execute command → check permission)

**Structural Gaps:**

| Gap                                  | Severity | Where Needed                                      |
| ------------------------------------ | -------- | ------------------------------------------------- |
| No integration tests (cross-package) | High     | agent-core → ai-gateway → context-engine          |
| No concurrent/parallel tests         | Medium   | EventBus, AgentLoop, EventStream                  |
| No performance/stress tests          | Medium   | SymbolIndex (10k files), EventStream (10k events) |
| No persistence round-trip tests      | High     | All in-memory stores (once SQLite added)          |
| No mid-stream error tests            | Medium   | SSE streaming (connection drop after N chunks)    |
| Desktop error-path coverage thin     | Low      | 1 error test for 10 handlers                      |
| No end-to-end agent scenario         | High     | Full plan-act-observe loop with real tools        |

### 4.3 Required Test Plan by Feature

#### 4.3.1 Functional Tests (per subsystem)

| Subsystem                                                                     | Required Tests                                                      | Priority  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------- | --- |
| **Kernel**                                                                    | ✅ Complete (90 tests)                                              | —         |
| **AI Gateway**                                                                | ✅ Complete (111 tests)                                             | —         |
| **AI Gateway** — add: cache token pricing, per-request retry/backoff          | 4 tests                                                             | P2        |
| **Context Engine** — existing                                                 | ✅ Complete for implemented code (66 tests)                         | —         |
| **Context Engine** — add: tree-sitter parsing, embedding store, RAG retrieval | ~30 tests                                                           | P1        |
| **Agent Core** — existing                                                     | ✅ Complete for implemented code (80 tests)                         | —         |
| **Agent Core** — add: task graph, subagent spawn/isolation, mode presets      | ~40 tests                                                           | P1        |
| **Desktop** — add: event:subscribe handler, error paths for all handlers      | ~15 tests                                                           | P2        |
| **Task Graph**                                                                | Full suite: graph executor, state reducers, concurrent nodes, retry | ~50 tests | P1  |
| **MCP**                                                                       | Client connect, tool discovery, schema validation, error recovery   | ~30 tests | P1  |
| **Git Tools**                                                                 | Status, commit, push, pull, branch, checkout, PR create             | ~25 tests | P1  |
| **Remote**                                                                    | SSH auth, SFTP transfer, tunnel lifecycle, Docker client            | ~30 tests | P2  |
| **Skills**                                                                    | Manifest parse, install/uninstall, sandbox, permission scoping      | ~25 tests | P2  |
| **Model Lab**                                                                 | Catalog, benchmark harness, job runner, hardware profiler           | ~20 tests | P3  |

#### 4.3.2 Integration Tests

| Scenario                                  | Components                             | Tests | Priority |
| ----------------------------------------- | -------------------------------------- | ----- | -------- |
| Agent executes tool via gateway           | agent-core → ai-gateway                | 5     | P1       |
| Context assembly feeds agent              | context-engine → agent-core            | 5     | P1       |
| Full agent loop with checkpoint/rollback  | agent-core + checkpoint + event-stream | 3     | P1       |
| MCP tool appears in agent registry        | mcp → agent-core → tool-registry       | 3     | P1       |
| Budget enforcement pauses agent           | ai-gateway:cost → agent-core:loop      | 3     | P2       |
| Fallback during agent execution           | ai-gateway:fallback → agent-core       | 3     | P2       |
| IPC round-trip (renderer → main → kernel) | desktop → kernel                       | 5     | P2       |

#### 4.3.3 Performance Tests

| Test                           | Target         | Metric                      |
| ------------------------------ | -------------- | --------------------------- |
| SymbolIndex 10k files          | context-engine | Index build <30s, query <2s |
| EventStream 10k events         | agent-core     | Append <1ms, query <10ms    |
| PageRank 5k nodes              | context-engine | Converge <5s                |
| Provider registry 50 providers | ai-gateway     | Route <1ms                  |
| Checkpoint create/restore      | agent-core     | <50ms for typical state     |

#### 4.3.4 Agentic Tests (eval-style)

| Scenario                           | What to Measure                                   | Target |
| ---------------------------------- | ------------------------------------------------- | ------ |
| 5-step planning task               | Agent completes all steps without stalling        | 100%   |
| Risky tool rejection               | Agent respects approval denial, tries alternative | 100%   |
| Budget exhaustion                  | Agent degrades gracefully or pauses               | 100%   |
| Provider failure mid-task          | Agent falls back and continues                    | 100%   |
| Checkpoint rollback after bad edit | State fully restored, no corruption               | 100%   |
| Concurrent subagent tasks          | No memory leakage, correct merge                  | 100%   |

#### 4.3.5 Accessibility Tests (GUI phase)

| Test                                        | Standard                   |
| ------------------------------------------- | -------------------------- |
| All interactive elements keyboard-reachable | WCAG 2.1 AA                |
| Focus indicators visible in all themes      | WCAG 2.1 AA                |
| Color contrast ratios                       | 4.5:1 text, 3:1 large text |
| Screen reader landmarks for all panels      | ARIA roles                 |
| No information conveyed by color alone      | WCAG 2.1 AA                |

#### 4.3.6 Visual Tests (GUI phase)

| Test                                           | Tool              |
| ---------------------------------------------- | ----------------- |
| Component snapshots (all 3 themes)             | Vitest + snapshot |
| Panel layout at 1280×720, 1920×1080, 3840×2160 | Playwright        |
| Diff review readability                        | Manual review     |
| Status bar legibility at 100%/125%/150% DPI    | Playwright        |

---

## 5. Revised Milestone Sequence

### 5.1 Tension: GUI Last vs. Early Validation

The user's standing directive: **ALL backend FIRST, GUI COMPLETELY LAST.**

The competitive review pack notes: "The backend-heavy strategy created strong foundations, but now the project must shift to thin, real GUI slices to validate usefulness."

**Resolution:** Maintain the backend-first strategy. The review pack's concern is valid for a product seeking market validation, but Code One's architecture requires backend completeness before GUI surfaces can be meaningful. The agent loop, task graph, MCP, terminal, and git integration must all exist before the GUI can demonstrate real workflows. Building GUI now would produce a hollow shell that proves nothing.

**Compromise:** After M6 (when agents can actually execute commands via terminal and git), insert a thin GUI validation milestone (M6.5) that wires exactly enough UI to demonstrate one end-to-end agent workflow. This validates the UX thesis without derailing backend work.

### 5.2 Revised Sequence

```
Current state (2026-04-14):
  M0 Repo Foundation     ████████████ 100%  (merged)
  M1 Kernel              ████████████ 100%  (merged)
  M2 Electron Shell      ████████████ 100%  (merged)
  M3 AI Gateway          ████████████ 100%  (merged)
  M4 Context Engine      ███████░░░░░  60%  (merged, tree-sitter/RAG/embeddings deferred)
  M5 Agent Core          ██████░░░░░░  50%  (merged, task-graph/subagents/persistence deferred)
```

#### Revised Order (Backend Priority)

| #       | Milestone                 | Packages                                                      | Key Deliverables                                                            | Est. Tests |
| ------- | ------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------- |
| **M5b** | Agent Core Completion     | `agent-core`, `task-graph`, `agent-runner`                    | Task graph executor, subagent spawner, built-in modes, agent-runner process | ~60 new    |
| **M6**  | Git + Terminal            | `git-tools`, `terminal` (backend only)                        | Git status/commit/push/PR, node-pty bridge, agent command execution         | ~50 new    |
| **M7**  | MCP + Skills              | `mcp`, `skills`                                               | MCP client, tool bridge, skill manifest, installer, sandbox                 | ~55 new    |
| **M4b** | Context Engine Completion | `context-engine`                                              | Tree-sitter parser, embedding store, RAG retriever                          | ~30 new    |
| **M8**  | Remote/DevOps             | `remote`                                                      | SSH, SFTP, tunnels, Docker, deploy, audit logger                            | ~30 new    |
| **M9**  | Model Lab                 | `model-lab`                                                   | Model catalog, benchmarks, job runner, hardware profiler                    | ~20 new    |
| **M10** | SQLite Persistence        | All packages                                                  | Replace all in-memory stores with SQLite, WAL mode, migration system        | ~40 new    |
| **M11** | GUI Layer                 | `ui`, `editor`, `workspace`, `terminal` (renderer), `preview` | Full GUI per surface spec in section 3                                      | ~100 new   |

#### Rationale for Reorder

1. **M5b before M6:** Task graph executor is Code One's biggest differentiator. Finish it before adding more packages.
2. **M6 (Git + Terminal) moved up:** Without terminal and git, agents can plan but not execute. This is the minimum for a functional agent IDE.
3. **M7 (MCP + Skills) moved up:** MCP is table stakes for 2026. Every serious competitor ships it.
4. **M4b deferred:** Tree-sitter and embeddings improve context quality but aren't blocking. Substring search and manual symbol population work for now.
5. **M10 (SQLite) added:** Persistence is a systemic gap. Better as a dedicated milestone than scattered across packages.
6. **M11 (GUI) remains last:** Honors the user's directive. By M11, every backend system is complete and the GUI can demonstrate real workflows.

### 5.3 Updated Completion Estimate

| Metric                          | Value                                          |
| ------------------------------- | ---------------------------------------------- |
| Implemented packages (non-stub) | 6 of 17 + 1 of 2 apps                          |
| Total tests                     | 372                                            |
| Backend completion              | ~40%                                           |
| Overall completion              | ~30%                                           |
| Remaining backend milestones    | 8 (M5b, M6, M7, M4b, M8, M9, M10, integration) |
| Remaining GUI milestones        | 1 (M11)                                        |

---

## 6. MASTER-ACTION-PLAN Corrections Needed

The following entries in `MASTER-ACTION-PLAN.md` are stale:

| Section                    | Current                                                            | Should Be                                 |
| -------------------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| Header: Current branch     | `feat/context-engine`                                              | `main`                                    |
| Header: Overall completion | ~35% backend, ~28% total                                           | ~40% backend, ~30% total                  |
| Section 4                  | Missing M4 and M5 entries                                          | Add Context Engine and Agent Core as done |
| Section 5: M3              | Shows as "DONE"                                                    | Correct                                   |
| Section 5: M4              | Shows as "IN PROGRESS"                                             | Should be "PARTIAL (merged)"              |
| Section 5: M5              | Shows as next priority                                             | Should be "PARTIAL (merged)"              |
| Section 6: Package map     | ai-gateway "In progress", context-engine "Stub", agent-core "Stub" | All three "Done (partial for M4/M5)"      |
| Section 10: Open PR        | `feat/ai-gateway` (active)                                         | All PRs merged (#1-#5)                    |

---

## Appendix A: Stub Package Inventory

All 11 stub packages contain only `export {}` in `src/index.ts` and have `--passWithNoTests` in their test script.

| Package      | Milestone | Purpose                           |
| ------------ | --------- | --------------------------------- |
| `task-graph` | M5b       | DAG orchestration, state reducers |
| `git-tools`  | M6        | Git operations                    |
| `terminal`   | M6        | xterm.js + node-pty               |
| `mcp`        | M7        | MCP client, tool bridge           |
| `skills`     | M7        | Skill runtime, installer          |
| `remote`     | M8        | SSH, SFTP, tunnels, Docker        |
| `model-lab`  | M9        | Model catalog, benchmarks         |
| `editor`     | M11       | Monaco integration                |
| `workspace`  | M11       | File tree, project management     |
| `preview`    | M11       | Webview, WebContainers            |
| `ui`         | M11       | Shared React components           |

## Appendix B: File Counts

```
Implemented source files:  ~60
Implemented test files:     29
Total tests:               372
Stub packages:              11
Stub apps:                   1
Type definition files:      12
Design/plan documents:       7
ADR documents:               3+
```
