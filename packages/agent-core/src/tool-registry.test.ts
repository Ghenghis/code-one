import { describe, it, expect } from "vitest";
import { ToolRegistryImpl } from "./tool-registry.js";
import type { ToolDefinition, ModeDefinition } from "@code-one/shared-types";

function tool(id: string, overrides?: Partial<ToolDefinition>): ToolDefinition {
  return {
    id,
    name: id,
    description: `Tool ${id}`,
    inputSchema: {},
    sourceTier: 0,
    requiresApproval: false,
    riskLevel: "safe",
    categories: ["general"],
    ...overrides,
  };
}

function mode(id: string, allow: string[] = ["*"], deny: string[] = [], defaultPolicy: "allow" | "deny" | "prompt" = "deny"): ModeDefinition {
  return {
    id: id as ModeDefinition["id"],
    label: id,
    description: `Mode ${id}`,
    systemPrompt: "",
    allowedTools: { allow, deny, defaultPolicy },
    preferredRole: "chat",
    agentSelectable: true,
    group: "builtin",
  };
}

describe("ToolRegistryImpl", () => {
  describe("tool management", () => {
    it("registers and retrieves tools", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("read_file"));
      expect(reg.get("read_file")).toBeDefined();
      expect(reg.size).toBe(1);
    });

    it("throws on duplicate registration", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("read_file"));
      expect(() => reg.register(tool("read_file"))).toThrow("already registered");
    });

    it("unregisters a tool", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("read_file"));
      expect(reg.unregister("read_file")).toBe(true);
      expect(reg.get("read_file")).toBeUndefined();
    });

    it("lists all tools", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("a"));
      reg.register(tool("b"));
      expect(reg.list()).toHaveLength(2);
    });
  });

  describe("mode management", () => {
    it("registers and retrieves modes", () => {
      const reg = new ToolRegistryImpl();
      reg.registerMode(mode("code"));
      expect(reg.getMode("code")).toBeDefined();
    });

    it("lists all modes", () => {
      const reg = new ToolRegistryImpl();
      reg.registerMode(mode("code"));
      reg.registerMode(mode("ask"));
      expect(reg.listModes()).toHaveLength(2);
    });
  });

  describe("isAllowed", () => {
    it("allows tool when in allow list", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("read_file"));
      reg.registerMode(mode("code", ["read_file"], []));

      expect(reg.isAllowed("read_file", "code")).toBe(true);
    });

    it("denies tool when in deny list", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("exec_command"));
      reg.registerMode(mode("ask", ["*"], ["exec_command"]));

      expect(reg.isAllowed("exec_command", "ask")).toBe(false);
    });

    it("deny takes precedence over allow", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("dangerous"));
      reg.registerMode(mode("code", ["*"], ["dangerous"]));

      expect(reg.isAllowed("dangerous", "code")).toBe(false);
    });

    it("uses default policy for unlisted tools", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("unknown_tool"));
      reg.registerMode(mode("code", ["read_file"], [], "deny"));

      expect(reg.isAllowed("unknown_tool", "code")).toBe(false);
    });

    it("allows unlisted tools when default is allow", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("unknown_tool"));
      reg.registerMode(mode("agent", [], [], "allow"));

      expect(reg.isAllowed("unknown_tool", "agent")).toBe(true);
    });

    it("supports glob patterns with trailing *", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("file:read"));
      reg.register(tool("file:write"));
      reg.register(tool("exec:command"));
      reg.registerMode(mode("code", ["file:*"], []));

      expect(reg.isAllowed("file:read", "code")).toBe(true);
      expect(reg.isAllowed("file:write", "code")).toBe(true);
      expect(reg.isAllowed("exec:command", "code")).toBe(false);
    });

    it("returns false for unknown mode", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("read_file"));
      expect(reg.isAllowed("read_file", "custom:nonexistent")).toBe(false);
    });
  });

  describe("listForMode", () => {
    it("returns tools allowed in a mode", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("read_file"));
      reg.register(tool("write_file"));
      reg.register(tool("exec_command"));
      reg.registerMode(mode("ask", ["read_file"], [], "deny"));

      const allowed = reg.listForMode("ask");
      expect(allowed).toHaveLength(1);
      expect(allowed[0].id).toBe("read_file");
    });
  });

  describe("queries", () => {
    it("lists by category", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("a", { categories: ["file"] }));
      reg.register(tool("b", { categories: ["file", "edit"] }));
      reg.register(tool("c", { categories: ["exec"] }));

      expect(reg.listByCategory("file")).toHaveLength(2);
      expect(reg.listByCategory("exec")).toHaveLength(1);
    });

    it("lists tools requiring approval", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("safe", { requiresApproval: false }));
      reg.register(tool("risky", { requiresApproval: true }));
      reg.register(tool("dangerous", { requiresApproval: true }));

      expect(reg.listRequiringApproval()).toHaveLength(2);
    });
  });

  describe("clear", () => {
    it("removes all tools and modes", () => {
      const reg = new ToolRegistryImpl();
      reg.register(tool("a"));
      reg.registerMode(mode("code"));
      reg.clear();

      expect(reg.size).toBe(0);
      expect(reg.listModes()).toHaveLength(0);
    });
  });
});
