# Hybrid IDE — Architecture Design

> A desktop-first modular AI development platform that combines IDE workflows, autonomous agents, remote operations, and extensible skills in a single cohesive workspace.

---

## What Makes It "Hybrid"

- Local + remote
- Manual coding + autonomous agents
- Single-model + multi-provider
- Editor UX + ops/devops workflows
- Static IDE + evolving skill ecosystem
- Local files + web-connected tools
- Human-first control + optional agent autonomy

---

## Tier Architecture

### Tier 0 — Platform Kernel

The foundation everything plugs into. Knows nothing about coding, models, or SSH by itself.

| Responsibility             | Description                                      |
| -------------------------- | ------------------------------------------------ |
| Windowing & layout manager | Dock, split, resize, persist pane arrangement    |
| Command bus                | Central command dispatch and keybinding registry |
| Permissions & trust model  | Capability-based access control for modules      |
| Plugin/module registry     | Register, load, unload, version modules          |
| Event system               | Pub/sub for cross-module communication           |
| Settings/profile store     | User preferences, per-project overrides          |
| Workspace/session manager  | Open projects, restore sessions, multi-workspace |
| Security module            | Sandbox policy, audit logs, trust levels         |

### Tier 1 — Core IDE

The usable product on day one. "It already works as an IDE."

- Monaco editor with multi-tab, syntax highlighting, minimap
- File tree with create/rename/delete/drag-drop
- Global search (file search + content search + regex)
- Integrated terminal (xterm.js)
- Project open/create/import
- Diagnostics/problems panel (ESLint, TypeScript, custom linters)
- Smart runner/launcher (auto-detect project type)
- Embedded preview for web projects (webview / WebContainers)
- External launch handling for desktop/CLI projects
- Theme system (dark, light, high contrast, custom)
- Onboarding flow (first-run wizard: provider setup, theme, project import)
- Breadcrumbs and symbol navigation (file path + symbol hierarchy)
- Minimap highlights (search results, errors, changes)
- Diff viewer (side-by-side and inline diff for file changes)
- Status bar (branch, diagnostics count, active mode, provider health)

### Tier 2 — AI Coding Layer

The assistant becomes useful without being autonomous.

- Chat panel with streaming markdown rendering
- Inline code completions from LLM
- Next Edit Suggestions / Supercomplete (predict next edit location + content)
- Code actions (explain, refactor, fix, document, generate tests)
- @-mention context system (@file, @folder, @codebase, @docs, @web, @terminal, @git)
- Notepads / reusable context bundles (save and reattach prompt+context combos)
- Repo context assembly (open files, selections, diagnostics)
- Multi-file patch proposals with diff preview
- Apply/reject individual changes (per-hunk granularity)
- Prompt presets (coding style, language, task type)
- Endpoint abstraction with fallback chains per model role
- Supported providers: Anthropic (Claude), OpenAI, MiniMax, Google (Gemini), Ollama, LM Studio, llama.cpp, any OpenAI-compatible endpoint
- Automatic failover: rate limit / outage / timeout triggers next provider in chain
- Local models as final offline fallback for all roles
- API key management per provider (encrypted storage)
- Per-provider token tracking for cost governance
- Arena mode (blind side-by-side model comparison for evaluation)
- Provider health dashboard (latency, error rates, uptime per provider)

### Tier 3 — Intelligence Layer

Memory + understanding. The AI becomes a true pair programmer.

- Project indexing (file contents, structure)
- Embeddings / RAG over codebase
- Semantic code search via embeddings (natural language → code)
- Code symbol graph (imports, references, call hierarchy)
- AI Codemaps (visual codebase maps — dependency graphs, call trees, architecture diagrams)
- Session memory (current conversation context)
- Persistent user/project memory (Mem0-style)
- Context ranking (what matters most for this query)
- Summarization and compression (stay within context limits)
- Project knowledge cards (quick reference for key architecture decisions)
- Decision history (why was X chosen over Y)
- Architecture map (visual or structured overview)
- Checkpoint/rewind system (beyond git — snapshot and restore full agent state)

### Tier 4 — Agent Layer

Stops being an assistant, starts doing work.

- Task planner (break down goals into steps)
- Agent runner (execute multi-step plans)
- Tool invocation loop (read, write, run, iterate)
- Multi-step workflows with state
- File edit agents (autonomous code changes)
- Test/fix loop (run tests, read errors, fix, repeat)
- Approval gates (require user confirmation for risky ops)
- Sandbox policies (what agents can and cannot do)
- Rollback checkpoints (undo agent work)
- Branch-per-task workflow (isolate agent work in git branches)
- Artifact generation (generate files, configs, docs)
- Background agents (spawn long-running agents in isolated environments)
- Issue-to-PR autonomous flow (read issue → plan → implement → test → open PR)
- Git worktrees for parallel agent execution (multiple agents, no branch conflicts)
- Agentic code review (automated review agent on PRs)
- Watch mode (monitor files/directories, trigger agent on change)
- Scheduled/recurring tasks (cron-style automation)

