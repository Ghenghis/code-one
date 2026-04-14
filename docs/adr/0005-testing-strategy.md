# ADR-0005: Testing Strategy

**Date:** 2026-04-14  
**Status:** accepted  
**Tier:** 0-7  
**Deciders:** Project lead

## Context

A multi-tier desktop application with AI integration, agent execution, and remote operations requires a testing strategy that catches regressions early without creating a fragile test suite that slows development. The strategy must work across all 8 tiers and accommodate both deterministic (kernel, UI) and non-deterministic (AI, agents) subsystems.

## Decision

Adopt a three-layer testing pyramid using Vitest as the primary test runner, with tier-appropriate strategies for non-deterministic systems.

## Rationale

### Layer 1: Unit tests (foundation)
- **Target**: All pure functions, state machines, and isolated modules
- **Coverage goal**: ≥80% statement coverage per package, ≥90% for Tier 0 kernel
- **Runner**: Vitest (already configured, fast, TypeScript-native, watch mode)
- **What to test**: Command bus dispatch, event bus pub/sub, permission engine policy evaluation, settings merge, layout tree operations, provider routing logic, graph state reducers, tool schema validation

### Layer 2: Integration tests (wiring)
- **Target**: Cross-module interactions, IPC boundaries, database operations
- **Coverage goal**: Critical paths covered (≥1 test per IPC channel, ≥1 test per database table CRUD)
- **Runner**: Vitest with setup/teardown for real dependencies (SQLite in-memory, mock Electron IPC)
- **What to test**: Module lifecycle (register → init → activate → deactivate → dispose), provider fallback chain activation, event stream persistence and replay, settings persistence round-trip, checkpoint save/restore

### Layer 3: End-to-end tests (product)
- **Target**: User-facing workflows through the actual application
- **Coverage goal**: Golden paths for each milestone's exit criteria
- **Runner**: Playwright (Electron support via electron-playwright) or Spectron
- **What to test**: File open → edit → save, chat send → stream → render, agent task → approval → complete, remote connect → file browse → transfer

### Non-deterministic systems (AI, agents)
- **Approach**: Eval harness, not traditional assertions
- **AI responses**: Snapshot-based regression (flag if output diverges >threshold from baseline)
- **Agent tasks**: Scenario replay from recorded event streams (deterministic given same events)
- **Provider health**: Mock server with configurable latency/failure injection
- **Cost tracking**: Verified via mock provider with known token counts

## Alternatives considered

**Jest**
- Widely used, large ecosystem
- Rejected: Slower than Vitest for TypeScript projects. No native ESM support without transforms. Vitest already configured and working.

**Testing Library + Cypress (E2E)**
- Strong DOM testing
- Rejected for E2E: Cypress does not support Electron applications. Playwright has first-class Electron support.

**No coverage targets**
- Let developers decide per-PR
- Rejected: Without measurable thresholds, coverage erodes over time. The 80% floor prevents shipping untested code without being so high that it forces meaningless tests.

**Full E2E for everything**
- Maximum confidence
- Rejected: E2E tests are slow and brittle. The pyramid structure ensures fast feedback for most changes while reserving E2E for actual user workflows.

## Research sources

- [docs/research/openhands.md](../research/openhands.md) — OpenHands replays event streams for deterministic agent testing
- [docs/research/aider.md](../research/aider.md) — Aider uses benchmark suites (SWE-bench) for AI evaluation
- [docs/research/langgraph.md](../research/langgraph.md) — LangGraph checkpoints enable snapshot testing of graph state

## Consequences

### Positive
- Fast feedback loop (unit tests run in <5s for most packages)
- Coverage thresholds catch regressions before PR merge
- Eval harness handles non-deterministic AI behavior without flaky tests
- Event stream replay provides deterministic agent testing

### Negative
- Maintaining mock providers and eval baselines requires ongoing effort
- E2E tests for Electron are slower than web E2E tests
- Coverage thresholds may occasionally require tests for trivial code

### Risks
- AI eval baselines drift as models improve (mitigate: version baselines per model)
- E2E tests become flaky due to timing issues (mitigate: explicit waits, retry logic)
- Coverage gaming (writing tests that hit lines without verifying behavior)

## Validation

- CI pipeline runs all three layers: unit → integration → E2E (E2E on merge only to keep PR checks fast)
- Coverage reports generated and tracked per milestone
- AI eval scores tracked over time (regression = investigation, not automatic failure)
- Test suite total runtime stays under 5 minutes for unit + integration on CI

## Per-tier testing matrix

| Tier | Unit | Integration | E2E | Eval | Coverage target |
|---|---|---|---|---|---|
| 0 Kernel | Yes | Yes (lifecycle) | No | No | ≥90% |
| 1 Core IDE | Yes | Yes (IPC) | Yes | No | ≥80% |
| 2 AI Coding | Yes | Yes (provider) | Yes | Yes (response quality) | ≥80% |
| 3 Intelligence | Yes | Yes (SQLite) | No | Yes (retrieval quality) | ≥80% |
| 4 Agent | Yes | Yes (event stream) | Yes | Yes (task completion) | ≥80% |
| 4.5 Automation | Yes | Yes (cross-module) | No | Yes (verifier accuracy) | ≥80% |
| 5 Remote | Yes | Yes (SSH mock) | Yes | No | ≥80% |
| 6 Skills/MCP | Yes | Yes (isolation) | Yes | No | ≥80% |
| 7 Model Lab | Yes | Yes | No | Yes (benchmark) | ≥80% |
