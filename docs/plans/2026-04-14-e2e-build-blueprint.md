# Hybrid IDE — E2E Build, Research, and Git Execution Blueprint

Date: 2026-04-14

## Objective

Build the Hybrid IDE as a research-backed, branch-driven, auditable system that:

- ships in layers
- gathers proven patterns from papers and open-source projects
- implements each subsystem in isolated branches
- verifies each subsystem before merge
- keeps the repo clean, reviewable, and rollback-safe
- pushes all work to GitHub continuously with traceable commits

---

## 1) Delivery model

Use a **trunk + feature branch + milestone tag** workflow.

### Branch strategy

- `main` — protected, releasable only
- `develop` — integration branch for staging
- `feat/kernel-*`
- `feat/core-ide-*`
- `feat/ai-layer-*`
- `feat/intelligence-*`
- `feat/agents-*`
- `feat/remote-*`
- `feat/skills-*`
- `feat/model-lab-*`
- `research/*` — source reviews, experiment spikes, architecture notes
- `fix/*` — defects
- `release/*` — stabilization windows

### Pull request rule

Every implementation branch must include:

- scope summary
- linked design section
- linked research note
- tests added/updated
- screenshots or terminal proof where relevant
- risk notes
- rollback notes

### Commit style

Use conventional commits with subsystem scope:

- `feat(kernel): add command bus and module registry`
- `feat(editor): integrate Monaco with tab state`
- `feat(ai): add provider adapter interface`
- `feat(agent): add event bus and typed event schema`
- `feat(remote): add SSH connection profile store`
- `docs(research): synthesize OpenHands and LangGraph patterns`
- `test(agent): add approval gate resume coverage`
- `fix(preview): resolve stale webview reload loop`

### Push cadence

Push at every meaningful checkpoint:

- architecture skeleton complete
- interface contracts complete
- first passing tests
- feature complete
- integration verified
- PR ready

Avoid giant "everything changed" pushes.

---

## 2) Research operating model

Create a dedicated `docs/research/` folder and require a source-backed note before major subsystem work starts.

### Folder structure

- `docs/research/openhands.md`
- `docs/research/aider.md`
- `docs/research/langgraph.md`
- `docs/research/kilocode.md`
- `docs/research/claude-code.md`
- `docs/research/opencode.md`
- `docs/research/security-sandboxing.md`
- `docs/research/agentic-coding-papers.md`
- `docs/research/pattern-decision-log.md`

### Research note template

Each note should capture:

1. Source (project, paper, or documentation URL)
2. What pattern it proves
3. Why it matters for our system
4. How we adapt it
5. What we will not copy
6. Risks
7. Validation checklist

### Mandatory rule

No subsystem implementation starts until the corresponding research note exists.

---

## 3) Proven patterns to adopt

### A. OpenHands-inspired patterns

Adopt:

- append-only event stream as the source of truth
- action/observation separation
- sandboxed runtime for execution
- workspace isolation
- streamed agent updates to the UI

Implement as typed events:

- `AgentEvent`, `ToolCallEvent`, `ToolResultEvent`
- `ApprovalRequestEvent`, `ApprovalResponseEvent`
- `CheckpointEvent`, `SubagentSpawnEvent`, `SubagentResultEvent`

Do not copy blindly:

- keep runtime abstraction independent so local and remote sandboxes can share contracts

### B. Aider-inspired patterns

Adopt:

- repository map via Tree-sitter + PageRank
- structural code context rather than raw file dumping
- multi-file edit formats (SEARCH/REPLACE, whole file, unified diff)
- git-aware editing workflow
- multi-model strategy (primary, editor, utility)

Do not copy blindly:

- keep edit engine modular so strategies coexist

### C. LangGraph-inspired patterns

Adopt:

- graph/state-machine orchestration for complex tasks
- checkpoints after every node
- interrupt/resume for human-in-the-loop
- reducer-based state updates
- resumable workflows

Do not copy blindly:

- do not let graph complexity leak into simple chat flows; use graph mode only for real multi-step execution

### D. KiloCode/Claude Code mode and permission patterns

Adopt:

- mode-based tool permissions (Ask, Architect, Code, Debug, Agent)
- custom modes as JSON configuration
- scoped autonomy levels
- programmable hooks before risky actions
- approval policy by tool category
- hierarchical subagents with isolated context