### Tier 4.5 — Automation Fabric

Continuous supervision layer wrapping the Agent System for maximum autonomy and reliability.

- Shadow Verifier (secondary model reviews all outputs before completion)
- Model Router (routes tasks dynamically: reasoning, editing, utility, vision)
- Approval Broker (smart escalation: auto-approve safe, escalate risky, batch approvals)
- Cost Governor (token/API tracking, dynamic model switching, budget enforcement)
- Context Curator (maintains repo/architecture/dependency/runtime/agent maps)
- Eval Engine (continuous evaluation: patch success, task completion, agent performance)
- Failure Recovery Daemon (checkpoint all tasks, resume from failure, rollback bad changes)
- Skill Trigger Engine (auto-run skills based on context: deploy → validator, CI → checker)
- Computer Use Layer (optional: UI automation, web dashboard interaction, E2E validation)

### Tier 5 — Remote / DevOps Layer

Works beyond localhost.

- SSH terminal connections
- SFTP/remote file explorer
- VPS profiles (saved connection configs)
- Cloudflare integration (tunnels, Pages, Workers)
- Tunnel manager (expose local projects)
- Git integration (branch, commit, push, PR flows)
- Deploy connectors (Vercel, Netlify, Cloudflare Pages, custom VPS)
- Logs/process monitor
- Container and Docker controls
- Remote workspace mounting

### Tier 6 — Skills / MCP / Plugin Ecosystem

Extensibility for everyone.

- Skill packages (more than prompts — instructions, tool permissions, UI panel hooks, model preferences, memory scopes, optional workflows)
- Local skill authoring (create skills within the IDE)
- MCP client manager (connect external tool servers)
- Agent Client Protocol (ACP) support (interoperate with external agent frameworks)
- Plugin SDK (third-party UI panels, commands, themes, language support)
- Tool schemas (define and register tools)
- UI contribution points (modules can add panels, menus, status bar items)
- Hooks system for lifecycle automation (pre/post build, deploy, commit, test)
- Workflow recipes (shareable multi-step automations)
- Browser automation for testing (Playwright/Puppeteer integration)
- Design View / visual editing (live preview with click-to-select components)
- Figma-to-code integration (import Figma designs as component scaffolds)
- Credit-based usage metering (track and limit API spend per user/project)
- Share/import/export packs

### Tier 7 — AI/Model Lab (Optional)

The IDE becomes a model workbench.

- Model catalog (browse HuggingFace, local models)
- Quantized model launcher (GGUF management)
- GGUF profile manager (configure quantization levels)
- Inference endpoint presets (save and switch configs)
- Fine-tune job launcher (LoRA/QLoRA, local or cloud)
- Dataset builder (curate training data from project code)
- Eval bench (benchmark model coding performance)
- Training monitor (loss curves, GPU utilization, checkpoints)
- Hardware profiling (VRAM usage, throughput, latency)

---

## Module Map

| Module            | Tier | Responsibility                                                              |
| ----------------- | ---- | --------------------------------------------------------------------------- |
| Shell Module      | 0    | Windows, layout, docks, panes                                               |
| Workspace Module  | 1    | Projects, files, sessions, onboarding                                       |
| Editor Module     | 1    | Monaco, tabs, symbols, diagnostics, diff viewer                             |
| Terminal Module   | 1    | xterm.js, shells, runners                                                   |
| Preview Module    | 1    | Embedded webview / WebContainers, app launch surface                        |
| AI Gateway Module | 2    | Provider abstraction, streaming, auth, model routing, health checks         |
| Context Module    | 3    | Indexing, retrieval, summaries, memory, semantic search, codemaps           |
| Agent Module      | 4    | Tasks, tools, approvals, loop control, background agents                    |
| Automation Module | 4.5  | Shadow verifier, model router, cost governor, eval engine, failure recovery |
| Remote Module     | 5    | SSH/SFTP/tunnels/deploy, docker                                             |
| Skill Module      | 6    | Install/create/manage skills, hooks, workflow recipes                       |
| MCP Module        | 6    | External tool servers, ACP support, capabilities                            |
| Git Module        | 5    | Branching, commits, diffs, PR actions, worktrees                            |
| Model Lab Module  | 7    | Local models, fine-tunes, evaluations                                       |
| Security Module   | 0    | Permissions, trust, sandbox policy, audit logs                              |

---

## UX Layout

```
+----------+----------------------------+------------------+
|          |                            |                  |
| Left     |       Center               |   Right Rail     |
| Rail     |       Monaco Editor        |   Chat           |
|          |       + Tabs               |   Agents         |
| Workspace|                            |   Diffs          |
| Search   |                            |   Memory         |
| Git      |                            |   Tool Calls     |
| Remote   |                            |                  |
| Skills   |                            |                  |
| Models   |                            |                  |
|          |                            |                  |
+----------+----------------------------+------------------+
|                                                          |
|  Bottom Bar                                              |
|  Terminal | Logs | Tasks | Problems | Runner Output       |
|                                                          |
+----------------------------------------------------------+

Preview: Embedded pane or detached window (toggle)
```

