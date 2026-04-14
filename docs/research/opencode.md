# Research Note: OpenCode

**Source:** github.com/opencode-ai/opencode  
**Date reviewed:** 2026-04-14

## What pattern it proves

Clean tool registries with typed interfaces and SQLite-based session persistence provide a lightweight but effective foundation for AI coding assistants. AGENTS.md as project-level instructions is a simple, effective pattern.

## Why it matters

- Go-based tool registry with Tool interface (name, description, schema, Run method)
- SQLite for conversation/session storage — simple, embedded, no external deps
- Context compaction via summarization when context window fills
- AGENTS.md loaded as system prompt (like CLAUDE.md / .kilocoderules)
- Standard tool-use loop: send messages, check for tool calls, execute, append results, re-invoke
- Unified provider interface for multiple LLM backends

## How we adapt it

### Tool Registry (Agent Core, Tier 4)

Each tool implements a typed interface:

```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute(input: unknown): Promise<ToolResult>;
}
```

Tools registered in a central registry at startup. Agent passes tool schemas to LLM.

### Session Storage

SQLite for session persistence:

- Sessions as first-class entities with metadata
- Message threads linked to sessions
- EventStream events persisted per session
- Lightweight, embedded, no external database required

### Context Compaction (Context Engine, Tier 3)

When context exceeds budget:

- Summarize older conversation turns
- Shrink repo map to top-ranked items
- Drop low-relevance retrieved files
- Preserve most recent messages and active file context

### Project Instructions

`.hybridrules` file loaded as system prompt context.

## What we will not copy

- **Go language**: We're building in TypeScript for consistency with Electron/React
- **TUI interface**: We have a full GUI
- **Minimal permission model**: We need richer permissions (from Claude Code research)
- **No subagent support**: We add hierarchical subagents

## Risks

- SQLite can have write contention if multiple processes access it
- Context compaction via summarization can lose important details

## Validation checklist

- [ ] Tool registry loads and resolves all built-in tools
- [ ] SQLite session store persists and loads correctly
- [ ] Context compaction preserves critical information
- [ ] Provider adapter interface works with multiple backends
