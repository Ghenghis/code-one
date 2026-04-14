# Pattern Decision Log

Tracks which patterns were adopted from which sources and why.

## Adopted Patterns

| Pattern                            | Source      | Tier | Decision | Rationale                                                            |
| ---------------------------------- | ----------- | ---- | -------- | -------------------------------------------------------------------- |
| Append-only EventStream            | OpenHands   | 4    | Adopted  | Single source of truth for agent execution, enables replay and audit |
| Action/Observation separation      | OpenHands   | 4    | Adopted  | Clean typed events with causation links                              |
| Tree-sitter + PageRank repo map    | Aider       | 3    | Adopted  | Best-proven technique for codebase-aware AI context                  |
| Multi-model strategy               | Aider       | 2    | Adopted  | Optimize cost: strong model plans, cheap model edits                 |
| SEARCH/REPLACE edit format         | Aider       | 4    | Adopted  | Reliable, fuzzy-matchable, well-tested                               |
| Graph-based task orchestration     | LangGraph   | 4    | Adopted  | Explicit control flow for complex multi-step tasks                   |
| Checkpointing + rollback           | LangGraph   | 4    | Adopted  | Resume, time-travel, fault recovery                                  |
| interrupt() for human-in-the-loop  | LangGraph   | 4    | Adopted  | Clean approval gates                                                 |
| Reducer-based state management     | LangGraph   | 4    | Adopted  | Safe concurrent state updates                                        |
| Mode-based tool permissions        | KiloCode    | 4    | Adopted  | Clean autonomy levels per workflow                                   |
| Custom modes as JSON config        | KiloCode    | 4    | Adopted  | Extensibility without code changes                                   |
| Multi-layered permission model     | Claude Code | 4    | Adopted  | Mode + per-tool + hooks = fine-grained control                       |
| Hierarchical subagents             | Claude Code | 4    | Adopted  | Parallel work with isolated context                                  |
| MCP tool extensibility             | Claude Code | 6    | Adopted  | Dynamic tool registration from external servers                      |
| SQLite session persistence         | OpenCode    | 4    | Adopted  | Lightweight, embedded, no external deps                              |
| Tool registry with typed interface | OpenCode    | 4    | Adopted  | Clean, extensible tool management                                    |

## Rejected Patterns

| Pattern                  | Source      | Reason                                               |
| ------------------------ | ----------- | ---------------------------------------------------- |
| CodeAct (code-as-action) | OpenHands   | Harder to permission-gate than structured tool calls |
| XML-style tool calls     | KiloCode    | Standard function calling from LLM API is cleaner    |
| litellm dependency       | Aider       | Building our own adapter for tighter control         |
| LangChain coupling       | LangGraph   | Standalone graph engine, no framework lock-in        |
| CLI-first architecture   | Claude Code | Desktop-first with full GUI                          |
| DelegatorAgent           | OpenHands   | Mode system + subagents cover this better            |

## Pending Research

| Topic                               | Priority | Status                      |
| ----------------------------------- | -------- | --------------------------- |
| Security sandboxing (Docker/WASM)   | High     | Not yet researched in depth |
| Agentic coding papers               | Medium   | To be gathered              |
| UI/UX patterns for agent visibility | Medium   | To be gathered              |
| Failure recovery patterns           | Medium   | To be gathered              |
| Agent evaluation methods            | Low      | To be gathered              |