### E. Security patterns

Adopt:

- isolated code execution (Docker/WASM sandbox)
- remote actions always high-trust with approval
- command validation hooks
- audit logging on all tool calls
- explicit capability grants per mode

Trust levels:

- Trusted (read-only)
- Guarded (local mutations)
- Restricted (system access)
- Isolated (untrusted code)
- Remote (external systems)

---

## 4) Repo structure

```text
hybrid-ide/
  apps/
    desktop/               # Electron app shell
    agent-runner/           # Standalone agent process
  packages/
    kernel/                 # Tier 0: command bus, module registry, permissions
    editor/                 # Monaco integration
    workspace/              # File tree, project management
    terminal/               # xterm.js integration
    preview/                # Webview, app launcher
    ai-gateway/             # Provider abstraction, streaming
    context-engine/         # Repo map, RAG, memory, ranking
    agent-core/             # Event bus, agent loop, modes
    task-graph/             # LangGraph-style orchestration
    git-tools/              # Git operations
    remote/                 # SSH, SFTP, tunnels, deploy
    skills/                 # Skill runtime, authoring
    mcp/                    # MCP client manager
    model-lab/              # Model catalog, benchmarks
    ui/                     # Shared UI components, themes
    shared-types/           # TypeScript type contracts
    test-harness/           # Shared test utilities
  docs/
    architecture/           # System architecture docs
    research/               # Source-backed research notes
    adr/                    # Architecture Decision Records
    plans/                  # Design docs and blueprints
    runbooks/               # Operational procedures
  scripts/
    bootstrap/              # Project setup scripts
    ci/                     # CI/CD scripts
    release/                # Release automation
  .github/
    workflows/              # GitHub Actions
    pull_request_template.md
    ISSUE_TEMPLATE/
```

---

## 5) Branch-by-branch build plan

### Milestone 0 — Repository foundation

Branch: `feat/repo-bootstrap`

Deliver:

- monorepo scaffold (pnpm workspaces)
- package manager/workspace setup
- lint (ESLint), format (Prettier), typecheck (TypeScript)
- CI skeleton (GitHub Actions)
- branch protections documented
- PR template
- ADR template
- issue templates

Exit criteria:

- clean install
- clean build
- clean test pass
- first GitHub Actions green run

### Milestone 1 — Tier 0 kernel

Branches:

- `feat/kernel-command-bus`
- `feat/kernel-module-registry`
- `feat/kernel-permissions`
- `feat/kernel-layout-state`

Deliver:

- event/command bus
- module registry (register, unregister, lifecycle)
- settings store (user + project scope)
- layout persistence (pane arrangement)
- permission engine (capability-based)
- typed contracts in shared-types

Exit criteria:

- modules can register/unregister (lifecycle test covers all 6 states)
- commands are observable and test-covered (≥90% statement coverage on kernel)
- permission checks block disallowed actions (≥5 deny scenarios tested)
- state restores on restart (settings + layout verified by round-trip test)
- tier constraint enforcement rejects illegal cross-tier dependencies

### Milestone 1.5 — Onboarding + Polish

Branches:

- `feat/onboarding-wizard`
- `feat/status-bar`

Deliver:

- first-run onboarding wizard (provider setup, theme, project import)
- status bar (branch, diagnostics count, active mode, provider health)
- breadcrumbs and symbol navigation
- diff viewer (side-by-side and inline)

Exit criteria:

- fresh install walks through onboarding (tested on clean profile)
- status bar updates within 500ms of state change
- diff viewer renders staged changes (side-by-side and inline modes)
- breadcrumbs navigate to correct symbol on click
- onboarding stores provider key and selected theme on completion

### Milestone 2 — Tier 1 core IDE

Branches:

- `feat/editor-monaco`
- `feat/workspace-file-tree`
- `feat/terminal-xterm`
- `feat/preview-runner`
- `feat/theme-system`
- `feat/global-search`
- `feat/diagnostics-panel`

Deliver:

- Monaco tabs with syntax highlighting, minimap
- file tree CRUD with drag-drop
- integrated terminal (xterm.js + node-pty)
- project type detection and smart launcher
- preview surface (webview / WebContainers for web, external for desktop/CLI)
- theme switching (dark, light, high contrast)
- global search (file search + content search + regex)
- diagnostics/problems panel (ESLint, TypeScript, custom linters)

