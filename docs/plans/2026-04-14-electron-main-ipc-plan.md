# Electron Main Process + IPC Bridge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the Electron desktop shell so the kernel is accessible through typed IPC — no GUI, just infrastructure.

**Architecture:** Single BrowserWindow with contextBridge preload. IPC handlers are factory functions that delegate to kernel subsystems. All channels explicitly registered. Electron Forge + Vite plugin for build tooling.

**Tech Stack:** Electron 35, @electron-forge/cli 7, @electron-forge/plugin-vite 7, Vite 6, TypeScript, Vitest

---

### Task 1: Install Electron Forge Dependencies

**Files:**
- Modify: `apps/desktop/package.json`

**Step 1: Update package.json with all required dependencies**

Replace `apps/desktop/package.json` with:

```json
{
  "name": "@code-one/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": ".vite/build/main.js",
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "build": "electron-forge make",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "vitest run --passWithNoTests",
    "clean": "rm -rf dist .vite out"
  },
  "dependencies": {
    "@code-one/kernel": "workspace:*",
    "@code-one/shared-types": "workspace:*",
    "electron-squirrel-startup": "^1.0.1"
  },
  "devDependencies": {
    "@electron-forge/cli": "^7.8.0",
    "@electron-forge/maker-squirrel": "^7.8.0",
    "@electron-forge/maker-zip": "^7.8.0",
    "@electron-forge/maker-deb": "^7.8.0",
    "@electron-forge/maker-rpm": "^7.8.0",
    "@electron-forge/plugin-vite": "^7.8.0",
    "electron": "^35.0.0",
    "vite": "^6.0.0"
  }
}
```

**Step 2: Install dependencies**

Run: `cd G:\Github\New_Project && pnpm install`
Expected: Clean install, no peer dep errors

**Step 3: Commit**

```bash
git add apps/desktop/package.json pnpm-lock.yaml
git commit -m "feat(desktop): add Electron Forge and Vite plugin dependencies"
```

---

### Task 2: Create Electron Forge and Vite Configuration

**Files:**
- Create: `apps/desktop/forge.config.ts`
- Create: `apps/desktop/vite.main.config.ts`
- Create: `apps/desktop/vite.preload.config.ts`
- Create: `apps/desktop/vite.renderer.config.ts`

**Step 1: Create forge.config.ts**

```typescript
import type { ForgeConfig } from "@electron-forge/shared-types";
import { VitePlugin } from "@electron-forge/plugin-vite";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "Code One",
  },
  rebuildConfig: {},
  makers: [
    { name: "@electron-forge/maker-squirrel", config: {} },
    { name: "@electron-forge/maker-zip", platforms: ["darwin"] },
    { name: "@electron-forge/maker-deb", config: {} },
    { name: "@electron-forge/maker-rpm", config: {} },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main/index.ts",
          config: "vite.main.config.ts",
        },
        {
          entry: "src/preload/index.ts",
          config: "vite.preload.config.ts",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
  ],
};

export default config;
```

**Step 2: Create vite.main.config.ts**

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron"],
    },
  },
  resolve: {
    conditions: ["node"],
  },
});
```

**Step 3: Create vite.preload.config.ts**

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron"],
    },
  },
});
```

**Step 4: Create vite.renderer.config.ts**

```typescript
import { defineConfig } from "vite";

export default defineConfig({});
```

**Step 5: Commit**

```bash
git add apps/desktop/forge.config.ts apps/desktop/vite.main.config.ts apps/desktop/vite.preload.config.ts apps/desktop/vite.renderer.config.ts
git commit -m "feat(desktop): add Electron Forge and Vite configuration"
```

---

### Task 3: Define IPC Channel Registry

