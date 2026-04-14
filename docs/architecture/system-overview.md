# System Overview

## Product

Desktop-first modular AI development platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Desktop Shell                    │
├──────────┬────────────────────────────┬─────────────────────┤
│ Left     │ Center                     │ Right               │
│ Rail     │ Monaco Editor + Tabs       │ Chat / Agents       │
│          │                            │ Diffs / Memory      │
│ Files    │                            │ Tool Calls          │
│ Search   │                            │                     │
│ Git      │                            │                     │
│ Remote   │                            │                     │
│ Skills   │                            │                     │
├──────────┴────────────────────────────┴─────────────────────┤
│ Bottom: Terminal | Logs | Tasks | Problems | Runner Output   │
└─────────────────────────────────────────────────────────────┘
```

## Tier Stack

| Tier | Name              | Package(s)                               |
| ---- | ----------------- | ---------------------------------------- |
| 0    | Platform Kernel   | kernel, shared-types                     |
| 1    | Core IDE          | editor, workspace, terminal, preview, ui |
| 2    | AI Coding         | ai-gateway                               |
| 3    | Intelligence      | context-engine                           |
| 4    | Agent System      | agent-core, task-graph                   |
| 4.5  | Automation Fabric | (within agent-core + ai-gateway)         |
| 5    | Remote/DevOps     | remote, git-tools                        |
| 6    | Ecosystem         | skills, mcp                              |
| 7    | Model Lab         | model-lab                                |

## Process Architecture

- **Main process** (Node.js): Kernel, file system, terminal PTY, AI gateway HTTP, SQLite
- **Renderer process** (Chromium): React UI, Monaco, xterm.js, chat panel
- **IPC bridge**: Typed messages between main and renderer
- **Agent runner**: Optional separate process for long-running agent tasks

## Key Constraints

- No higher-tier module may be imported by a lower-tier module
- All cross-module communication goes through the kernel's command/event bus
- All provider logic is adapter-based behind a unified interface
- Every tool call and file change is auditable via the event stream
