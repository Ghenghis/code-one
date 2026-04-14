# Documentation Index

Recommended reading order for new contributors and agents.

---

## Start here

1. **[Hybrid IDE Design](plans/2026-04-14-hybrid-ide-design.md)** — Tier architecture, module map, product phases
2. **[E2E Build Blueprint](plans/2026-04-14-e2e-build-blueprint.md)** — Branch strategy, milestones, CI, research workflow
3. **[Glossary](GLOSSARY.md)** — Canonical definitions for all project terms

## Architecture decisions

4. **[ADR-0001: Monorepo with pnpm](adr/0001-monorepo-with-pnpm-workspaces.md)** — Why pnpm + Turbo
5. **[ADR-0002: Kernel Architecture](adr/0002-kernel-architecture.md)** — 7 subsystems, event-driven, capability-based
6. **[ADR-0003: Electron Platform](adr/0003-electron-platform.md)** — Why Electron over Tauri/extension/browser
7. **[ADR-0004: SQLite Persistence](adr/0004-sqlite-persistence.md)** — Schema, WAL, retention, concurrency
8. **[ADR-0005: Testing Strategy](adr/0005-testing-strategy.md)** — Three-layer pyramid, eval harness, coverage targets

## Runtime specifications

9. **[Runtime Specs](architecture/runtime-specs.md)** — Context compression, subagent isolation, SQLite schema, hook conflicts, cost governor

## Research notes

Read these before implementing the corresponding tier:

| Note | Tier(s) | Key patterns |
|---|---|---|
| [OpenHands](research/openhands.md) | 4 | Append-only event stream, action/observation |
| [LangGraph](research/langgraph.md) | 4 | Graph orchestration, checkpoints, reducers |
| [Aider](research/aider.md) | 3 | Repo map, Tree-sitter, PageRank, edit formats |
| [KiloCode](research/kilocode.md) | 4 | Mode-based permissions, approval gates |
| [Claude Code](research/claude-code.md) | 4 | Custom modes, scoped autonomy, hooks |
| [OpenCode](research/opencode.md) | 3-4 | Session persistence, compaction |
| [Security Sandboxing](research/security-sandboxing.md) | 0, 4 | Isolation, trust models |
| [Agentic Coding Papers](research/agentic-coding-papers.md) | 2-4 | Academic research |
| [Pattern Decision Log](research/pattern-decision-log.md) | All | Synthesis of chosen patterns |

## Project maps

10. **[maps/](maps/)** — Repo map, tier map, dependency map, module map, file tree map

## Contributing

11. **[Contributing Guide](CONTRIBUTING.md)** — How to contribute, branch conventions, PR process
