# Dependency Map

Package/module dependencies and relationships.
Last updated: 2026-04-14

## Package Dependency Graph

```
shared-types (no dependencies — foundation)
  ↑
kernel → shared-types
  ↑
editor → kernel, shared-types
workspace → kernel, shared-types
terminal → kernel, shared-types
preview → kernel, shared-types
ui → kernel, shared-types
  ↑
ai-gateway → kernel, shared-types
  ↑
context-engine → ai-gateway, workspace, shared-types
  ↑
agent-core → context-engine, ai-gateway, kernel, shared-types
task-graph → agent-core, shared-types
  ↑
git-tools → workspace, kernel, shared-types
remote → kernel, shared-types
  ↑
skills → agent-core, kernel, shared-types
mcp → agent-core, kernel, shared-types
  ↑
model-lab → ai-gateway, kernel, shared-types
```

## Current State (Milestone 0)

All packages depend only on `@code-one/shared-types` via workspace protocol.
No runtime dependencies installed yet. Full dependency graph will be realized
as each milestone adds implementation.

## Forbidden Dependencies

These would create circular dependencies or violate tier boundaries:

- kernel must NOT depend on editor, ai-gateway, agent-core, or any higher tier
- editor must NOT depend on ai-gateway, agent-core, or any higher tier
- ai-gateway must NOT depend on agent-core, context-engine, or any higher tier
- shared-types must NOT depend on anything

## External Dependencies (Planned)

| Package        | External Dep              | Purpose                   |
| -------------- | ------------------------- | ------------------------- |
| desktop        | electron                  | Desktop shell             |
| editor         | monaco-editor             | Code editor               |
| terminal       | xterm.js, node-pty        | Terminal emulation        |
| preview        | electron BrowserView      | Web preview               |
| ui             | react, tailwindcss        | UI framework              |
| ai-gateway     | (none — raw fetch)        | HTTP to LLM providers     |
| context-engine | tree-sitter               | Code parsing for repo map |
| agent-core     | better-sqlite3            | Event/session persistence |
| remote         | ssh2                      | SSH connections           |
| mcp            | @modelcontextprotocol/sdk | MCP client                |
