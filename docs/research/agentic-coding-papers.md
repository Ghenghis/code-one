# Research Note: Agentic Coding Papers and Patterns

**Source:** Multiple academic and industry papers  
**Date reviewed:** 2026-04-14

## What pattern it proves

The field has converged on several core patterns for autonomous coding agents: tool-augmented LLM loops, structured edit formats, retrieval-augmented generation for code, and multi-agent coordination with verification.

## Key Papers and Findings

### 1. CodeAct (Wang et al., 2024)
- **Pattern:** Use executable code as the action format instead of rigid tool schemas
- **Finding:** Python/bash actions are more expressive than JSON tool calls
- **Our adaptation:** We prefer structured tool calls for permission control but allow terminal execution as a tool

### 2. SWE-bench / SWE-agent (Yang et al., 2024)
- **Pattern:** Agent-computer interface for resolving GitHub issues
- **Finding:** Custom shell interface with search/navigate/edit commands outperforms raw terminal
- **Our adaptation:** Our tool registry provides a similar curated interface

### 3. ReAct (Yao et al., 2023)
- **Pattern:** Interleave reasoning traces with action execution
- **Finding:** Reasoning before acting significantly improves task completion
- **Our adaptation:** LangGraph-style agent node (reason) + tools node (act) cycle in our task graph

### 4. Reflexion (Shinn et al., 2023)
- **Pattern:** Self-reflection after task failure
- **Finding:** Agents that reflect on errors and retry with modified approach improve over iterations
- **Our adaptation:** Reviewer node in task graph evaluates output, can trigger retry with feedback

### 5. LATS (Zhou et al., 2024)
- **Pattern:** Language Agent Tree Search — explore multiple solution paths
- **Finding:** Tree search over action sequences finds better solutions than single-path agents
- **Our adaptation:** Branch-per-task workflow allows exploring alternatives; checkpoint/rollback supports backtracking

### 6. RAG for Code (various)
- **Pattern:** Retrieve relevant code context before generation
- **Finding:** Repo-aware context (symbols, imports, call graphs) beats naive file inclusion
- **Our adaptation:** Tree-sitter + PageRank repo map (from Aider) with embedding-based retrieval

## Patterns Adopted

| Pattern | Source | Where in Our System |
|---|---|---|
| Tool-augmented loop | CodeAct, ReAct | Agent loop (Tier 4) |
| Structured edits | SWE-agent, Aider | Edit format system (Tier 4) |
| Self-reflection | Reflexion | Reviewer node in task graph |
| Backtracking | LATS | Checkpoint/rollback (Tier 4) |
| Code retrieval | RAG papers | Context engine repo map (Tier 3) |
| Multi-agent coordination | Various | Subagent architecture (Tier 4) |
| Shadow verification | Ensemble methods | Shadow verifier (Tier 4.5) |

## Pending Research Areas

- Agent evaluation benchmarks (SWE-bench, HumanEval, MBPP) for measuring our system
- Long-horizon task decomposition strategies
- Memory-augmented agents for cross-session learning
- Cost-optimal model routing strategies

## Validation checklist

- [ ] Agent loop implements reason-then-act pattern
- [ ] Reviewer node can trigger reflection and retry
- [ ] Checkpoint system supports backtracking to earlier states
- [ ] RAG retrieval returns relevant code context