---

## Tech Stack

| Component         | Technology                               |
| ----------------- | ---------------------------------------- |
| Desktop shell     | Electron                                 |
| UI framework      | React                                    |
| Code editor       | Monaco Editor                            |
| Terminal          | xterm.js                                 |
| Embedded preview  | Electron BrowserView / webview           |
| State management  | Zustand                                  |
| IPC               | Electron IPC (main <-> renderer)         |
| LLM communication | OpenAI-compatible HTTP client            |
| Styling           | Tailwind CSS + CSS variables for theming |
| Build tooling     | Vite + electron-builder                  |
| Package manager   | pnpm                                     |

---

## Build Phases

### Phase 1 — MVP

Build: **Tier 0 + Tier 1 + light Tier 2**

Delivers:

- Desktop shell with layout system
- Editor, file tree, terminal, preview
- Global search (file + content)
- Diagnostics panel
- Onboarding flow (first-run wizard)
- Chat panel + inline completions + @-mentions
- Provider settings (connect any OpenAI-compatible endpoint)
- Theme switching
- Smart project detection and launch
- Status bar with active mode and provider health
- Diff viewer

### Phase 2 — Intelligence + Agents

Add: **Tier 3 + controlled parts of Tier 4**

Delivers:

- Repo-aware AI (RAG over codebase)
- Semantic code search via embeddings
- Persistent memory across sessions
- Multi-file edits with diff preview
- Test/fix loops with approval gates
- Provider fallback chains with health checks
- Token tracking for cost governance
- Notepads / reusable context bundles
- AI Codemaps (visual codebase maps)
- Checkpoint/rewind system

### Phase 2.5 — Automation Fabric

Add: **Tier 4.5**

Delivers:

- Shadow verifier for output review
- Model router for dynamic task routing
- Cost governor with budget enforcement
- Eval engine for continuous quality tracking
- Failure recovery daemon with automatic rollback
- Arena mode for blind model comparison

### Phase 3 — Connectivity + Ecosystem

Add: **Tier 5 + Tier 6**

Delivers:

- SSH/VPS/Cloudflare workflows
- Git integration + worktrees for parallel agents
- Deploy connectors
- Skills, MCP integration, ACP support, plugin ecosystem
- Hooks system for lifecycle automation
- Browser automation for testing
- Background agents in isolated environments
- Issue-to-PR autonomous flow
- Scheduled/recurring tasks

### Phase 4 — Model Lab + Advanced

Add: **Tier 7** (optional) + advanced features

Delivers:

- Model and training lab features
- GGUF management, fine-tuning, benchmarks
- Design View / visual editing
- Figma-to-code integration
- Credit-based usage metering

---

## Hard Rules

1. Keep the core IDE usable even if AI is disabled
2. Keep every major feature behind a module boundary
3. Use a capability permission system for agents and skills
4. Require diff previews and approval modes
5. Treat remote actions as high-trust operations
6. Never mix provider logic directly into UI components
7. Keep model backends adapter-based
8. Make every tool call and file change auditable
9. Design for fallback when a provider or remote target fails
10. No module may depend on a higher-tier module

---

## Inspirations

| Project          | What we take from it                                      |
| ---------------- | --------------------------------------------------------- |
| KiloCode         | Skill presets, mode system, workflow packaging            |
| OpenHands        | Autonomous agent architecture, append-only EventStream    |
| Aider            | Git-integrated AI editing, repo map, diff-based workflows |
| LangGraph        | Multi-step agent orchestration with state, checkpointing  |
| Mem0             | Persistent memory layer across sessions                   |
| VS Code          | Monaco editor, command palette, extension model           |
| Cursor           | Chat + editor UX, @-mentions, notepads, background agents |
| Windsurf         | Cascade flow, Supercomplete (next edit suggestions)       |
| Cline            | Autonomous coding with approval gates, diff streaming     |
| Claude Code      | Hierarchical subagents, hooks, MCP extensibility          |
| Codex CLI        | Sandboxed execution, network-isolated agents              |
| GitHub Copilot   | Inline completions, agent mode, multi-model routing       |
| Devin            | Full autonomous agent, issue-to-PR, browser use           |
| Replit Agent     | In-browser preview, deployment, iterative agent           |
| bolt.new         | WebContainers, instant preview, design-to-code            |
| v0.dev / Lovable | Visual editing, component generation, design view         |
| Zed              | Collaborative editing, high-performance editor            |
| Amp              | Agentic code review, parallel agents via worktrees        |
| Augment Code     | Deep codebase understanding, semantic search              |
