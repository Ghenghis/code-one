# Hybrid IDE — Agent System Architecture Design

Date: 2026-04-14

## Overview

The agent system is a 5-layer architecture that combines the best proven patterns from KiloCode, OpenHands, Aider, LangGraph, Claude Code, and OpenCode.

---

## Source Pattern Map

| Project     | Core Pattern                    | What We Adopt                                                                                                                       |
| ----------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| OpenHands   | EventStream + Controller loop   | Append-only event log as single source of truth. Actions/Observations as typed events with IDs, timestamps, source, causation links |
| Aider       | Multi-model + polymorphic edits | Architect/Editor two-model pipeline, Tree-sitter + PageRank repo map, SEARCH/REPLACE edit blocks                                    |
| LangGraph   | Graph-based state machine       | Checkpointing + reducer-based state, conditional routing, interrupt() for human-in-the-loop                                         |
| KiloCode    | Mode-based tool permissions     | Custom modes as JSON config with tool allowlists and custom system prompts                                                          |
| Claude Code | Hierarchical subagents + hooks  | Multi-layered permissions (mode, per-tool, hooks), subagent spawning, MCP extensibility                                             |
| OpenCode    | Clean tool registry + sessions  | SQLite session persistence, project-level instructions file, context compaction                                                     |

---

## Layer 1 — Event Bus (from OpenHands)

Everything is an event on an append-only stream.

### Event Types

```typescript
interface AgentEvent {
  id: string;
  timestamp: number;
  source: "user" | "agent" | "system" | "subagent";
  parentId?: string; // causation link
  sessionId: string;
  type: string;
}

// Core events
UserMessageEvent; // user types in chat
AssistantMessageEvent; // LLM response text
ToolCallEvent; // LLM requests a tool
ToolResultEvent; // tool execution result
PlanEvent; // agent creates a plan
EditProposalEvent; // multi-file diff proposal
ApprovalRequestEvent; // agent asks for permission
ApprovalResponseEvent; // user grants/denies
CheckpointEvent; // state snapshot
SubagentSpawnEvent; // parent spawns child
SubagentResultEvent; // child reports back
ErrorEvent; // something failed
ModeChangeEvent; // agent switches mode
MemoryWriteEvent; // persistent memory update
```

### Properties

- Append-only: events are never mutated or deleted
- Replayable: session can be reconstructed from event stream
- Subscribable: UI and modules subscribe to event types
- Persisted: stored in SQLite per workspace

---

## Layer 2 — Agent Loop

The core execution loop, universal across all modes.

```
1. Assemble context
   ├── System prompt (mode-specific)
   ├── Project rules (.hybridrules)
   ├── Repo map (Tree-sitter + PageRank)
   ├── Active files (open in editor)
   ├── Relevant files (RAG retrieval)
   ├── Session memory (conversation)
   ├── Persistent memory (cross-session)
   ├── Diagnostics (errors/warnings)
   └── Compress if over budget

2. Send to LLM via provider adapter

3. Parse response
   ├── Text only → emit AssistantMessageEvent, done
   ├── Tool calls → check permissions
   │   ├── Allowed → execute, emit ToolCallEvent + ToolResultEvent
   │   ├── Needs approval → emit ApprovalRequestEvent, pause
   │   └── Denied → tell LLM tool was denied
   └── Edit proposal → emit EditProposalEvent, show diff

4. Append all events to EventStream

5. If tool was called → loop back to step 1
   If done → emit completion event
```

### Multi-Model Routing (from Aider)

- **Primary model**: Main conversation, planning, complex reasoning
- **Editor model**: Generates edit blocks from architect plans (cheaper/faster)
- **Utility model**: Commit messages, summaries, embeddings (cheapest)
- **Vision/Browser model**: Screenshot analysis, UI validation

Each model role can be assigned to any provider. Roles are logical, providers are physical.

### Provider Fallback Chain

Every model role has an ordered fallback chain. If the primary provider fails (rate limit, outage, timeout), the system automatically tries the next provider in the chain without interrupting the agent loop.

```typescript
interface ProviderConfig {
  role: "primary" | "editor" | "utility" | "vision";
  chain: ProviderEntry[]; // ordered fallback list
  maxRetries: number; // per-provider retry count
  timeoutMs: number; // per-request timeout
  healthCheckIntervalMs: number; // periodic health probe
}

interface ProviderEntry {
  id: string; // e.g. "anthropic-opus", "minimax-01"
  type: "anthropic" | "openai" | "minimax" | "ollama" | "lmstudio" | "llamacpp" | "custom";
  endpoint: string; // base URL
  apiKey?: string; // stored encrypted in settings
  model: string; // model ID at this provider
  priority: number; // lower = preferred
  maxTokens?: number;
  costPerMillionTokens?: number; // for cost governor
}
```

Example fallback chain for the primary role:

```json
{
  "role": "primary",
  "chain": [
    { "id": "anthropic-opus", "type": "anthropic", "model": "claude-opus-4-6", "priority": 1 },
    {
      "id": "minimax-01",
      "type": "openai",
      "endpoint": "https://api.minimax.chat/v1",
      "model": "MiniMax-M1",
      "priority": 2
    },
    { "id": "openai-gpt4", "type": "openai", "model": "gpt-4o", "priority": 3 },
    {
      "id": "local-llama",
      "type": "ollama",
      "endpoint": "http://localhost:11434",
      "model": "DMax-Coder-16B:Q5_K_M",
      "priority": 4
    }
  ]
}
```

Fallback behavior:

- On 429 (rate limit): wait and retry, then fall to next provider
- On 5xx (server error): immediately fall to next provider
- On timeout: fall to next provider
- On auth failure (401/403): skip provider, mark unhealthy, alert user
- Health checks run periodically to re-enable recovered providers
- All provider switches are logged as events for auditability
- User can pin a specific provider to override fallback

### Seamless Provider Switching

The AI Gateway abstracts all providers behind a single interface:

```typescript
interface LLMProvider {
  id: string;
  type: string;
  chat(request: ChatRequest): AsyncIterable<ChatChunk>;
  complete(request: CompletionRequest): AsyncIterable<string>;
  healthCheck(): Promise<boolean>;
}
```

All providers implement this interface. The gateway handles:

- Streaming normalization (all providers emit the same chunk format)
- Auth header injection (Bearer token, API key, custom headers)
- Request/response mapping (Anthropic messages API vs OpenAI chat API vs custom)
- Token counting per provider (for cost governor)

Supported providers:

- **Anthropic** (Claude Opus, Sonnet, Haiku) — native messages API
- **OpenAI / OpenAI-compatible** (GPT-4o, o3, any compatible endpoint) — chat completions API
- **MiniMax** (MiniMax-M1, Text-01) — OpenAI-compatible
- **Google** (Gemini) — OpenAI-compatible or native
- **Ollama** — local models, OpenAI-compatible API
- **LM Studio** — local models, OpenAI-compatible API
- **llama.cpp server** — local models, OpenAI-compatible API
- **Custom** — any endpoint implementing OpenAI chat completions format

Each mode can specify which model role to use.

---

## Layer 3 — Mode System (from KiloCode + Claude Code)

Modes define what the agent can do and how it behaves.

### Built-in Modes

```json
[
  {
    "slug": "ask",
    "name": "Ask",
    "tools": [],
    "autoApprove": [],
    "systemPrompt": "Answer questions about the codebase. Do not modify files.",
    "model": "primary"
  },
  {
    "slug": "architect",
    "name": "Architect",
    "tools": ["read_file", "search_content", "search_files", "list_files"],
    "autoApprove": ["read_file", "search_content", "search_files", "list_files"],
    "systemPrompt": "Analyze code and produce plans. Do not edit files directly.",
    "model": "primary",
    "editorModel": "editor"
  },
  {
    "slug": "code",
    "name": "Code",
    "tools": [
      "read_file",
      "write_file",
      "edit_file",
      "search_content",
      "search_files",
      "list_files",
      "terminal",
      "browser"
    ],
    "autoApprove": ["read_file", "search_content", "search_files", "list_files"],
    "requireApproval": ["write_file", "edit_file", "terminal"],
    "systemPrompt": "You are a coding assistant with full read/write access.",
    "model": "primary"
  },
  {
    "slug": "debug",
    "name": "Debug",
    "tools": ["read_file", "search_content", "search_files", "list_files", "terminal", "edit_file"],
    "autoApprove": ["read_file", "search_content", "search_files", "list_files", "terminal"],
    "requireApproval": ["edit_file"],
    "systemPrompt": "Diagnose and fix bugs. Run tests, read errors, trace issues.",
    "model": "primary"
  },
  {
    "slug": "agent",
    "name": "Agent",
    "tools": [
      "read_file",
      "write_file",
      "edit_file",
      "search_content",
      "search_files",
      "list_files",
      "terminal",
      "browser",
      "spawn_agent"
    ],
    "autoApprove": ["read_file", "search_content", "search_files", "list_files"],
    "requireApproval": ["write_file", "edit_file", "terminal", "spawn_agent"],
    "systemPrompt": "You are an autonomous coding agent. Plan, execute, and verify.",
    "model": "primary",
    "maxIterations": 50,
    "enableTaskGraph": true
  }
]
```

### Custom Modes

Users define custom modes in `.hybrid-ide/modes.json`:

```json
{
  "slug": "reviewer",
  "name": "Code Reviewer",
  "tools": ["read_file", "search_content", "list_files"],
  "autoApprove": ["read_file", "search_content", "list_files"],
  "systemPrompt": "Review code for quality, security, and correctness. Report findings but do not edit."
}
```

---

## Layer 4 — Task Graph Orchestration (from LangGraph)

For complex multi-step work, the agent enters graph execution mode.

### Graph Nodes

- **PlannerNode**: Reads request + repo map + memory, outputs task plan
- **ExecutorNode**: Runs agent loop per task, scoped tools
- **ReviewerNode**: Validates executor output against plan
- **CheckpointNode**: Saves full state snapshot
- **ApprovalGateNode**: Pauses for human approval, shows diff

