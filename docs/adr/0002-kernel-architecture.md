# ADR 0002: Kernel Architecture

## Status

Accepted

## Date

2026-04-14

## Context

The Platform Kernel (Tier 0) is the foundation every other module depends on. It must provide:
- Cross-module communication (events and commands)
- Module lifecycle management with dependency resolution
- Capability-based access control
- Settings persistence with scope chaining
- Layout state management for the desktop shell
- Structured logging

These subsystems must be decoupled from all higher tiers (IDE, AI, Agents, Remote) and from Electron-specific APIs.

## Decision

### 1. Event Bus — Append-Only EventStream

Adopted the OpenHands EventStream pattern: all state changes are immutable events on an append-only log. Events carry IDs, timestamps, source identifiers, and causation links (`parentId`). The bus supports typed subscriptions, wildcard listeners, and full history for replay.

**Why**: Session replay, audit trails, and UI reactivity all derive from a single event stream. Append-only guarantees no lost state.

### 2. Command Bus — Central Dispatch

All user actions (keybindings, menu items, command palette) route through a typed command bus. Commands have descriptors (title, category, keybinding) and are registered by modules at activation time.

**Why**: Decouples UI triggers from implementation. Enables the command palette, keybinding customization, and cross-module invocation without direct imports.

### 3. Module Registry — Topological Lifecycle

Modules declare tier, dependencies, and capabilities in a manifest. The registry activates modules in topological (dependency) order and deactivates in reverse. A tier constraint prevents higher-tier modules from being dependencies of lower-tier modules.

**Why**: Enforces the architectural boundary that Tier 0 knows nothing about Tier 1+. Prevents circular and upward dependencies at registration time.

### 4. Permission Engine — Three-Layer Evaluation

1. **Policy layer**: Explicit grants per module (allow/deny/prompt per capability)
2. **Trust-level layer**: Capabilities at `restricted` or `remote` trust default to prompt
3. **Hook layer**: Programmable pre/post checks for dynamic conditions

Default-deny: no policy = denied.

**Why**: Matches the KiloCode/Claude Code permission model. Provides defense in depth without requiring every module to implement its own access control.

### 5. Settings Manager — Scope Chain

Three scopes: `default → user → project`. Project overrides user overrides default. Change events for reactive updates. Pluggable persistence backend (injected at runtime by Electron shell).

**Why**: Settings must resolve differently per workspace. The scope chain is a proven pattern (VS Code, JetBrains).

### 6. Layout Manager — Tree Model

Layout is a tree of split nodes (directional splits) and panel leaves. Tab groups are tracked separately for the center editor area. Sidebar collapse states and panel sizes are persisted.

**Why**: Supports arbitrary split layouts (like VS Code's grid) while keeping the state serializable for persistence.

### 7. Structured Logging

Named loggers per module. Log levels (debug/info/warn/error). Pluggable outputs (console, file, IPC to renderer). Entries retained in memory for the Logs panel.

**Why**: Every subsystem needs logging. Centralized log factory ensures consistent format and allows the UI to display logs without filesystem access.

## Consequences

- All cross-module communication goes through events/commands — no direct imports between packages at different tiers
- Module activation order is deterministic and dependency-safe
- Permission checks are a single `engine.check()` call — any module can be permissioned without code changes
- Settings and layout state can be persisted by any backend (file, SQLite, Electron store) without kernel changes
- The kernel has zero Electron dependencies — it runs in any Node.js environment (enables testing without Electron)