**Files:**
- Create: `apps/desktop/src/shared/channels.ts`
- Create: `apps/desktop/src/shared/channels.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/desktop/src/shared/channels.test.ts
import { describe, it, expect } from "vitest";
import { IPC_CHANNELS, getChannelDescriptor } from "./channels.js";

describe("IPC Channel Registry", () => {
  it("has all required channels", () => {
    const required = [
      "command:execute",
      "command:list",
      "event:emit",
      "event:subscribe",
      "settings:get",
      "settings:set",
      "settings:get-scope",
      "layout:get",
      "layout:set",
      "module:list",
      "permission:check",
    ];
    for (const ch of required) {
      expect(IPC_CHANNELS).toContain(ch);
    }
  });

  it("returns descriptor for valid channel", () => {
    const desc = getChannelDescriptor("command:execute");
    expect(desc).toBeDefined();
    expect(desc!.channel).toBe("command:execute");
    expect(desc!.direction).toBeDefined();
    expect(desc!.module).toBeDefined();
    expect(desc!.description).toBeTruthy();
  });

  it("returns undefined for unknown channel", () => {
    expect(getChannelDescriptor("does:not-exist")).toBeUndefined();
  });

  it("every channel has a descriptor", () => {
    for (const ch of IPC_CHANNELS) {
      const desc = getChannelDescriptor(ch);
      expect(desc, `missing descriptor for ${ch}`).toBeDefined();
    }
  });

  it("channel names follow module:action format", () => {
    for (const ch of IPC_CHANNELS) {
      expect(ch).toMatch(/^[a-z]+:[a-z][-a-z]*$/);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd G:\Github\New_Project && pnpm --filter @code-one/desktop test`
Expected: FAIL — cannot find module `./channels.js`

**Step 3: Write the implementation**

```typescript
// apps/desktop/src/shared/channels.ts
import type { IPCChannelDescriptor } from "@code-one/shared-types";

const CHANNEL_DESCRIPTORS: IPCChannelDescriptor[] = [
  {
    channel: "command:execute",
    direction: "renderer-to-main",
    description: "Execute a registered command by ID",
    module: "kernel",
  },
  {
    channel: "command:list",
    direction: "renderer-to-main",
    description: "List all registered command descriptors",
    module: "kernel",
  },
  {
    channel: "event:emit",
    direction: "renderer-to-main",
    description: "Emit an event from renderer to main process event bus",
    module: "kernel",
  },
  {
    channel: "event:subscribe",
    direction: "bidirectional",
    description: "Subscribe to events; main forwards matching events to renderer",
    module: "kernel",
  },
  {
    channel: "settings:get",
    direction: "renderer-to-main",
    description: "Get a resolved setting value by key",
    module: "kernel",
  },
  {
    channel: "settings:set",
    direction: "renderer-to-main",
    description: "Set a setting value at a given scope",
    module: "kernel",
  },
  {
    channel: "settings:get-scope",
    direction: "renderer-to-main",
    description: "Get all settings at a specific scope",
    module: "kernel",
  },
  {
    channel: "layout:get",
    direction: "renderer-to-main",
    description: "Get the current layout state",
    module: "kernel",
  },
  {
    channel: "layout:set",
    direction: "renderer-to-main",
    description: "Replace the layout state",
    module: "kernel",
  },
  {
    channel: "module:list",
    direction: "renderer-to-main",
    description: "List all registered modules and their status",
    module: "kernel",
  },
  {
    channel: "permission:check",
    direction: "renderer-to-main",
    description: "Check if a permission is granted for a module + capability",
    module: "kernel",
  },
];

export const IPC_CHANNELS = CHANNEL_DESCRIPTORS.map((d) => d.channel);

const descriptorMap = new Map(CHANNEL_DESCRIPTORS.map((d) => [d.channel, d]));

export function getChannelDescriptor(
  channel: string,
): IPCChannelDescriptor | undefined {
  return descriptorMap.get(channel);
}
```

**Step 4: Run test to verify it passes**

Run: `cd G:\Github\New_Project && pnpm --filter @code-one/desktop test`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/shared/channels.ts apps/desktop/src/shared/channels.test.ts
git commit -m "feat(desktop): add typed IPC channel registry"
```

---

### Task 4: Create IPC Handler Factory (TDD)

**Files:**
- Create: `apps/desktop/src/main/ipc-handlers.test.ts`
- Create: `apps/desktop/src/main/ipc-handlers.ts`

**Step 1: Write failing tests**

```typescript
// apps/desktop/src/main/ipc-handlers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createIPCHandlers } from "./ipc-handlers.js";
import type { Kernel } from "@code-one/kernel";

