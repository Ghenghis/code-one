import { describe, it, expect } from "vitest";
import { PermissionEngine } from "./permission-engine.js";

describe("PermissionEngine", () => {
  it("denies unknown capabilities", async () => {
    const engine = new PermissionEngine();

    const result = await engine.check({
      moduleId: "test",
      capabilityId: "nonexistent",
    });

    expect(result.decision).toBe("deny");
    expect(result.decidedBy).toBe("default");
  });

  it("allows actions with explicit policy grant", async () => {
    const engine = new PermissionEngine();
    engine.registerCapability({
      id: "fs:read",
      description: "Read files",
      trustLevel: "trusted",
    });
    engine.setPolicy({
      moduleId: "editor",
      grants: [{ capabilityId: "fs:read", decision: "allow" }],
    });

    const result = await engine.check({
      moduleId: "editor",
      capabilityId: "fs:read",
    });

    expect(result.decision).toBe("allow");
    expect(result.decidedBy).toBe("policy");
  });

  it("denies actions with explicit policy deny", async () => {
    const engine = new PermissionEngine();
    engine.registerCapability({
      id: "fs:write",
      description: "Write files",
      trustLevel: "guarded",
    });
    engine.setPolicy({
      moduleId: "readonly-viewer",
      grants: [{ capabilityId: "fs:write", decision: "deny" }],
    });

    const result = await engine.check({
      moduleId: "readonly-viewer",
      capabilityId: "fs:write",
    });

    expect(result.decision).toBe("deny");
    expect(result.decidedBy).toBe("policy");
  });

  it("prompts for restricted trust level when no policy exists", async () => {
    const engine = new PermissionEngine();
    engine.registerCapability({
      id: "terminal:execute",
      description: "Execute shell commands",
      trustLevel: "restricted",
    });

    const result = await engine.check({
      moduleId: "agent",
      capabilityId: "terminal:execute",
    });

    expect(result.decision).toBe("prompt");
    expect(result.decidedBy).toBe("trust-level");
  });

  it("prompts for remote trust level actions", async () => {
    const engine = new PermissionEngine();
    engine.registerCapability({
      id: "ssh:connect",
      description: "SSH connection",
      trustLevel: "remote",
    });

    const result = await engine.check({
      moduleId: "remote",
      capabilityId: "ssh:connect",
    });

    expect(result.decision).toBe("prompt");
    expect(result.decidedBy).toBe("trust-level");
  });

  it("hooks can override decisions", async () => {
    const engine = new PermissionEngine();
    engine.registerCapability({
      id: "fs:read",
      description: "Read files",
      trustLevel: "trusted",
    });
    engine.addHook({
      event: "PreToolUse",
      handler: () => "deny",
    });

    const result = await engine.check({
      moduleId: "test",
      capabilityId: "fs:read",
    });

    expect(result.decision).toBe("deny");
    expect(result.decidedBy).toBe("hook");
  });

  it("policy takes priority over hooks", async () => {
    const engine = new PermissionEngine();
    engine.registerCapability({
      id: "fs:read",
      description: "Read files",
      trustLevel: "trusted",
    });
    engine.setPolicy({
      moduleId: "editor",
      grants: [{ capabilityId: "fs:read", decision: "allow" }],
    });
    engine.addHook({
      event: "PreToolUse",
      handler: () => "deny",
    });

    // Policy grant should be evaluated first and returned
    const result = await engine.check({
      moduleId: "editor",
      capabilityId: "fs:read",
    });

    expect(result.decision).toBe("allow");
    expect(result.decidedBy).toBe("policy");
  });

  it("evaluates mode-match condition", async () => {
    const engine = new PermissionEngine();
    engine.registerCapability({
      id: "fs:write",
      description: "Write files",
      trustLevel: "guarded",
    });
    engine.setPolicy({
      moduleId: "agent",
      grants: [
        {
          capabilityId: "fs:write",
          decision: "allow",
          conditions: [{ type: "mode-match", value: "code" }],
        },
      ],
    });

    const allowed = await engine.check({
      moduleId: "agent",
      capabilityId: "fs:write",
      context: { mode: "code" },
    });
    expect(allowed.decision).toBe("allow");

    const denied = await engine.check({
      moduleId: "agent",
      capabilityId: "fs:write",
      context: { mode: "ask" },
    });
    expect(denied.decision).toBe("deny");
  });

  it("clearHooks removes hooks for an event", async () => {
    const engine = new PermissionEngine();
    engine.registerCapability({
      id: "fs:read",
      description: "Read",
      trustLevel: "trusted",
    });
    engine.addHook({
      event: "PreToolUse",
      handler: () => "deny",
    });

    engine.clearHooks("PreToolUse");

    // With hooks cleared and no policy, default-deny kicks in
    const result = await engine.check({
      moduleId: "test",
      capabilityId: "fs:read",
    });
    expect(result.decision).toBe("deny");
    expect(result.decidedBy).toBe("default");
  });

  it("lists registered capabilities", () => {
    const engine = new PermissionEngine();
    engine.registerCapability({
      id: "fs:read",
      description: "Read",
      trustLevel: "trusted",
    });
    engine.registerCapability({
      id: "fs:write",
      description: "Write",
      trustLevel: "guarded",
    });

    const caps = engine.listCapabilities();
    expect(caps).toHaveLength(2);
    expect(caps.map((c) => c.id)).toEqual(["fs:read", "fs:write"]);
  });

  it("removes policies", () => {
    const engine = new PermissionEngine();
    engine.setPolicy({
      moduleId: "test",
      grants: [{ capabilityId: "fs:read", decision: "allow" }],
    });

    expect(engine.getPolicy("test")).toBeDefined();
    engine.removePolicy("test");
    expect(engine.getPolicy("test")).toBeUndefined();
  });
});