Exit criteria:

- open/edit/save works with ≥3 file types (ts, json, md)
- terminal shell runs on Windows, macOS, Linux
- web preview loads within 2s of project detection
- CLI and desktop projects route correctly (≥2 project types tested)
- themes persist across sessions (verified by restart test)
- global search returns results across workspace in <500ms for 1k files
- diagnostics panel shows real-time errors/warnings within 1s of file save
- ≥80% statement coverage on new Tier 1 code

### Milestone 3 — Light Tier 2 AI coding

Branches:

- `feat/ai-provider-adapters`
- `feat/ai-chat-panel`
- `feat/ai-inline-completions`
- `feat/ai-settings`
- `feat/ai-fallback-chains`
- `feat/ai-health-dashboard`

Deliver:

- provider abstraction (OpenAI-compatible, Ollama, LM Studio, llama.cpp, cloud APIs)
- endpoint config UI with API key management (encrypted storage)
- streaming chat panel with markdown rendering
- code insertion from chat to editor
- inline completion via LLM
- conversation persistence per workspace
- provider fallback chains with automatic failover (rate limit / outage / timeout triggers next)
- per-provider health checks (latency, error rates, uptime)
- per-provider token tracking for cost governance
- local models as final offline fallback for all roles

Exit criteria:

- supports any OpenAI-compatible endpoint
- can swap providers without UI rewrites
- streaming is stable
- prompts and completions log correctly
- fallback chain activates within 3s of primary failure
- health dashboard shows per-provider latency and error rate
- token usage tracked and queryable per provider per session

### Milestone 4 — Tier 3 intelligence

Branches:

- `feat/context-repomap`
- `feat/context-indexing`
- `feat/context-memory`
- `feat/context-ranking`

Deliver:

- repo map (Tree-sitter + PageRank)
- embeddings/retrieval (RAG)
- active file prioritization
- diagnostics ingestion
- persistent memory layer (Mem0-style)
- context compression and summarization

Exit criteria:

- AI sees relevant files beyond open tabs (top-5 recall ≥70% on test queries)
- retrieval quality measured via eval harness (precision@10 tracked per release)
- repos with 10k+ files index in <30s, queries return in <2s
- memory is scoped (session/user/project/global) and reviewable via UI
- context compression reduces token count by ≥40% without losing key references
- ≥80% statement coverage on Tier 3 code

### Milestone 5 — Tier 4 agent system

Branches:

- `feat/agent-event-bus`
- `feat/agent-loop`
- `feat/agent-modes`
- `feat/agent-approval-gates`
- `feat/agent-task-graph`
- `feat/agent-subagents`

Deliver:

- append-only event stream with typed events
- tool call contracts and registry
- mode system (Ask, Architect, Code, Debug, Agent + custom)
- approval UI with diff preview
- checkpoints with rollback
- interrupt/resume
- task graph execution (planner, executor, reviewer nodes)
- subagent spawning with isolated context

Exit criteria:

- agent can plan, act, pause, resume, and complete (5-step scenario tested)
- all risky actions (file write, shell exec, git push) gated with approval UI
- session can be replayed from events (full replay test with ≥10 events)
- rollback to checkpoint works (restore verified by state diff)
- subagent isolation enforced (no parent memory leakage verified by test)
- task graph supports ≥3 concurrent nodes without deadlock
- ≥80% statement coverage on Tier 4 code

### Milestone 6 — Tier 5 remote/devops

Branches:

- `feat/remote-ssh`
- `feat/remote-sftp`
- `feat/remote-tunnels`
- `feat/remote-docker`
- `feat/git-integrated-workflows`
- `feat/deploy-actions`

Deliver:

- SSH profiles and terminal connections
- remote file access (SFTP)
- tunnel/deploy actions (Cloudflare)
- docker controls
- git status/branch/commit/push/PR from UI

Exit criteria:

- SSH sessions authenticated and encrypted (key + password tested)
- SFTP file transfer completes for files ≥100MB without corruption
- deploy steps produce audit log entries (who, what, when, target)
- git actions visible in UI (branch, commit, push, PR) and shell-safe
- tunnel creation succeeds within 5s, survives network interruption gracefully
- Docker container start/stop/logs work via UI
- ≥80% statement coverage on Tier 5 code