function mockKernel(): Kernel {
  return {
    commands: {
      execute: vi.fn().mockResolvedValue({ ok: true }),
      list: vi.fn().mockReturnValue([
        { id: "test:cmd", title: "Test Command" },
      ]),
      has: vi.fn(),
      register: vi.fn(),
      unregister: vi.fn(),
      get: vi.fn(),
    },
    events: {
      emit: vi.fn(),
      on: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onAny: vi.fn(),
      history: vi.fn(),
      clear: vi.fn(),
    },
    settings: {
      get: vi.fn().mockReturnValue(14),
      set: vi.fn(),
      getOr: vi.fn(),
      delete: vi.fn(),
      onChange: vi.fn(),
      registerSchema: vi.fn(),
      listSchema: vi.fn(),
      load: vi.fn(),
      save: vi.fn(),
      getScope: vi.fn().mockReturnValue({ "editor.fontSize": 14 }),
    },
    layout: {
      getState: vi.fn().mockReturnValue({
        root: { kind: "panel", id: "root", panelType: "editor", position: "center", visible: true, weight: 1 },
        tabGroups: [],
        sidebarCollapsed: { left: false, right: false, bottom: false },
        panelSizes: {},
      }),
      setState: vi.fn(),
      addPanel: vi.fn(),
      removePanel: vi.fn(),
      togglePanel: vi.fn(),
      resizePanel: vi.fn(),
      openTab: vi.fn(),
      closeTab: vi.fn(),
      activateTab: vi.fn(),
      focusPanel: vi.fn(),
      toggleSidebar: vi.fn(),
      onChange: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      resetToDefault: vi.fn(),
    },
    modules: {
      list: vi.fn().mockReturnValue([]),
      register: vi.fn(),
      unregister: vi.fn(),
      activateAll: vi.fn(),
      deactivateAll: vi.fn(),
      getStatus: vi.fn(),
      get: vi.fn(),
      has: vi.fn(),
      hasCapability: vi.fn(),
    },
    permissions: {
      check: vi.fn().mockResolvedValue({
        decision: "allow",
        reason: "policy",
        decidedBy: "policy",
      }),
      registerCapability: vi.fn(),
      setPolicy: vi.fn(),
      removePolicy: vi.fn(),
      addHook: vi.fn(),
      clearHooks: vi.fn(),
      listCapabilities: vi.fn(),
      getPolicy: vi.fn(),
    },
    loggerFactory: {
      createLogger: vi.fn().mockReturnValue({
        name: "test",
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      }),
      setLevel: vi.fn(),
      getLevel: vi.fn(),
      addOutput: vi.fn(),
      getEntries: vi.fn(),
    },
    logger: {
      name: "kernel",
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    },
    shutdown: vi.fn(),
  } as unknown as Kernel;
}

