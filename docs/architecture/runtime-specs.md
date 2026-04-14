# Runtime Specifications

> Concrete behavioral specs for systems that the design docs reference but don't fully define.

---

## 1. Context Compression

### Problem

LLM context windows are finite. When accumulated context (conversation + repo context + memory) exceeds the model's limit, the system must compress without losing critical information.

### Strategy: Hierarchical summarization

**Trigger**: When assembled context exceeds 80% of the active model's context window.

**Algorithm**:

1. **Partition** context into priority bands:
   - P0 (never compress): system prompt, active mode instructions, current user message
   - P1 (compress last): current file contents, recent tool results, active diagnostics
   - P2 (compress first): older conversation turns, background repo context, memory entries
2. **Summarize** P2 content using the `utility` model role (cheapest available model):
   - Group consecutive conversation turns into summaries
   - Replace full file contents with symbol signatures + key sections
   - Collapse memory entries into bullet-point summaries
3. **Measure** resulting token count. If still over budget, summarize P1 using the same strategy.
4. **Never** compress P0. If P0 alone exceeds the context window, return an error to the user.

**Compression target**: Reduce token count by ≥40% while retaining all referenced symbols, file paths, and decision points.

**Model used**: The `utility` role from the active fallback chain. If no utility model is available, use the cheapest available chat model.

**Validation**: After compression, verify that all file paths and symbol names referenced in the current task are still present in the compressed context.

---

## 2. Subagent Isolation Rules

### Problem

Subagents execute tasks on behalf of a parent agent. Without isolation rules, subagents could access parent memory, spawn unbounded children, or escalate permissions.

### Rules