### Milestone 7 — Tier 6 skills/MCP/plugins

Branches:

- `feat/skills-runtime`
- `feat/skills-authoring`
- `feat/mcp-client`
- `feat/plugin-sdk`

Deliver:

- skill manifest and installer
- skill permissions and memory scopes
- local skill authoring
- MCP server registry and client
- plugin contribution points
- tool schema validation

Exit criteria:

- third-party skills install, activate, and uninstall without side effects
- MCP tools appear in registry with correct permissions (tested with ≥2 MCP servers)
- plugin failures are isolated (crash test: bad plugin does not bring down host)
- skill memory scopes enforced (skill cannot read another skill's private scope)
- tool schema validation rejects malformed schemas (≥5 negative test cases)
- ≥80% statement coverage on Tier 6 code

### Milestone 8 — Tier 7 model lab

Branches:

- `feat/model-catalog`
- `feat/model-endpoint-profiles`
- `feat/model-benchmarks`
- `feat/model-job-runner`

Deliver:

- local model profiles (GGUF management)
- backend tuning UI
- benchmark/eval harness
- optional training/fine-tune launcher hooks

Exit criteria:

- local GGUF and cloud API profiles coexist (switch without restart)
- benchmarking is reproducible (same prompt + model = same score ±5%)
- heavy compute features (fine-tune, training) are optional modules (app starts without them)
- model catalog loads ≥3 providers in <1s
- ≥80% statement coverage on Tier 7 code

---

## 6) GitHub workflow discipline

### Protected branch rules

Protect `main`:

- PR required
- status checks required
- squash or rebase only
- no direct pushes
- release tags only from green commits

### CI gates

Minimum required on every PR:

- install
- lint
- typecheck
- unit tests
- integration tests for touched packages
- build of desktop shell
- security audit where applicable

### Evidence artifacts

Every milestone PR should attach:

- screenshots
- terminal logs
- test result summary
- changed package list
- risks and follow-ups

---

## 7) Research-to-code workflow

For each subsystem:

1. Create research branch: `research/agent-event-patterns`
2. Add source note: `docs/research/agent-event-patterns.md`
3. Write ADR: `docs/adr/0007-agent-event-stream.md`
4. Open implementation branch: `feat/agent-event-bus`
5. Implement smallest vertical slice first
6. Add tests and demo proof
7. Open PR linking research note, ADR, implementation checklist, validation proof

---

## 8) Agent workflow for building this project

Use a controlled multi-agent pattern:

- **Research Agent**: gathers papers, official docs, architecture examples
- **Architect Agent**: turns research into ADRs and contracts
- **Implementation Agent**: writes code on feature branches
- **Review Agent**: checks correctness, boundaries, test coverage
- **Verification Agent**: runs app, tests, and scenario proof
- **Release Agent**: prepares changelog, version bump, release notes

Rules:

- agents do not commit straight to `main`
- every agent works on a branch
- agent commits must stay scoped
- merges happen only after verification

---

## 9) Non-negotiable anti-chaos rules

1. No giant feature branches covering multiple tiers
2. No "misc fixes" commits
3. No direct edits on `main`
4. No uncited architectural decisions
5. No agent execution without audit logs
6. No risky tool without approval path
7. No hidden side effects in skills/plugins
8. No claiming completion without run proof

---

## 10) First 30 days recommended sequence

**Week 1:**

- repo bootstrap (monorepo, CI, PR governance)
- research folder + ADR process
- kernel contracts (command bus, module registry, permissions)

**Week 2:**

- editor, file tree, terminal, preview
- minimal desktop shell usable
- theme system

**Week 3:**

- provider abstraction
- chat panel with streaming
- inline completion
- settings and session persistence

**Week 4:**

- repo map (Tree-sitter + PageRank)
- context engine v1
- event bus foundation
- first agent mode and approval gate

This produces a real product early without waiting for every advanced tier.

---

## 11) Product vision

> A desktop-first modular AI development platform that combines IDE workflows, autonomous agents, remote operations, and extensible skills in a single cohesive workspace.

**Hybrid IDE = AI-native desktop IDE + agent platform + remote dev console + skill ecosystem.**
