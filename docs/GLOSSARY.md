# Glossary

Canonical definitions for terms used across Code One documentation.

---

| Term                    | Definition                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Approval Gate**       | A checkpoint where an agent action is paused until a human (or auto-approve policy) grants permission to proceed. Implemented via the PermissionEngine hook layer.               |
| **Capability**          | A named permission (e.g. `fs:write`, `shell:exec`, `git:push`) that a module must be granted before it can perform the action. Capabilities are checked by the PermissionEngine. |
| **Checkpoint**          | A snapshot of full agent/graph state saved to SQLite. Enables restore, rollback, and session replay. See ADR-0004.                                                               |
| **Command**             | A registered action in the CommandBus identified by a unique string ID. Commands are the only way user actions (keyboard shortcuts, menu items, palette entries) reach modules.  |
| **Context Compression** | The process of reducing accumulated LLM context (conversation + repo + memory) when it exceeds the model's context window. See runtime-specs.md §1.                              |
| **Cost Governor**       | The subsystem that tracks token usage and API spend, enforcing budget limits. Part of Tier 4.5. See runtime-specs.md §5.                                                         |
| **Event**               | An immutable, timestamped record in the append-only event stream. Events are the single source of truth for agent execution history.                                             |
| **Event Stream**        | The append-only log of all events in a session. Based on the OpenHands pattern. Stored in SQLite `events` table.                                                                 |
| **Fallback Chain**      | An ordered list of model profiles for a given role. When the primary provider fails, the system automatically tries the next in the chain.                                       |
| **Graph**               | A task execution structure with typed nodes and edges. Based on LangGraph patterns. Enables planner → executor → reviewer workflows.                                             |
| **Hook**                | A programmable check that runs before or after a tool call (PreToolUse / PostToolUse). Used for custom permission logic, logging, and reactive behavior.                         |
| **IPC**                 | Inter-Process Communication between Electron's main process and renderer process. All IPC channels are typed via `@code-one/shared-types`.                                       |
| **Kernel**              | The Tier 0 Platform Kernel. Contains EventBus, CommandBus, ModuleRegistry, PermissionEngine, SettingsManager, LayoutManager, and LoggerFactory.                                  |
| **Memory Scope**        | One of four isolation levels for persistent memory: `session` (current conversation), `user` (across sessions), `project` (per workspace), `global` (all workspaces).            |
| **Mode**                | A named configuration that defines which tools are available, what system prompt is used, and how autonomous the agent is. Built-in modes: Ask, Architect, Code, Debug, Agent.   |
| **Module**              | A registered unit of functionality in the ModuleRegistry. Modules have lifecycle (init → activate → deactivate → dispose), declare capabilities, and declare tier membership.    |
| **PageRank**            | The ranking algorithm used in repo maps to score file importance based on import/dependency graph centrality. Adopted from Aider's approach.                                     |
| **Provider**            | An LLM API endpoint (Anthropic, OpenAI, Ollama, etc.) configured in the provider system. Each provider has health tracking and cost metrics.                                     |
| **Repo Map**            | A structural representation of the codebase including files, symbols, and dependency edges. Built using Tree-sitter parsing and PageRank scoring.                                |
| **Reducer**             | A pure function that computes the next graph state from the current state and an update. Based on LangGraph's state management pattern.                                          |
| **Shadow Verifier**     | A Tier 4.5 component that routes agent outputs through a secondary model for review before marking tasks complete.                                                               |
| **Skill**               | A packaged bundle of instructions, tool permissions, UI panel hooks, model preferences, and memory scopes. More than a prompt — a portable workflow.                             |
| **Subagent**            | A child agent spawned by a parent agent to handle a subtask. Runs with isolated memory and restricted permissions. See runtime-specs.md §2.                                      |
| **Tier**                | One of 9 architectural layers (0-7 + 4.5). No module may depend on a higher-tier module.                                                                                         |
| **Tool**                | A registered capability that an agent can invoke (file read, shell exec, web search, etc.). Tools have schemas, risk levels, and approval requirements.                          |
| **Trust Level**         | A security classification for modules: `trusted`, `guarded`, `restricted`, `isolated`, `remote`. Higher restriction = more capabilities denied by default.                       |
| **WAL**                 | Write-Ahead Logging mode for SQLite. Enables concurrent reads while a write is in progress. Used for all Code One databases.                                                     |