| Rule                         | Specification                                                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Memory access**            | Subagent gets a fresh `session` scope. Cannot read parent's session memory. Can read `project` and `global` scopes (read-only). Cannot read other subagents' session scopes. |
| **Memory write**             | Subagent can write to its own session scope only. Writes to `project` or `global` require explicit parent delegation (via `delegateMemoryWrite` in spawn config).            |
| **Spawning children**        | Subagents may spawn one level of children (grandchildren). Max depth = 2. Grandchildren cannot spawn further. Enforced by kernel.                                            |
| **Max concurrent subagents** | 5 per parent agent. Configurable via settings (`agent.maxConcurrentSubagents`).                                                                                              |
| **Permission inheritance**   | Subagent inherits the parent's mode and tool permissions by default. Parent can restrict further (never expand) via spawn config.                                            |
| **Context**                  | Subagent receives an explicit context payload from parent (not the full parent context). Parent decides what to share.                                                       |
| **Lifetime**                 | Subagent is terminated when: (a) it completes, (b) parent is terminated, (c) timeout expires (default 5 minutes, configurable).                                              |
| **Resource limits**          | Subagent has its own cost budget (subset of parent's remaining budget). Token usage counts against parent's session total.                                                   |
| **Event stream**             | Subagent has its own event stream, linked to parent's stream via `parentId` on the spawn event. Parent can observe subagent events.                                          |

### Spawn contract

```typescript
interface SubagentSpawnConfig {
  task: string;
  context: Record<string, unknown>;
  mode?: ModeId; // default: inherit parent
  toolRestrictions?: ToolPermissionSet; // default: inherit parent
  delegateMemoryWrite?: MemoryScope[]; // default: [] (none)
  timeoutMs?: number; // default: 300_000 (5 min)
  budgetUsd?: number; // default: 10% of parent remaining
}
```

---

## 3. SQLite Session Persistence

### Schema

See ADR-0004 for rationale. Below is the concrete schema.

```sql
-- Enable WAL mode for concurrent reads
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;

-- Schema versioning
CREATE TABLE IF NOT EXISTS migrations (
  version   INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  status      TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  metadata    TEXT -- JSON
);

-- Append-only event stream
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id),
  parent_id   TEXT,
  type        TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('user', 'agent', 'system', 'subagent')),
  payload     TEXT NOT NULL, -- JSON
  timestamp   INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES events(id)
);
CREATE INDEX idx_events_session ON events(session_id, timestamp);
CREATE INDEX idx_events_type ON events(type);

-- Agent checkpoints
CREATE TABLE IF NOT EXISTS checkpoints (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id),
  graph_id    TEXT,
  state       TEXT NOT NULL, -- JSON (full GraphState)
  label       TEXT,
  trigger     TEXT NOT NULL CHECK (trigger IN ('auto', 'user', 'interrupt')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_checkpoints_session ON checkpoints(session_id, created_at);

-- Memory store
CREATE TABLE IF NOT EXISTS memory (
  id          TEXT PRIMARY KEY,
  scope       TEXT NOT NULL CHECK (scope IN ('session', 'user', 'project', 'global')),
  namespace   TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL, -- JSON
  embedding   BLOB,          -- float32 array for vector search
  source      TEXT NOT NULL CHECK (source IN ('user', 'agent', 'system')),
  ttl_seconds INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scope, namespace, key)
);
CREATE INDEX idx_memory_scope ON memory(scope, namespace);

-- Cost tracking
CREATE TABLE IF NOT EXISTS cost_records (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id),
  provider_id   TEXT NOT NULL,
  model_id      TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_read    INTEGER NOT NULL DEFAULT 0,
  cache_write   INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL NOT NULL,
  timestamp     INTEGER NOT NULL
);
CREATE INDEX idx_cost_session ON cost_records(session_id);
CREATE INDEX idx_cost_provider ON cost_records(provider_id, timestamp);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  session_id  TEXT,
  actor       TEXT NOT NULL, -- 'user', 'agent:<id>', 'system'
  action      TEXT NOT NULL,
  target      TEXT,          -- file path, tool id, etc.
  detail      TEXT,          -- JSON
  risk_level  TEXT CHECK (risk_level IN ('safe', 'low', 'medium', 'high', 'critical')),
  timestamp   INTEGER NOT NULL
);
CREATE INDEX idx_audit_session ON audit_log(session_id, timestamp);
CREATE INDEX idx_audit_action ON audit_log(action);
```

### Retention policy

| Table          | Default retention          | Compaction strategy                                     |
| -------------- | -------------------------- | ------------------------------------------------------- |
| `events`       | 90 days                    | Delete events older than retention; keep summary events |
| `sessions`     | Indefinite (metadata only) | Purge event data per retention, keep session row        |
| `checkpoints`  | Last 10 per session        | Auto-prune oldest when limit exceeded                   |
| `memory`       | Per TTL (0 = permanent)    | Periodic sweep of expired entries                       |
| `cost_records` | 30 days detailed           | Aggregate into daily summaries, drop per-request rows   |
| `audit_log`    | Indefinite                 | No automatic deletion                                   |

### Concurrency

- WAL mode enabled at connection open
- `busy_timeout=5000` prevents immediate SQLITE_BUSY errors
- Write operations use explicit `BEGIN IMMEDIATE` transactions
- Bulk inserts (event batches) use prepared statements in a single transaction
- Read operations are lock-free under WAL mode

---

## 4. Permission Hook Conflict Resolution

### Problem

Multiple permission hooks may return conflicting decisions for the same capability check. The system needs a deterministic evaluation order.

### Resolution strategy: Most restrictive wins

**Evaluation order**:

1. **Policy layer** (explicit grants) — checked first. If an explicit `deny` exists, short-circuit to denied.
2. **Trust level layer** — if no explicit policy, use trust-level defaults.
3. **Hook layer** — all registered hooks execute in registration order.

**Hook conflict resolution**:

- Hooks return `allow`, `deny`, or `abstain`.
- If **any** hook returns `deny`, the final result is `deny` (most restrictive wins).
- If **all** hooks return `allow` (and none deny), the final result is `allow`.
- If **all** hooks return `abstain`, fall through to the policy/trust-level result.
- Hooks that throw are treated as `abstain` (logged as warning, not as deny).

**Hook execution**:

- Hooks execute sequentially in registration order (deterministic).
- A hook may not override a prior hook's `deny` — deny is final.
- Maximum 10 hooks per capability check (prevent runaway chains).
- Hook timeout: 1000ms per hook. Timeout = `abstain` + warning log.

**Audit**: Every permission check is logged with the full decision chain (which layer decided, which hooks ran, what each returned).

---

## 5. Cost Governor Behavior

### Problem

When token spend or API costs exceed configured budgets, the system needs a defined behavior — not just "enforces limits."

### Budget levels

| Level       | Scope              | Default  | Configurable               |
| ----------- | ------------------ | -------- | -------------------------- |
| Per-request | Single LLM call    | No limit | Via `maxTokens` on request |
| Per-session | One agent session  | $5.00    | `budget.sessionLimitUsd`   |
| Per-day     | Rolling 24h window | $50.00   | `budget.dailyLimitUsd`     |
| Per-month   | Calendar month     | $500.00  | `budget.monthlyLimitUsd`   |

### Enforcement behavior (`onExceeded` strategies)

**`warn` (default for per-session)**:

- Log a warning event to the event stream
- Show a non-blocking notification in the UI with current spend
- Allow the request to proceed
- Warn again at 110%, 125%, 150% of limit

**`downgrade-model` (default for per-day)**:

- Switch to the next cheaper model in the active fallback chain
- If already on the cheapest model, switch to `warn` behavior
- Log the model switch as an event
- Resume normal model selection when spend drops below 80% of limit (new billing period or session)

**`block` (default for per-month)**:

- Reject the request with a `BudgetExceeded` error
- Show a blocking modal in the UI explaining the limit
- Provide options: increase limit, switch to local model, wait for reset
- Agent tasks are paused (not killed) — resume when budget is available

### Cost calculation

- Costs computed using the `ModelProfile.inputCostPer1M` and `outputCostPer1M` fields
- Local models (Ollama, llama.cpp, LM Studio) have cost = $0.00
- Costs are recorded per-request in the `cost_records` table
- Running totals are cached in memory and reconciled with database on session start

### UI integration

- Status bar shows current session spend
- Provider health dashboard shows per-provider cost breakdown
- Budget alerts are non-blocking notifications (warn) or blocking modals (block)
