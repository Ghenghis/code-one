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

| Responsibility | Description |
|---|---|
| Windowing & layout manager | Dock, split, resize, persist pane arrangement |
| Command bus | Central command dispatch and keybinding registry |
| Permissions & trust model | Capability-based access control for modules |
| Plugin/module registry | Register, load, unload, version modules |
| Event system | Pub/sub for cross-module communication |
| Settings/profile store | User preferences, per-project overrides |
| Workspace/session manager | Open projects, restore sessions, multi-workspace |
| Security module | Sandbox policy, audit logs, trust levels |

### Tier 1 — Core IDE

The usable product on day one. "It already works as an IDE."

- Monaco editor with multi-tab, syntax highlighting, minimap
- File tree with create/rename/delete/drag-drop
- Global search (file search + content search)
- Integrated terminal (xterm.js)
- Project open/create/import
- Diagnostics/problems panel
- Smart runner/launcher (auto-detect project type)
- Embedded preview for web projects (webview)
- External launch handling for desktop/CLI projects
- Theme system (dark, light, high contrast, custom)

### Tier 2 — AI Coding Layer

The assistant becomes useful without being autonomous.

- Chat panel with streaming markdown rendering
- Inline code completions from LLM
- Code actions (explain, refactor, fix, document)
- Repo context assembly (open files, selections, diagnostics)
- Multi-file patch proposals with diff preview
- Apply/reject individual changes
- Prompt presets (coding style, language, task type)
- Endpoint abstraction: Ollama, llama.cpp, LM Studio, OpenAI-compatible APIs, MiniMax, other provider backends
- API key management per provider

### Tier 3 — Intelligence Layer

Memory + understanding. The AI becomes a true pair programmer.

- Project indexing (file contents, structure)
- Embeddings / RAG over codebase
- Code symbol graph (imports, references, call hierarchy)
- Session memory (current conversation context)
- Persistent user/project memory (Mem0-style)
- Context ranking (what matters most for this query)
- Summarization and compression (stay within context limits)
- Project knowledge cards (quick reference for key architecture decisions)
- Decision history (why was X chosen over Y)
- Architecture map (visual or structured overview)

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
- Plugin SDK (third-party UI panels, commands, themes, language support)
- Tool schemas (define and register tools)
- UI contribution points (modules can add panels, menus, status bar items)
- Workflow recipes (shareable multi-step automations)
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

| Module | Responsibility |
|---|---|
| Shell Module | Windows, layout, docks, panes |
| Workspace Module | Projects, files, sessions |
| Editor Module | Monaco, tabs, symbols, diagnostics |
| Terminal Module | xterm.js, shells, runners |
| Preview Module | Embedded webview, app launch surface |
| AI Gateway Module | Provider abstraction, streaming, auth, model routing |
| Context Module | Indexing, retrieval, summaries, memory |
| Agent Module | Tasks, tools, approvals, loop control |
| Remote Module | SSH/SFTP/tunnels/deploy |
| Skill Module | Install/create/manage skills |
| MCP Module | External tool servers and capabilities |
| Git Module | Branching, commits, diffs, PR actions |
| Model Lab Module | Local models, fine-tunes, evaluations |
| Security Module | Permissions, trust, sandbox policy, audit logs |

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

| Component | Technology |
|---|---|
| Desktop shell | Electron |
| UI framework | React |
| Code editor | Monaco Editor |
| Terminal | xterm.js |
| Embedded preview | Electron BrowserView / webview |
| State management | Zustand |
| IPC | Electron IPC (main <-> renderer) |
| LLM communication | OpenAI-compatible HTTP client |
| Styling | Tailwind CSS + CSS variables for theming |
| Build tooling | Vite + electron-builder |
| Package manager | pnpm |

---

## Build Phases

### Phase 1 — MVP

Build: **Tier 0 + Tier 1 + light Tier 2**

Delivers:
- Desktop shell with layout system
- Editor, file tree, terminal, preview
- Chat panel + inline completions
- Provider settings (connect any OpenAI-compatible endpoint)
- Theme switching
- Smart project detection and launch

### Phase 2 — Intelligence + Agents

Add: **Tier 3 + controlled parts of Tier 4**

Delivers:
- Repo-aware AI (RAG over codebase)
- Persistent memory across sessions
- Multi-file edits with diff preview
- Test/fix loops with approval gates

### Phase 3 — Connectivity + Ecosystem

Add: **Tier 5 + Tier 6**

Delivers:
- SSH/VPS/Cloudflare workflows
- Git integration
- Deploy connectors
- Skills, MCP integration, plugin ecosystem

### Phase 4 — Model Lab

Add: **Tier 7** (optional)

Delivers:
- Model and training lab features
- GGUF management, fine-tuning, benchmarks

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

| Project | What we take from it |
|---|---|
| KiloCode | Skill presets and workflow packaging |
| OpenHands | Autonomous agent architecture |
| Aider | Git-integrated AI editing, diff-based workflows |
| LangGraph | Multi-step agent orchestration with state |
| Mem0 | Persistent memory layer across sessions |
| VS Code | Monaco editor, command palette, extension model |
| Cursor | Chat + editor integration UX |
