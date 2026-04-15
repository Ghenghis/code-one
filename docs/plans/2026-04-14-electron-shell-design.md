# Electron Shell Design — Infrastructure-First Build

Date: 2026-04-14

## Context

Milestone 0 (repo bootstrap) and Milestone 1 (Tier 0 kernel) are complete. The kernel provides: EventBus, CommandBus, ModuleRegistry, PermissionEngine, SettingsManager, LayoutManager, LoggerFactory, and a `createKernel()` entry point.

The next step is wiring the Electron desktop shell so that higher-tier backends (AI gateway, context engine, agent core, remote, skills, model lab) can be developed and tested against the kernel through typed IPC — all without any GUI.

## Build Order Decision

**All backend/infrastructure across all milestones first. GUI/UI/UX completely last.**

### Phase 1: Backend Infrastructure (no GUI)

| Priority | Scope                                                               | Milestone    |
| -------- | ------------------------------------------------------------------- | ------------ |
| 1        | Electron main process + IPC bridge + preload                        | M2 (partial) |
| 2        | AI gateway: provider adapters, streaming, fallback, health, cost    | M3           |
| 3        | Context engine: repo map, indexing, RAG, memory, ranking            | M4           |
| 4        | Agent core: event bus, loop, modes, approval, task graph, subagents | M5           |
| 5        | Remote/devops: SSH, SFTP, tunnels, Docker, git workflows            | M6           |
| 6        | Skills/MCP: skill runtime, MCP client, plugin SDK                   | M7           |
| 7        | Model lab: catalog, benchmarks, job runner                          | M8           |

### Phase 2: GUI (last)

React renderer, AppShell, allotment panels, Monaco editor, file tree, terminal, preview, chat panel, themes, settings UI, diagnostics — everything visual in one sweep.

---

## Priority 1: Electron Main Process + IPC Bridge

### Approach

Single BrowserWindow architecture. Approach A (simplest). Multi-window can be added later by spawning additional BrowserWindows with the same component — no rewrite needed.

### Technology Choices

| Decision      | Choice                                          | Rationale                                              |
| ------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Build tooling | electron-forge + Vite plugin                    | Production packaging from day one                      |
| IPC           | Typed preload bridge via contextBridge          | No `remote`, secure by default                         |
| State sync    | Zustand stores (renderer) ↔ IPC ↔ kernel (main) | Deferred to Phase 2, but contracts defined now         |
| Layout        | allotment                                       | Deferred to Phase 2, contracts in shared-types already |

### Package Structure

```
apps/desktop/
  forge.config.ts          # Electron Forge config with Vite plugin
  vite.main.config.ts      # Vite config for main process
  vite.preload.config.ts   # Vite config for preload script
  vite.renderer.config.ts  # Vite config for renderer (minimal for now)
  src/
    main/
      index.ts             # Electron main entry: app lifecycle, window creation
      ipc-handlers.ts      # Register all IPC handlers, delegate to kernel
      menu.ts              # Basic application menu
    preload/
      index.ts             # contextBridge.exposeInMainWorld typed API
    renderer/
      index.html           # Minimal HTML (placeholder until Phase 2)
      index.ts             # Minimal renderer entry (placeholder until Phase 2)
    shared/
      channels.ts          # IPC channel constants (shared between main + preload)
```

### Main Process (src/main/index.ts)

Responsibilities:

- Initialize kernel via `createKernel()`
- Create single BrowserWindow with preload script
- Register IPC handlers that delegate to kernel subsystems
- Handle app lifecycle (ready, activate, window-all-closed, before-quit → kernel.shutdown())
- Basic menu (File, Edit, View, Help) with command bus integration

### IPC Bridge (src/preload/index.ts)

Exposes typed API via `contextBridge.exposeInMainWorld("codeone", { ... })`:

```typescript
interface CodeOneAPI {
  // Commands
  executeCommand(id: string, args?: unknown): Promise<unknown>;

  // Events
  onEvent(channel: string, callback: (event: unknown) => void): () => void;

  // Settings
  getSetting(scope: string, key: string): Promise<unknown>;
  setSetting(scope: string, key: string, value: unknown): Promise<void>;

  // Layout
  getLayout(): Promise<LayoutState>;
  updateLayout(state: Partial<LayoutState>): Promise<void>;

  // Modules
  getModules(): Promise<ModuleManifest[]>;

  // Permissions
  checkPermission(moduleId: string, capability: string): Promise<boolean>;
}
```

All methods use `ipcRenderer.invoke` (request/response) or `ipcRenderer.on` (events). Channel names follow `{module}:{action}` convention from shared-types IPCChannelDescriptor.

### IPC Handlers (src/main/ipc-handlers.ts)

Each handler:

1. Receives typed IPCRequest
2. Delegates to kernel subsystem
3. Returns typed IPCResponse
4. Errors wrapped in IPCError format

Handlers registered for:

- `command:execute` → kernel.commands.execute()
- `event:subscribe` → kernel.events.on() with main→renderer forwarding
- `settings:get` / `settings:set` → kernel.settings
- `layout:get` / `layout:update` → kernel.layout
- `module:list` → kernel.modules.list()
- `permission:check` → kernel.permissions.check()

### IPC Channel Registry

All channels explicitly registered in `src/shared/channels.ts`. No dynamic channel creation. Matches the `IPCChannelDescriptor` type from shared-types.

### Dependencies to Add

```
apps/desktop/package.json:
  dependencies:
    @code-one/kernel: workspace:*
    @code-one/shared-types: workspace:*
    electron-squirrel-startup: ^1.0.0  (Windows squirrel)
  devDependencies:
    @electron-forge/cli: ^7
    @electron-forge/maker-squirrel: ^7
    @electron-forge/maker-zip: ^7
    @electron-forge/maker-deb: ^7
    @electron-forge/maker-rpm: ^7
    @electron-forge/plugin-vite: ^7
    electron: ^35
    vite: ^6
```

### Testing Strategy

- Unit tests for IPC handlers (mock kernel, verify delegation)
- Unit tests for channel registry (all channels have descriptors)
- Integration test: kernel round-trip through IPC (requires electron test harness or mock ipcMain/ipcRenderer)
- No visual/rendering tests in this phase

### Exit Criteria

- `pnpm --filter @code-one/desktop start` launches an Electron window
- Kernel initializes and logs startup
- IPC bridge exposes typed API on `window.codeone`
- Command execution round-trips through IPC to kernel and back
- Settings get/set works through IPC
- Layout state accessible through IPC
- App quits cleanly with kernel.shutdown()
- All IPC handlers have unit tests
- CI passes (lint, typecheck, test, build)
