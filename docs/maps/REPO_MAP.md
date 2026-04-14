# Repo Map

Ranked file list with key symbols. Auto-generated, manually refined.
Last updated: 2026-04-14

## Apps

### apps/desktop/src/index.ts
- Electron desktop shell entry point
- Status: stub (Milestone 2)

### apps/agent-runner/src/index.ts
- Standalone agent process entry point
- Status: stub (Milestone 5)

## Core Packages (Tier 0)

### packages/kernel/src/index.ts
- Platform kernel: command bus, module registry, permissions, settings, layout
- Status: stub (Milestone 1)
- Will export: `CommandBus`, `ModuleRegistry`, `PermissionEngine`, `SettingsStore`

### packages/shared-types/src/index.ts
- Typed contracts shared across all packages
- Status: stub, no types yet (Milestone 1)
- Will export: all cross-package interfaces and type definitions

## IDE Packages (Tier 1)

### packages/editor/src/index.ts
- Monaco editor integration: tabs, syntax highlighting, minimap
- Status: stub (Milestone 2)

### packages/workspace/src/index.ts
- File tree, project management, CRUD, drag-drop
- Status: stub (Milestone 2)

### packages/terminal/src/index.ts
- xterm.js terminal integration
- Status: stub (Milestone 2)

### packages/preview/src/index.ts
- Project preview: webview for web, external launch for desktop/CLI
- Status: stub (Milestone 2)

### packages/ui/src/index.ts
- Shared UI components, themes (dark, light, high contrast)
- Status: stub (Milestone 2)

## AI Packages (Tier 2)

### packages/ai-gateway/src/index.ts
- LLM provider abstraction: Ollama, LM Studio, llama.cpp, OpenAI-compatible, cloud APIs
- Status: stub (Milestone 3)
- Will export: `ProviderAdapter`, `StreamingClient`, `ModelRouter`

## Intelligence Packages (Tier 3)

### packages/context-engine/src/index.ts
- Repo map (Tree-sitter + PageRank), RAG, memory, context ranking
- Status: stub (Milestone 4)
- Will export: `RepoMapper`, `ContextAssembler`, `MemoryStore`, `Retriever`

## Agent Packages (Tier 4)

### packages/agent-core/src/index.ts
- Event bus, agent loop, modes, tool registry
- Status: stub (Milestone 5)
- Will export: `EventStream`, `AgentRunner`, `ModeManager`, `ToolRegistry`

### packages/task-graph/src/index.ts
- LangGraph-style task orchestration: planner, executor, reviewer nodes
- Status: stub (Milestone 5)
- Will export: `TaskGraph`, `PlannerNode`, `CheckpointStore`

## DevOps Packages (Tier 5)

### packages/git-tools/src/index.ts
- Git operations: branch, commit, push, PR
- Status: stub (Milestone 6)

### packages/remote/src/index.ts
- SSH, SFTP, tunnels, deploy connectors
- Status: stub (Milestone 6)

## Ecosystem Packages (Tier 6)

### packages/skills/src/index.ts
- Skill runtime, authoring, manifests
- Status: stub (Milestone 7)

### packages/mcp/src/index.ts
- MCP client manager, external tool servers
- Status: stub (Milestone 7)

## Model Lab (Tier 7)

### packages/model-lab/src/index.ts
- Model catalog, GGUF management, benchmarks, fine-tuning
- Status: stub (Milestone 8)

## Test Infrastructure

### packages/test-harness/src/index.ts
- Shared test utilities
- Status: stub

## Configuration

### package.json — Root monorepo config (pnpm workspaces, turbo scripts)
### turbo.json — Build orchestration (parallel builds, caching)
### tsconfig.base.json — Shared TypeScript config (ES2022, strict, bundler resolution)
### eslint.config.js — ESLint flat config (TypeScript rules)
### .prettierrc — Code formatting (semi, double quotes, 100 width)
