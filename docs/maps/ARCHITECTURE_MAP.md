# Architecture Map

System-level view of how everything fits together.
Last updated: 2026-04-14

## Layer Structure

```
Tier 7: Model Lab          (optional)
Tier 6: Skills / MCP       (extensibility)
Tier 5: Remote / DevOps    (connectivity)
Tier 4: Agent System        (autonomy)
Tier 3: Intelligence        (memory + understanding)
Tier 2: AI Coding           (chat + completions)
Tier 1: Core IDE            (editor + terminal + preview)
Tier 0: Platform Kernel     (foundation for everything)
```

## Module Responsibilities

| Module | Tier | Responsibility |
|---|---|---|
| kernel | 0 | Command bus, module registry, permissions, settings, layout |
| shared-types | 0 | Type contracts shared across all packages |
| editor | 1 | Monaco editor, tabs, syntax, minimap |
| workspace | 1 | File tree, project CRUD, sessions |
| terminal | 1 | xterm.js, shell integration |
| preview | 1 | Webview for web, external launcher for desktop/CLI |
| ui | 1 | Shared components, theme system |
| ai-gateway | 2 | Provider adapters, streaming, model routing |
| context-engine | 3 | Repo map, RAG, memory, ranking, compression |
| agent-core | 4 | Event bus, agent loop, modes, tool registry |
| task-graph | 4 | Graph orchestration, checkpoints, approval gates |
| git-tools | 5 | Git operations |
| remote | 5 | SSH, SFTP, tunnels, deploy |
| skills | 6 | Skill runtime, authoring, manifests |
| mcp | 6 | MCP client, external tool servers |
| model-lab | 7 | Model catalog, benchmarks, fine-tuning |

## Data Flow

```
User Input
  → Chat Panel (ui)
  → Agent Loop (agent-core)
  → Context Assembly (context-engine)
  → LLM Request (ai-gateway)
  → LLM Response
  → Tool Calls (agent-core → tool registry)
  → Tool Execution (workspace/terminal/git-tools/remote)
  → Tool Results → Event Bus (agent-core)
  → UI Update (ui)
  → Editor Changes (editor)
  → Preview Reload (preview)
```

## Boundaries

- **No module may depend on a higher-tier module**
- Tier 0 knows nothing about AI, editors, or terminals
- Tier 1 knows nothing about AI or agents
- Tier 2 knows nothing about agents or orchestration
- Communication crosses boundaries only via the kernel's event/command bus
- Each module registers capabilities, the kernel routes

## Desktop App Architecture

```
Electron Main Process
  ├── Kernel (command bus, module registry)
  ├── Workspace (file system operations)
  ├── Terminal (pty processes)
  ├── Preview (BrowserView management)
  └── AI Gateway (HTTP to LLM providers)

Electron Renderer Process
  ├── React App
  ├── Monaco Editor
  ├── Chat Panel
  ├── File Tree
  ├── Terminal (xterm.js)
  └── Theme System

IPC Bridge
  └── Typed messages between main and renderer
```
