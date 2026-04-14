# ADR-0004: SQLite for Local Persistence

**Date:** 2026-04-14  
**Status:** accepted  
**Tier:** 0-4  
**Deciders:** Project lead

## Context

Multiple subsystems need local persistence: event streams (Tier 4), session history, memory store (Tier 3), settings, agent checkpoints, cost tracking, and audit logs. The persistence layer must support concurrent reads, fast writes, and structured queries without requiring a separate database server process.

## Decision

Use SQLite (via better-sqlite3 in Node.js) as the primary local persistence engine for all structured data that outlives a single session.

## Rationale

SQLite is the most deployed database engine in the world and is specifically designed for the embedded, single-user, local-first access pattern that a desktop application requires:

- Zero configuration, zero server process
- Single file per database — easy to backup, move, and inspect
- WAL mode enables concurrent reads with single-writer without blocking
- ACID transactions guarantee data integrity even on crash
- better-sqlite3 is synchronous in Node.js, avoiding callback complexity for simple queries
- JSON1 extension enables storing and querying semi-structured data
- Full-text search extension (FTS5) available for memory/search features
- Proven at scale: each SQLite database supports terabytes; our usage will be megabytes to low gigabytes

## Alternatives considered

**IndexedDB (browser-side)**

- Available in Electron renderer process
- Rejected: Async-only API adds complexity. Not accessible from main process without IPC bridging. No SQL query capability. Poor fit for structured relational data (event streams, checkpoints, audit logs).

**LevelDB / RocksDB**

- Fast key-value stores
- Rejected: No relational queries. Would require building query layer on top. No built-in full-text search. LevelDB has known issues with concurrent access.

**PostgreSQL / MySQL (embedded or local)**

- Full relational database
- Rejected: Requires running a separate server process. Massive overhead for a single-user desktop app. Distribution and auto-setup complexity.

**JSON files**

- Simplest possible persistence
- Rejected: No concurrent access safety. No querying beyond full read + filter. No transactions. Performance degrades with file size. Acceptable only for small config files (already handled by SettingsManager).

## Research sources

- [docs/research/openhands.md](../research/openhands.md) — OpenHands persists event streams; SQLite fits this append-only pattern
- [docs/research/opencode.md](../research/opencode.md) — OpenCode uses file-based session persistence; SQLite provides the same with query support
- [docs/research/langgraph.md](../research/langgraph.md) — LangGraph checkpoints need structured storage with restore-by-ID

## Consequences

### Positive

- Single dependency, no server process to manage
- Works offline, works on all platforms
- Fast reads and writes for expected data volumes
- SQL queries simplify event stream filtering, checkpoint lookup, memory search
- WAL mode handles the read-heavy, append-mostly workload well

### Negative

- Single-writer constraint means write-heavy bursts need careful batching
- Schema migrations must be managed manually (versioned migration files)
- Binary .sqlite files are not human-readable (need tooling for inspection)

### Risks

- Database corruption on unclean shutdown (mitigated by WAL mode + checkpointing)
- Schema drift between app versions (mitigated by versioned migrations with rollback)
- Large event streams may need periodic compaction (retention policy required)

## Validation

- Event stream write throughput ≥1000 events/sec sustained
- Checkpoint restore completes in <500ms for typical session
- Database file size stays under 100MB for 30 days of active use
- WAL mode verified by concurrent read/write test
- Migration system tested: upgrade and rollback across 2+ schema versions

## Schema overview

Core tables (detailed schemas defined at implementation time):

| Table          | Purpose                                | Tier |
| -------------- | -------------------------------------- | ---- |
| `events`       | Append-only event stream               | 4    |
| `sessions`     | Session metadata and lifecycle         | 0    |
| `checkpoints`  | Agent state snapshots for restore      | 4    |
| `memory`       | Persistent memory entries (Mem0-style) | 3    |
| `cost_records` | Per-request token/cost tracking        | 2    |
| `audit_log`    | Security and action audit trail        | 0    |
| `migrations`   | Schema version tracking                | 0    |

### Concurrency strategy

- WAL mode enabled at database open
- Write operations use explicit transactions with retry on SQLITE_BUSY
- Bulk inserts (event batches) use prepared statements in a single transaction
- Read operations are lock-free under WAL

### Retention policy

- Events: configurable retention (default 90 days, compaction removes resolved chains)
- Sessions: keep metadata indefinitely, purge event data per retention
- Checkpoints: keep last N per session (default 10), auto-prune older
- Cost records: aggregate after 30 days (keep daily summaries, drop per-request)
- Audit log: keep indefinitely (regulatory compliance)
