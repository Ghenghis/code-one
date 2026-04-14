# Research Note: LangGraph

**Source:** github.com/langchain-ai/langgraph  
**Date reviewed:** 2026-04-14

## What pattern it proves

Graph-based state machines with checkpointing enable complex multi-step agent workflows that are resumable, debuggable, and support human-in-the-loop approval gates.

## Why it matters

- Directed graph topology gives explicit control flow (vs. implicit chaining)
- Reducer-based state management prevents race conditions in parallel execution
- Checkpointing after every node enables rollback, resume, and time-travel debugging
- `interrupt_before`/`interrupt_after` provides clean human-in-the-loop patterns
- ReAct loop (agent node -> tools node -> loop) is the canonical agentic pattern

## How we adapt it

### Task Graph (Tier 4)
Implement graph-based orchestration for complex multi-step tasks:

**Nodes:**
- PlannerNode: reads request + context, outputs task plan
- ExecutorNode: runs agent loop per task step
- ReviewerNode: validates output against plan
- CheckpointNode: saves full state snapshot
- ApprovalGateNode: pauses for human decision

**State Management:**
- Define state as typed objects with reducer functions
- Messages accumulate via append reducer
- File changes accumulate via patch reducer
- Plan status updates via replace reducer
- Each node returns partial state updates, merged by reducers

**Checkpointing:**
- Serialize full state after every node execution
- Store in SQLite with session_id + step_number
- `get_state_history()` for inspection and replay

**Human-in-the-Loop:**
- `interrupt()` on specific nodes pauses execution
- State is checkpointed, control returns to UI
- User inspects, optionally modifies, approves/rejects
- Resume continues from checkpoint

### ReAct Loop
Simple chat flows use the basic agent loop (Layer 2). Graph mode activates only for multi-step tasks — preventing complexity leak.

## What we will not copy

- **Python-specific reducer annotations**: We implement reducers in TypeScript
- **LangChain coupling**: Our graph engine is standalone, no LangChain dependency
- **Arbitrary graph complexity for simple tasks**: Graph mode is opt-in for Agent mode only

## Risks

- Graph state serialization can be expensive for large states
- Conditional routing logic can become hard to debug if overused
- Need clear boundary between "simple chat" and "graph execution"

## Validation checklist

- [ ] Task graph executes nodes in correct order
- [ ] State reducers merge correctly for messages, patches, status
- [ ] Checkpoint saves and restores produce identical state
- [ ] Interrupt/resume cycle works with user approval
- [ ] Rollback to earlier checkpoint restores correct state
