# Agent Map

Agent roles, tool access, orchestration flow, and approval points.
Last updated: 2026-04-14

## Agent Modes

```
Ask Mode          (no tools, conversation only)
Architect Mode    (read-only tools, produces plans)
Code Mode         (full tools, approval for writes)
Debug Mode        (read + terminal, approval for edits)
Agent Mode        (full autonomy with approval gates)
Custom Modes      (user-defined via .hybrid-ide/modes.json)
```

## Tool Access by Mode

| Tool | Ask | Architect | Code | Debug | Agent |
|---|---|---|---|---|---|
| read_file | - | auto | auto | auto | auto |
| write_file | - | - | approval | - | approval |
| edit_file | - | - | approval | approval | approval |
| list_files | - | auto | auto | auto | auto |
| search_content | - | auto | auto | auto | auto |
| search_files | - | auto | auto | auto | auto |
| terminal | - | - | approval | auto | approval |
| browser | - | - | approval | - | approval |
| ask_user | - | - | auto | auto | auto |
| spawn_agent | - | - | - | - | approval |
| attempt_completion | - | - | auto | auto | auto |

Legend: `auto` = auto-approved, `approval` = requires user approval, `-` = not available

## Agent Orchestration Flow

```
Research Agent
  │ Gathers papers, docs, architecture examples
  │ Tools: read_file, search_content, browser
  ▼
Architect Agent
  │ Turns research into ADRs and contracts
  │ Tools: read_file, search_content, list_files
  ▼
Implementation Agent
  │ Writes code on feature branches
  │ Tools: all Code mode tools
  ▼
Review Agent
  │ Checks correctness, boundaries, test coverage
  │ Tools: read_file, search_content, terminal (tests)
  ▼
Verification Agent
  │ Runs app, tests, and scenario proof
  │ Tools: terminal, browser, read_file
  ▼
Release Agent
  │ Prepares changelog, version bump, release notes
  │ Tools: read_file, edit_file, terminal (git)
```

## Approval Gates

| Action | Trust Level | Gate |
|---|---|---|
| Read file | Trusted | None |
| Search code | Trusted | None |
| Write/edit file | Guarded | User approval (diff preview) |
| Run terminal command | Restricted | User approval (command preview) |
| Spawn subagent | Restricted | User approval |
| SSH/remote action | Remote | Always require approval |
| Deploy action | Remote | Always require approval |
| Delete file | Guarded | User approval (confirmation) |

## Subagent Architecture

```
Parent Agent (Agent Mode)
  ├── Spawn: Research Subagent
  │     ├── Isolated context
  │     ├── Tools: read_file, search, browser
  │     └── Reports back: SubagentResultEvent
  ├── Spawn: Implementation Subagent
  │     ├── Isolated context
  │     ├── Tools: read, write, edit, terminal
  │     └── Reports back: SubagentResultEvent
  └── Synthesize results and continue

Events carry parentId for lineage tracking.
Multiple subagents can run in parallel.
```

## Event Flow

```
UserMessageEvent
  → AgentRunner processes
  → ToolCallEvent (if tool needed)
  → ApprovalRequestEvent (if gated)
  → ApprovalResponseEvent (user decides)
  → ToolResultEvent (execution result)
  → CheckpointEvent (state saved)
  → AssistantMessageEvent (response to user)
```

## Memory Scopes

| Scope | Lifetime | Access |
|---|---|---|
| Turn memory | Single LLM call | Agent loop only |
| Session memory | Current conversation | Current session |
| Project memory | Per workspace | All sessions in workspace |
| User memory | Cross-workspace | All workspaces for this user |
