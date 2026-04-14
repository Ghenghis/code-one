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
      "event:subscribe",
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
      handlers["module:list"]({});
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

  describe("event:subscribe", () => {
    it("subscribes to kernel events and returns ack", () => {
      const sender = { send: vi.fn(), isDestroyed: vi.fn().mockReturnValue(false) };
      const result = handlers["event:subscribe"](
        { sender },
        { type: "user:message" },
      );
      expect(kernel.events.on).toHaveBeenCalledWith("user:message", expect.any(Function));
      expect(result).toHaveProperty("subscribed", true);
      expect(result).toHaveProperty("type", "user:message");
    });

    it("forwards kernel events to sender webContents", () => {
      const sender = { send: vi.fn(), isDestroyed: vi.fn().mockReturnValue(false) };
      let capturedHandler: ((evt: unknown) => void) | undefined;
      (kernel.events.on as ReturnType<typeof vi.fn>).mockImplementation(
        (_type: string, handler: (evt: unknown) => void) => {
          capturedHandler = handler;
          return { dispose: vi.fn() };
        },
      );

      handlers["event:subscribe"]({ sender }, { type: "tool:call" });

      const event = { id: "e1", type: "tool:call", timestamp: Date.now() };
      capturedHandler!(event);

      expect(sender.send).toHaveBeenCalledWith("event:forward:tool:call", event);
    });

    it("does not forward if webContents is destroyed", () => {
      const sender = { send: vi.fn(), isDestroyed: vi.fn().mockReturnValue(true) };
      let capturedHandler: ((evt: unknown) => void) | undefined;
      (kernel.events.on as ReturnType<typeof vi.fn>).mockImplementation(
        (_type: string, handler: (evt: unknown) => void) => {
          capturedHandler = handler;
          return { dispose: vi.fn() };
        },
      );

      handlers["event:subscribe"]({ sender }, { type: "tool:call" });
      capturedHandler!({ id: "e1", type: "tool:call" });

      expect(sender.send).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("wraps thrown errors in IPCError format", async () => {
      (kernel.commands.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Command not found"),
      );
      const result = (await handlers["command:execute"](
        {},
        { commandId: "bad:cmd" },
      )) as { error: { code: string; message: string } };
      expect(result).toHaveProperty("error");
      expect(result.error).toHaveProperty("code", "IPC_ERROR");
      expect(result.error).toHaveProperty("message", "Command not found");
    });
  });
});
