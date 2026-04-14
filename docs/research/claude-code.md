# Research Note: Claude Code

**Source:** Anthropic Claude Code documentation  
**Date reviewed:** 2026-04-14

## What pattern it proves

Multi-layered permission models with programmable hooks provide the best balance between agent autonomy and safety. Hierarchical subagents with isolated contexts enable parallel work without context pollution.

## Why it matters

- Permission modes: default (ask everything), acceptEdits (auto files), auto (full autonomy)
- Per-tool allow/deny rules at user, project, and managed-policy scopes
- Hooks intercept tool calls at PreToolUse/PermissionRequest with allow/deny/ask/defer
- Subagents spawn with isolated context, own tool subset, report back via events
- MCP servers register tools dynamically at runtime
- CLAUDE.md provides persistent project-level instructions
- Session resumability with JSONL transcript persistence

## How we adapt it

### Permission Model (Agent Core, Tier 4)
Three-layer system:
1. **Mode permissions**: Which tools exist for this mode
2. **Auto-approve rules**: Per-tool in settings (user + project scope)
3. **Hooks**: Programmable PreToolUse/PostToolUse/PreEdit/PreCommand handlers that return allow/deny/ask

### Subagent Architecture
- Parent spawns children via `spawn_agent` tool
- Each child has: isolated context, scoped tools, own mode, own system prompt
- Results reported back via SubagentResultEvent
- Events carry parentId for lineage tracking
- Multiple subagents can run in parallel

### MCP Integration (Tier 6)
- MCP client connects to external tool servers
- Tools registered at runtime with JSON schema
- Subject to same permission model as built-in tools

### Project Instructions
`.hybridrules` file (our equivalent of CLAUDE.md) loads as persistent context.

### Session Persistence
- Conversations persisted as structured events (not JSONL — we use our EventStream)
- Sessions resumable by ID

## What we will not copy

- **CLI-first architecture**: We're desktop-first with GUI
- **Context compaction as separate concern**: We integrate it into our Context Engine (Tier 3)
- **Single-agent loop**: We add graph-based orchestration for complex tasks

## Risks

- Hook chains can become complex if too many hooks interact
- Subagent context isolation must be strict to prevent leaks

## Validation checklist

- [ ] Three permission layers evaluate in correct order
- [ ] Hooks can intercept and allow/deny tool calls
- [ ] Subagents spawn with correct tool subset
- [ ] Subagent results propagate back to parent
- [ ] MCP tools appear in registry with permissions
