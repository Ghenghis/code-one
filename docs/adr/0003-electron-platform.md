# ADR-0003: Electron as Desktop Platform

**Date:** 2026-04-14  
**Status:** accepted  
**Tier:** 0  
**Deciders:** Project lead

## Context

The Hybrid IDE needs a desktop shell that provides native OS integration (file system, process spawning, window management) while supporting a rich web-based UI (Monaco editor, React components, streaming rendering). The choice of platform determines long-term constraints on performance, distribution, and feature ceiling.

## Decision

Use Electron as the desktop application platform, with React for the renderer process and Node.js for the main process.

## Rationale

Electron is the proven platform for developer tools of this class:

- VS Code, Cursor, Zed (pre-native), Atom, Slack, Discord all validated this path
- Monaco editor is designed for Electron's renderer process
- xterm.js integrates natively with Electron's node-pty
- Full Node.js API in main process enables file system, child processes, SSH, Docker, and GPU access
- Chromium renderer supports all modern web standards needed for streaming markdown, diff views, and preview panels
- Mature distribution toolchain (electron-builder, electron-forge, auto-update via electron-updater)
- Cross-platform: Windows, macOS, Linux from one codebase

## Alternatives considered

**Tauri (Rust + WebView2/WebKit)**

- Smaller binaries, lower memory baseline
- Rejected: No Node.js in backend process. Would require rewriting all Node-dependent integrations (node-pty, SSH2, Docker SDK) in Rust or bridging via IPC. Monaco and xterm.js have unresolved edge cases in non-Chromium webviews. Ecosystem maturity gap for developer tools.

**VS Code Extension**

- Zero distribution friction, existing user base
- Rejected: Extension host sandbox prevents the level of system access required (raw process spawning, GPU access, agent isolation, custom window management). Would constrain Tier 4-7 features permanently.

**Browser-only (PWA / web app)**

- No install step, widest reach
- Rejected: No local file system access, no process spawning, no local model execution, no SSH. Fundamental mismatch with the product vision of a desktop-first AI development platform.

**Flutter Desktop**

- Cross-platform native rendering
- Rejected: No Monaco equivalent. Would require building a code editor from scratch or embedding a webview anyway. Dart ecosystem has minimal overlap with the Node.js libraries needed (node-pty, SSH2, langchain-js).

## Research sources

- [docs/research/kilocode.md](../research/kilocode.md) — KiloCode uses VS Code extension host; our requirements exceed extension sandbox
- [docs/research/openhands.md](../research/openhands.md) — OpenHands uses browser UI but requires server-side Docker; desktop Electron gives us both sides
- [docs/research/opencode.md](../research/opencode.md) — OpenCode is terminal-only; we need rich UI

## Consequences

### Positive

- Full access to Node.js APIs for all tiers
- Monaco and xterm.js work without compatibility hacks
- Proven distribution and auto-update path
- Large pool of Electron expertise and libraries

### Negative

- Higher baseline memory (~150-300MB idle)
- Larger download size (~100-200MB)
- Chromium update cadence introduces security maintenance burden
- Must manage main/renderer process boundary carefully

### Risks

- Electron major version upgrades can break native modules
- Chromium security patches must be tracked and applied promptly
- Memory usage must be actively managed as features grow

## Validation

- Desktop shell renders and launches on all three OS platforms
- Memory usage stays below 500MB for typical workspace (monitor at each milestone)
- Auto-update mechanism verified before first public release
