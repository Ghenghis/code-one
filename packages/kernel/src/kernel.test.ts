import { describe, it, expect } from "vitest";
import { createKernel } from "./index.js";

describe("createKernel", () => {
  it("creates a kernel with all subsystems", () => {
    const kernel = createKernel({ logLevel: "error" });

    expect(kernel.events).toBeDefined();
    expect(kernel.commands).toBeDefined();
    expect(kernel.modules).toBeDefined();
    expect(kernel.permissions).toBeDefined();
    expect(kernel.settings).toBeDefined();
    expect(kernel.layout).toBeDefined();
    expect(kernel.loggerFactory).toBeDefined();
    expect(kernel.logger).toBeDefined();
    expect(kernel.shutdown).toBeDefined();
  });

  it("shutdown completes without error", async () => {
    const kernel = createKernel({ logLevel: "error" });

    // Register and activate a module so shutdown has work to do
    kernel.modules.register(
      {
        id: "test",
        name: "Test Module",
        version: "0.1.0",
        tier: 0,
      },
      {
        activate: () => {},
        deactivate: () => {},
      },
    );
    await kernel.modules.activateAll();

    await expect(kernel.shutdown()).resolves.toBeUndefined();
  });

  it("respects logLevel config", () => {
    const kernel = createKernel({ logLevel: "debug" });
    expect(kernel.loggerFactory.getLevel()).toBe("debug");
  });

  it("defaults to info log level", () => {
    const kernel = createKernel();
    expect(kernel.loggerFactory.getLevel()).toBe("info");
  });

  it("event bus is wired to module registry", async () => {
    const kernel = createKernel({ logLevel: "error" });
    const events: string[] = [];
    kernel.events.onAny((e) => {
      if (e.type === "module:lifecycle") {
        events.push(e.type);
      }
    });

    kernel.modules.register({ id: "evtest", name: "EventTest", version: "0.1.0", tier: 0 }, {});
    await kernel.modules.activateAll();

    expect(events.length).toBeGreaterThan(0);
  });

  it("supports full lifecycle: register module, execute command, check permission", async () => {
    const kernel = createKernel({ logLevel: "error" });

    // Register a module
    kernel.modules.register(
      {
        id: "workspace",
        name: "Workspace",
        version: "0.1.0",
        tier: 1,
        provides: ["fs:read", "fs:write"],
      },
      {},
    );
    await kernel.modules.activateAll();

    // Register a command
    kernel.commands.register(
      { id: "workspace:open", title: "Open File" },
      (ctx) => `opened ${ctx.args["path"]}`,
    );

    // Execute command
    const result = await kernel.commands.execute("workspace:open", {
      args: { path: "/src/index.ts" },
    });
    expect(result).toBe("opened /src/index.ts");

    // Register and check permission
    kernel.permissions.registerCapability({
      id: "fs:read",
      description: "Read files",
      trustLevel: "trusted",
    });
    kernel.permissions.setPolicy({
      moduleId: "workspace",
      grants: [{ capabilityId: "fs:read", decision: "allow" }],
    });

    const permResult = await kernel.permissions.check({
      moduleId: "workspace",
      capabilityId: "fs:read",
    });
    expect(permResult.decision).toBe("allow");

    // Check capabilities
    expect(kernel.modules.hasCapability("fs:read")).toBe(true);

    await kernel.shutdown();
  });
});
