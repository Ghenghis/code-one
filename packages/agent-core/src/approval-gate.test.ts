import { describe, it, expect } from "vitest";
import { ApprovalGate } from "./approval-gate.js";
import type { ToolDefinition, TrustLevel } from "@code-one/shared-types";

function tool(overrides?: Partial<ToolDefinition>): ToolDefinition {
  return {
    id: "test_tool",
    name: "Test Tool",
    description: "A test tool",
    inputSchema: {},
    sourceTier: 0,
    requiresApproval: false,
    riskLevel: "safe",
    categories: [],
    ...overrides,
  };
}

describe("ApprovalGate", () => {
  describe("requiresApproval", () => {
    it("auto-approves safe tools with trusted trust", () => {
      const gate = new ApprovalGate();
      expect(gate.requiresApproval(tool({ riskLevel: "safe" }), "trusted")).toBe(false);
    });

    it("auto-approves safe tools with guarded trust", () => {
      const gate = new ApprovalGate();
      expect(gate.requiresApproval(tool({ riskLevel: "safe" }), "guarded")).toBe(false);
    });

    it("requires approval for remote trust regardless of risk", () => {
      const gate = new ApprovalGate();
      expect(gate.requiresApproval(tool({ riskLevel: "safe" }), "remote")).toBe(true);
    });

    it("requires approval when tool has requiresApproval flag", () => {
      const gate = new ApprovalGate();
      expect(gate.requiresApproval(tool({ requiresApproval: true }), "trusted")).toBe(true);
    });

    it("auto-approves low risk for trusted/guarded", () => {
      const gate = new ApprovalGate();
      expect(gate.requiresApproval(tool({ riskLevel: "low" }), "trusted")).toBe(false);
      expect(gate.requiresApproval(tool({ riskLevel: "low" }), "guarded")).toBe(false);
    });

    it("requires approval for low risk with restricted trust", () => {
      const gate = new ApprovalGate();
      expect(gate.requiresApproval(tool({ riskLevel: "low" }), "restricted")).toBe(true);
    });

    it("requires approval for medium+ risk", () => {
      const gate = new ApprovalGate();
      const levels: TrustLevel[] = ["trusted", "guarded", "restricted"];
      for (const trust of levels) {
        expect(gate.requiresApproval(tool({ riskLevel: "medium" }), trust)).toBe(true);
        expect(gate.requiresApproval(tool({ riskLevel: "high" }), trust)).toBe(true);
        expect(gate.requiresApproval(tool({ riskLevel: "critical" }), trust)).toBe(true);
      }
    });
  });

  describe("request", () => {
    it("auto-approves when approval not required", () => {
      const gate = new ApprovalGate();
      const result = gate.request(tool({ riskLevel: "safe" }), "trusted", "read a file");

      expect(result.state.status).toBe("approved");
      if (result.state.status === "approved") {
        expect(result.state.approvedBy).toBe("auto");
      }
      expect(gate.pendingCount).toBe(0);
    });

    it("creates pending approval for risky actions", () => {
      const gate = new ApprovalGate();
      const result = gate.request(tool({ riskLevel: "high" }), "trusted", "delete files");

      expect(result.state.status).toBe("pending");
      expect(gate.pendingCount).toBe(1);
    });

    it("returns unique IDs", () => {
      const gate = new ApprovalGate();
      const r1 = gate.request(tool({ riskLevel: "high" }), "trusted", "a");
      const r2 = gate.request(tool({ riskLevel: "high" }), "trusted", "b");
      expect(r1.id).not.toBe(r2.id);
    });
  });

  describe("approve", () => {
    it("approves a pending request", () => {
      const gate = new ApprovalGate();
      const pending = gate.request(tool({ riskLevel: "high" }), "trusted", "dangerous op");

      const result = gate.approve(pending.id);
      expect(result).toBeDefined();
      expect(result!.state.status).toBe("approved");
      if (result!.state.status === "approved") {
        expect(result!.state.approvedBy).toBe("user");
      }
      expect(gate.pendingCount).toBe(0);
    });

    it("returns undefined for unknown ID", () => {
      const gate = new ApprovalGate();
      expect(gate.approve("nope")).toBeUndefined();
    });

    it("returns undefined for already-resolved request", () => {
      const gate = new ApprovalGate();
      const pending = gate.request(tool({ riskLevel: "high" }), "trusted", "op");
      gate.approve(pending.id);

      expect(gate.approve(pending.id)).toBeUndefined();
    });
  });

  describe("deny", () => {
    it("denies a pending request", () => {
      const gate = new ApprovalGate();
      const pending = gate.request(tool({ riskLevel: "high" }), "trusted", "op");

      const result = gate.deny(pending.id, "too risky");
      expect(result).toBeDefined();
      expect(result!.state.status).toBe("denied");
      if (result!.state.status === "denied") {
        expect(result!.state.reason).toBe("too risky");
      }
      expect(gate.pendingCount).toBe(0);
    });
  });

  describe("listPending", () => {
    it("lists all pending approvals", () => {
      const gate = new ApprovalGate();
      gate.request(tool({ riskLevel: "high" }), "trusted", "a");
      gate.request(tool({ riskLevel: "medium" }), "trusted", "b");

      expect(gate.listPending()).toHaveLength(2);
    });
  });
});