### State Management

Reducer-based state updates (from LangGraph):

- Messages: accumulate via append
- File changes: accumulate via patch
- Plan status: update via replace

### Checkpointing

- State snapshot after every node execution
- Stored in SQLite with session_id + step_number
- Enables: rollback to any step, resume from interruption, time-travel debugging
- `get_state_history()` API for inspection

### Human-in-the-Loop

- `interrupt_before` / `interrupt_after` on specific nodes
- Execution pauses, state checkpointed, control returns to UI
- User can inspect state, modify, approve/reject
- Resume continues from checkpoint

---

## Layer 5 — Context Engine (from Aider + Mem0)

### Context Assembly Pipeline

```
1. System Prompt (mode-specific)
2. Project Rules (.hybridrules file)
3. Repo Map (Tree-sitter + PageRank)
   └── Ranked file/symbol signatures, not full files
4. Active Files (open in editor)
5. Relevant Files (RAG retrieval from embeddings)
6. Session Memory (conversation so far)
7. Persistent Memory (cross-session, Mem0-style)
8. Diagnostics (current errors/warnings)
9. Compression
   └── When over budget: summarize older turns,
       shrink repo map, drop low-rank context
```

### Repo Map (from Aider)

- Tree-sitter parses all files, extracts symbol tags
- Builds dependency graph of definitions and references
- PageRank ranks files/symbols by relevance to current context
- Produces condensed listing of ranked files with key signatures
- Dynamically sized to fit token budget

### Memory (from Mem0 + OpenCode)

- **Session memory**: Current conversation, stored per workspace
- **Persistent memory**: Cross-session facts, preferences, decisions
- **Project memory**: Architecture decisions, patterns, conventions
- Scoped access: modes can restrict which memory is visible

---

## Tool Registry

### Built-in Tools

| Tool               | Trust Level | Description                  |
| ------------------ | ----------- | ---------------------------- |
| read_file          | Trusted     | Read file contents           |
| write_file         | Guarded     | Write entire file            |
| edit_file          | Guarded     | SEARCH/REPLACE edit blocks   |
| list_files         | Trusted     | Directory listing            |
| search_content     | Trusted     | Ripgrep-style content search |
| search_files       | Trusted     | Glob pattern file search     |
| terminal           | Restricted  | Execute shell commands       |
| browser            | Restricted  | Embedded browser actions     |
| ask_user           | Trusted     | Request human input          |
| spawn_agent        | Restricted  | Create subagent              |
| attempt_completion | Trusted     | Signal task is done          |

### MCP Tools (Dynamic)

- Loaded from configured MCP servers at runtime
- Registered with JSON schema
- Subject to same permission model as built-in tools

### Plugin Tools (Tier 6)

- Registered via Plugin SDK
- Custom UI contribution points
- Sandboxed execution

---

## Permission Model

Three layers, evaluated in order:

### Layer 1: Mode Permissions

Mode defines which tools are available. Tools not in the mode's list cannot be called.

### Layer 2: Auto-Approve Rules

Per-tool configuration:

- `autoApprove`: execute without asking
- `requireApproval`: always ask user
- Configurable per-project and per-user in settings

### Layer 3: Hooks (Programmable)

```typescript
interface ToolHook {
  event: "PreToolUse" | "PostToolUse" | "PreEdit" | "PreCommand";
  handler: (context: HookContext) => "allow" | "deny" | "ask";
}
```

- PreToolUse: inspect tool call, return allow/deny/ask
- PostToolUse: audit, log, react to results
- PreEdit: validate proposed file changes
- PreCommand: validate shell commands against blocklist

---

## Sandbox / Trust Levels

| Trust Level | Scope            | Examples                                         |
| ----------- | ---------------- | ------------------------------------------------ |
| Trusted     | Read-only ops    | read_file, search, list_files                    |
| Guarded     | Local mutations  | write_file, edit_file                            |
| Restricted  | System access    | terminal, process spawn                          |
| Isolated    | Untrusted code   | Agent-generated code in Docker/WASM              |
| Remote      | External systems | SSH, deploy, API calls — always require approval |

---

## Edit Format System (from Aider)

Polymorphic edit handling:

- **SearchReplace**: SEARCH/REPLACE blocks with fuzzy matching (default)
- **WholeFile**: Full file replacement for new files or complete rewrites
- **UnifiedDiff**: Standard unified diff format
- **Patch**: Multi-file patch proposals with diff preview

The edit engine is modular — strategies coexist and are selected based on model capability and task type.

---

## Subagent Architecture (from Claude Code)

- Parent agent spawns child agents via `spawn_agent` tool
- Each subagent has:
  - Isolated context (own conversation history)
  - Scoped tool access (subset of parent's tools)
  - Own mode and system prompt
  - Result reported back to parent via SubagentResultEvent
- Events carry `parentId` for lineage tracking
- Parent can spawn multiple subagents in parallel