describe("IPC Handlers", () => {
  let kernel: Kernel;
  let handlers: ReturnType<typeof createIPCHandlers>;

  beforeEach(() => {
    kernel = mockKernel();
    handlers = createIPCHandlers(kernel);
  });

  it("has handlers for all registered channels", () => {
    const expected = [
      "command:execute",
      "command:list",
      "event:emit",
      "settings:get",
      "settings:set",
      "settings:get-scope",
      "layout:get",
      "layout:set",
      "module:list",
      "permission:check",
    ];
    for (const ch of expected) {
      expect(handlers[ch], `missing handler for ${ch}`).toBeTypeOf("function");
    }
  });

  describe("command:execute", () => {
    it("delegates to kernel.commands.execute", async () => {
      const result = await handlers["command:execute"](
        {},
        { commandId: "test:cmd", args: { file: "foo.ts" } },
      );
      expect(kernel.commands.execute).toHaveBeenCalledWith("test:cmd", {
        args: { file: "foo.ts" },
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe("command:list", () => {
    it("returns all command descriptors", () => {
      const result = handlers["command:list"]({});
      expect(kernel.commands.list).toHaveBeenCalled();
      expect(result).toEqual([{ id: "test:cmd", title: "Test Command" }]);
    });
  });

  describe("event:emit", () => {
    it("delegates to kernel.events.emit", () => {
      const event = { id: "e1", type: "user:message", timestamp: Date.now(), source: "user", sessionId: "s1", payload: { text: "hi" } };
      handlers["event:emit"]({}, event);
      expect(kernel.events.emit).toHaveBeenCalledWith(event);
    });
  });

  describe("settings:get", () => {
    it("returns setting value by key", () => {
      const result = handlers["settings:get"]({}, { key: "editor.fontSize" });
      expect(kernel.settings.get).toHaveBeenCalledWith("editor.fontSize");
      expect(result).toBe(14);
    });
  });

  describe("settings:set", () => {
    it("sets a setting value at scope", () => {
      handlers["settings:set"](
        {},
        { key: "editor.fontSize", value: 16, scope: "user" },
      );
      expect(kernel.settings.set).toHaveBeenCalledWith(
        "editor.fontSize",
        16,
        "user",
      );
    });
  });

  describe("settings:get-scope", () => {
    it("returns all settings at a scope", () => {
      const result = handlers["settings:get-scope"]({}, { scope: "user" });
      expect(kernel.settings.getScope).toHaveBeenCalledWith("user");
      expect(result).toEqual({ "editor.fontSize": 14 });
    });
  });

  describe("layout:get", () => {
    it("returns current layout state", () => {
      const result = handlers["layout:get"]({});
      expect(kernel.layout.getState).toHaveBeenCalled();
      expect(result).toHaveProperty("root");
    });
  });

  describe("layout:set", () => {
    it("replaces layout state", () => {
      const state = {
        root: { kind: "panel" as const, id: "r", panelType: "editor", position: "center" as const, visible: true, weight: 1 },
        tabGroups: [],
        sidebarCollapsed: { left: false, right: false, bottom: false },
        panelSizes: {},
      };
      handlers["layout:set"]({}, state);
      expect(kernel.layout.setState).toHaveBeenCalledWith(state);
    });
  });

  describe("module:list", () => {
    it("returns all registered modules", () => {
      const result = handlers["module:list"]({});
      expect(kernel.modules.list).toHaveBeenCalled();
    });
  });

  describe("permission:check", () => {
    it("delegates to kernel.permissions.check", async () => {
      const request = {
        moduleId: "editor",
        capabilityId: "fs:read",
      };
      const result = await handlers["permission:check"]({}, request);
      expect(kernel.permissions.check).toHaveBeenCalledWith(request);
      expect(result).toHaveProperty("decision", "allow");
    });
  });

  describe("error handling", () => {
    it("wraps thrown errors in IPCError format", async () => {
      (kernel.commands.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Command not found"),
      );
      const result = await handlers["command:execute"](
        {},
        { commandId: "bad:cmd" },
      );
      expect(result).toHaveProperty("error");
      expect(result.error).toHaveProperty("code", "IPC_ERROR");
      expect(result.error).toHaveProperty("message", "Command not found");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd G:\Github\New_Project && pnpm --filter @code-one/desktop test`
Expected: FAIL — cannot find module `./ipc-handlers.js`

**Step 3: Write the implementation**

```typescript
// apps/desktop/src/main/ipc-handlers.ts
import type { Kernel } from "@code-one/kernel";
import type {
  BaseEvent,
  CommandContext,
  LayoutState,
  PermissionRequest,
  SettingsScope,
  IPCError,
} from "@code-one/shared-types";

type HandlerFn = (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>;

export interface IPCHandlerMap {
  [channel: string]: HandlerFn;
}

interface IPCErrorResponse {
  error: IPCError;
}

function wrapError(err: unknown): IPCErrorResponse {
  const message = err instanceof Error ? err.message : String(err);
  return { error: { code: "IPC_ERROR", message } };
}

function safeHandler(fn: HandlerFn): HandlerFn {
  return async (event: unknown, ...args: unknown[]) => {
    try {
      return await fn(event, ...args);
    } catch (err) {
      return wrapError(err);
    }
  };
}

export function createIPCHandlers(kernel: Kernel): IPCHandlerMap {
  return {
    "command:execute": safeHandler(
      async (_event, payload: unknown) => {
        const { commandId, args } = payload as {
          commandId: string;
          args?: Record<string, unknown>;
        };
        const ctx: Partial<CommandContext> = args ? { args } : undefined;
        return kernel.commands.execute(commandId, ctx);
      },
    ),

    "command:list": (_event: unknown) => {
      return kernel.commands.list();
    },

    "event:emit": (_event: unknown, payload: unknown) => {
      kernel.events.emit(payload as BaseEvent);
    },

    "settings:get": (_event: unknown, payload: unknown) => {
      const { key } = payload as { key: string };
      return kernel.settings.get(key);
    },

    "settings:set": (_event: unknown, payload: unknown) => {
      const { key, value, scope } = payload as {
        key: string;
        value: unknown;
        scope?: SettingsScope;
      };
      kernel.settings.set(key, value, scope);
    },

    "settings:get-scope": (_event: unknown, payload: unknown) => {
      const { scope } = payload as { scope: SettingsScope };
      return kernel.settings.getScope(scope);
    },

    "layout:get": (_event: unknown) => {
      return kernel.layout.getState();
    },

    "layout:set": (_event: unknown, payload: unknown) => {
      kernel.layout.setState(payload as LayoutState);
    },

    "module:list": (_event: unknown) => {
      return kernel.modules.list();
    },

    "permission:check": safeHandler(
      async (_event, payload: unknown) => {
        return kernel.permissions.check(payload as PermissionRequest);
      },
    ),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd G:\Github\New_Project && pnpm --filter @code-one/desktop test`
Expected: All 12 tests PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/main/ipc-handlers.ts apps/desktop/src/main/ipc-handlers.test.ts
git commit -m "feat(desktop): add IPC handler factory with full kernel delegation"
```

---

### Task 5: Create Preload Script with Typed API

**Files:**
- Create: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/preload/api.ts`
- Create: `apps/desktop/src/preload/api.test.ts`

**Step 1: Write failing test for API shape**

```typescript
// apps/desktop/src/preload/api.test.ts
import { describe, it, expect } from "vitest";
import { API_METHODS } from "./api.js";

describe("Preload API shape", () => {
  it("exports all expected method names", () => {
    const expected = [
      "executeCommand",
      "listCommands",
      "emitEvent",
      "onEvent",
      "getSetting",
      "setSetting",
      "getSettingsScope",
      "getLayout",
      "setLayout",
      "listModules",
      "checkPermission",
    ];
    for (const method of expected) {
      expect(API_METHODS).toContain(method);
    }
  });

  it("method count matches expected", () => {
    expect(API_METHODS.length).toBe(11);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd G:\Github\New_Project && pnpm --filter @code-one/desktop test`
Expected: FAIL — cannot find `./api.js`

**Step 3: Write the API definition**

```typescript
// apps/desktop/src/preload/api.ts
/**
 * Type-safe preload API surface.
 *
 * This defines what `window.codeone` exposes to the renderer.
 * The actual implementation uses ipcRenderer.invoke / ipcRenderer.on
 * and is only usable inside the preload script (Electron context).
 */

import type {
  BaseEvent,
  CommandDescriptor,
  LayoutState,
  ModuleEntry,
  PermissionRequest,
  PermissionResult,
  SettingsScope,
} from "@code-one/shared-types";

export interface CodeOneAPI {
  executeCommand(commandId: string, args?: Record<string, unknown>): Promise<unknown>;
  listCommands(): Promise<ReadonlyArray<CommandDescriptor>>;
  emitEvent(event: BaseEvent): Promise<void>;
  onEvent(type: string, callback: (event: BaseEvent) => void): () => void;
  getSetting<T = unknown>(key: string): Promise<T | undefined>;
  setSetting(key: string, value: unknown, scope?: SettingsScope): Promise<void>;
  getSettingsScope(scope: SettingsScope): Promise<Readonly<Record<string, unknown>>>;
  getLayout(): Promise<LayoutState>;
  setLayout(state: LayoutState): Promise<void>;
  listModules(): Promise<ReadonlyArray<ModuleEntry>>;
  checkPermission(request: PermissionRequest): Promise<PermissionResult>;
}

export const API_METHODS: ReadonlyArray<keyof CodeOneAPI> = [
  "executeCommand",
  "listCommands",
  "emitEvent",
  "onEvent",
  "getSetting",
  "setSetting",
  "getSettingsScope",
  "getLayout",
  "setLayout",
  "listModules",
  "checkPermission",
];
```

**Step 4: Write the preload script**

```typescript
// apps/desktop/src/preload/index.ts
import { contextBridge, ipcRenderer } from "electron";
import type { CodeOneAPI } from "./api.js";
import type { BaseEvent } from "@code-one/shared-types";

const api: CodeOneAPI = {
  executeCommand: (commandId, args) =>
    ipcRenderer.invoke("command:execute", { commandId, args }),

  listCommands: () => ipcRenderer.invoke("command:list"),

  emitEvent: (event) => ipcRenderer.invoke("event:emit", event),

  onEvent: (type, callback) => {
    const listener = (_ipcEvent: Electron.IpcRendererEvent, event: BaseEvent) => {
      callback(event);
    };
    ipcRenderer.on(`event:forward:${type}`, listener);
    return () => {
      ipcRenderer.removeListener(`event:forward:${type}`, listener);
    };
  },

  getSetting: (key) => ipcRenderer.invoke("settings:get", { key }),

  setSetting: (key, value, scope) =>
    ipcRenderer.invoke("settings:set", { key, value, scope }),

  getSettingsScope: (scope) =>
    ipcRenderer.invoke("settings:get-scope", { scope }),

  getLayout: () => ipcRenderer.invoke("layout:get"),

  setLayout: (state) => ipcRenderer.invoke("layout:set", state),

  listModules: () => ipcRenderer.invoke("module:list"),

  checkPermission: (request) =>
    ipcRenderer.invoke("permission:check", request),
};

contextBridge.exposeInMainWorld("codeone", api);
```

**Step 5: Run tests**

Run: `cd G:\Github\New_Project && pnpm --filter @code-one/desktop test`
Expected: All tests PASS (preload/index.ts won't be tested directly — it requires Electron runtime)

**Step 6: Commit**

```bash
git add apps/desktop/src/preload/index.ts apps/desktop/src/preload/api.ts apps/desktop/src/preload/api.test.ts
git commit -m "feat(desktop): add typed preload API with contextBridge"
```

---

### Task 6: Create Main Process Entry

**Files:**
- Create: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/tsconfig.json`

**Step 1: Update tsconfig for Electron**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/shared-types" },
    { "path": "../../packages/kernel" }
  ]
}
```

**Step 2: Delete the old stub**

Remove `apps/desktop/src/index.ts` (the empty `export {};` stub).

**Step 3: Create the main process entry**

```typescript
// apps/desktop/src/main/index.ts
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { createKernel } from "@code-one/kernel";
import { createIPCHandlers } from "./ipc-handlers.js";
import { IPC_CHANNELS } from "../shared/channels.js";

// Handle Squirrel events on Windows (install/update/uninstall)
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require("electron-squirrel-startup")) app.quit();

// Vite injects these constants at build time
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// ---------------------------------------------------------------------------
// Kernel
// ---------------------------------------------------------------------------

const kernel = createKernel({ logLevel: "info" });

// ---------------------------------------------------------------------------
// IPC registration
// ---------------------------------------------------------------------------

const handlers = createIPCHandlers(kernel);

for (const channel of IPC_CHANNELS) {
  const handler = handlers[channel];
  if (handler) {
    ipcMain.handle(channel, handler as Parameters<typeof ipcMain.handle>[1]);
  }
}

kernel.logger.info("IPC handlers registered", { channels: IPC_CHANNELS });

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    title: "Code One",
  });

  // Show window once ready to avoid flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  kernel.logger.info("Main window created");
  return mainWindow;
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.on("ready", () => {
  kernel.logger.info("App ready");
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", async () => {
  kernel.logger.info("App quitting — shutting down kernel");
  await kernel.shutdown();
});
```

**Step 4: Verify typecheck passes**

Run: `cd G:\Github\New_Project && pnpm --filter @code-one/desktop typecheck`
Expected: No errors (preload/index.ts may need `skipLibCheck` for Electron types — adjust if needed)

Note: The main process file and preload import `electron` which is only available at runtime. TypeScript type-checks against the types shipped with the `electron` package. If typecheck fails on electron imports, the `electron` devDependency provides the needed types.

**Step 5: Commit**

```bash
git add apps/desktop/src/main/index.ts apps/desktop/tsconfig.json
git rm apps/desktop/src/index.ts
git commit -m "feat(desktop): add Electron main process with kernel bootstrap and IPC"
```

---

### Task 7: Create Minimal Renderer Placeholder

**Files:**
- Create: `apps/desktop/src/renderer/index.html`
- Create: `apps/desktop/src/renderer/index.ts`

These are minimal placeholders — no React, no UI components. Just enough for Electron to load a page.

**Step 1: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'" />
    <title>Code One</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./index.ts"></script>
  </body>
</html>
```

**Step 2: Create index.ts**

```typescript
// apps/desktop/src/renderer/index.ts
// Minimal renderer entry — Phase 2 will add React + UI components.
// For now, verify IPC bridge is available.

declare global {
  interface Window {
    codeone: import("../preload/api.js").CodeOneAPI;
  }
}

async function verifyBridge(): Promise<void> {
  if (!window.codeone) {
    document.getElementById("root")!.textContent =
      "Error: IPC bridge not available";
    return;
  }

  const layout = await window.codeone.getLayout();
  const modules = await window.codeone.listModules();
  const commands = await window.codeone.listCommands();

  document.getElementById("root")!.textContent =
    `Code One — Kernel connected. ` +
    `Layout: ${layout.root.kind}, ` +
    `Modules: ${modules.length}, ` +
    `Commands: ${commands.length}`;
}

verifyBridge();
```

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/index.html apps/desktop/src/renderer/index.ts
git commit -m "feat(desktop): add minimal renderer placeholder with IPC verification"
```

---

### Task 8: End-to-End Verification

**Step 1: Run all tests**

Run: `cd G:\Github\New_Project && pnpm test`
Expected: All packages pass

**Step 2: Run typecheck**

Run: `cd G:\Github\New_Project && pnpm typecheck`
Expected: No errors

**Step 3: Run lint**

Run: `cd G:\Github\New_Project && pnpm lint`
Expected: No errors (fix any issues)

**Step 4: Launch the desktop app**

Run: `cd G:\Github\New_Project/apps/desktop && pnpm start`
Expected:
- Electron window opens with title "Code One"
- Window displays "Code One — Kernel connected. Layout: panel, Modules: 0, Commands: 0"
- Console shows kernel initialization logs
- Closing window quits the app (on Windows/Linux)
- No errors in console

**Step 5: Verify clean quit**

Close the window. Check terminal output for:
- "App quitting — shutting down kernel"
- "Kernel shutdown complete"
- Process exits cleanly

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(desktop): Electron shell with kernel IPC bridge — M2 infrastructure complete"
```

---

### Task Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Electron Forge dependencies | — |
| 2 | Forge + Vite configuration | — |
| 3 | IPC channel registry | 5 |
| 4 | IPC handler factory | 12 |
| 5 | Preload script + typed API | 2 |
| 6 | Main process entry | typecheck |
| 7 | Renderer placeholder | — |
| 8 | End-to-end verification | all |

**Total new test cases:** 19
**Exit criteria:** App launches, kernel initializes, IPC round-trips work, clean shutdown.
