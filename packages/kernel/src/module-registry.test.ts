import { describe, it, expect } from "vitest";
import { ModuleRegistry } from "./module-registry.js";
import { EventBus } from "./event-bus.js";
import type { ModuleManifest } from "@code-one/shared-types";

function manifest(id: string, tier: number, deps?: string[], provides?: string[]): ModuleManifest {
  return {
    id,
    name: id,
    version: "0.1.0",
    tier,
    dependencies: deps,
    provides,
  };
}

describe("ModuleRegistry", () => {
  it("registers a module", () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("test", 0), {});

    expect(registry.has("test")).toBe(true);
    expect(registry.getStatus("test")).toBe("registered");
  });

  it("throws on duplicate registration", () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("test", 0), {});

    expect(() => registry.register(manifest("test", 0), {})).toThrow(
      "Module already registered: test",
    );
  });

  it("activates modules in dependency order", async () => {
    const order: string[] = [];
    const registry = new ModuleRegistry();

    registry.register(manifest("base", 0), {
      activate: () => {
        order.push("base");
      },
    });
    registry.register(manifest("mid", 1, ["base"]), {
      activate: () => {
        order.push("mid");
      },
    });
    registry.register(manifest("top", 2, ["mid"]), {
      activate: () => {
        order.push("top");
      },
    });

    await registry.activateAll();

    expect(order).toEqual(["base", "mid", "top"]);
    expect(registry.getStatus("base")).toBe("active");
    expect(registry.getStatus("mid")).toBe("active");
    expect(registry.getStatus("top")).toBe("active");
  });

  it("deactivates modules in reverse dependency order", async () => {
    const order: string[] = [];
    const registry = new ModuleRegistry();

    registry.register(manifest("base", 0), {
      deactivate: () => {
        order.push("base");
      },
    });
    registry.register(manifest("top", 1, ["base"]), {
      deactivate: () => {
        order.push("top");
      },
    });

    await registry.activateAll();
    await registry.deactivateAll();

    expect(order).toEqual(["top", "base"]);
  });

  it("enforces tier constraint on registration", () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("high", 2), {});

    expect(() => registry.register(manifest("low", 1, ["high"]), {})).toThrow("Tier violation");
  });

  it("detects circular dependencies", async () => {
    const registry = new ModuleRegistry();
    // We can't create a true circular with tier enforcement,
    // but same-tier circular should be caught by topo sort
    registry.register(manifest("a", 0, ["b"]), {});
    registry.register(manifest("b", 0, ["a"]), {});

    await expect(registry.activateAll()).rejects.toThrow("Circular dependency");
  });

  it("fails activation if dependency is missing", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("orphan", 1, ["missing"]), {});

    await expect(registry.activateAll()).rejects.toThrow("Missing dependency");
  });

  it("tracks capabilities from active modules", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("fs", 0, [], ["fs:read", "fs:write"]), {});

    expect(registry.hasCapability("fs:read")).toBe(false);

    await registry.activateAll();
    expect(registry.hasCapability("fs:read")).toBe(true);
    expect(registry.hasCapability("fs:write")).toBe(true);
    expect(registry.hasCapability("nope")).toBe(false);
  });

  it("prevents unregistering a module with active dependents", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("base", 0), {});
    registry.register(manifest("child", 1, ["base"]), {});
    await registry.activateAll();

    await expect(registry.unregister("base")).rejects.toThrow(
      "Cannot unregister base: child depends on it",
    );
  });

  it("allows unregistering a module with no dependents", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("standalone", 0), {});
    await registry.activateAll();

    await registry.unregister("standalone");
    expect(registry.has("standalone")).toBe(false);
  });

  it("emits lifecycle events to event bus", async () => {
    const eventBus = new EventBus();
    const events: string[] = [];
    eventBus.onAny((e) => {
      const payload = (e as unknown as { payload: { moduleId: string; status: string } }).payload;
      events.push(`${payload.moduleId}:${payload.status}`);
    });

    const registry = new ModuleRegistry(eventBus);
    registry.register(manifest("mod", 0), {});
    await registry.activateAll();

    expect(events).toContain("mod:registered");
    expect(events).toContain("mod:initializing");
    expect(events).toContain("mod:ready");
    expect(events).toContain("mod:active");
  });

  it("lists all modules", () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("a", 0), {});
    registry.register(manifest("b", 1), {});

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.manifest.id)).toEqual(["a", "b"]);
  });

  it("handles init errors gracefully", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("bad", 0), {
      init: () => {
        throw new Error("init failed");
      },
    });

    await expect(registry.activateAll()).rejects.toThrow(
      "Module bad failed to activate: init failed",
    );
    expect(registry.getStatus("bad")).toBe("error");
  });
});
