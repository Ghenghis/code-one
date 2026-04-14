# Research Note: OpenHands (formerly OpenDevin)

**Source:** github.com/All-Hands-AI/OpenHands  
**Date reviewed:** 2026-04-14

## What pattern it proves

Append-only event streams work as the single source of truth for agent execution. The Action/Observation separation creates a clean, replayable, auditable agent loop.

## Why it matters

- EventStream as append-only log enables session replay, debugging, and audit
- Action/Observation typed events with IDs, timestamps, source, and causation links create full traceability
- Docker-based sandboxed execution isolates agent-generated code from the host
- CodeAct pattern (executable code as actions) is more flexible than rigid tool schemas

## How we adapt it

### EventStream Architecture

Adopt the append-only EventStream as our agent event bus (Tier 4). Events include:

- `ToolCallEvent`, `ToolResultEvent` — tool invocation cycle
- `ApprovalRequestEvent`, `ApprovalResponseEvent` — human-in-the-loop
- `CheckpointEvent` — state snapshots for rollback
- `SubagentSpawnEvent`, `SubagentResultEvent` — hierarchical agents

### Agent Loop

Adopt the controller loop pattern: `agent.step(state)` returns an Action, runtime executes it, produces Observation, appends to EventStream, loops.

### Sandbox

Adopt isolated execution for agent-generated code. Start with process-level isolation, evolve to Docker/WASM containers.

## What we will not copy

- **CodeAct's code-as-action format**: We prefer structured tool calls (like KiloCode/Claude Code) for better permission control. Raw code execution is harder to gate.
- **DelegatorAgent**: Our mode system + subagents cover this more cleanly.
- **Heavy Docker dependency for basic operation**: Sandbox should be opt-in for local development.

## Risks

- EventStream can grow large in long sessions — need compaction/summarization
- Replay fidelity depends on deterministic tool execution

## Validation checklist

- [ ] Events append correctly and maintain ordering
- [ ] Session can be reconstructed from EventStream replay
- [ ] UI subscribes to events and updates in real-time
- [ ] Causation links are correct (observation traces back to action)
