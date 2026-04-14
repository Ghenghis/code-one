import type {
  ApprovalState,
  TrustLevel,
  ToolDefinition,
} from "@code-one/shared-types";

/**
 * Pending approval request tracked by the gate.
 */
export interface PendingApproval {
  id: string;
  toolId: string;
  action: string;
  description: string;
  trustLevel: TrustLevel;
  riskLevel: ToolDefinition["riskLevel"];
  state: ApprovalState;
  createdAt: number;
}

/**
 * Approval gate for risky agent actions.
 *
 * Determines whether a tool call needs approval based on trust level
 * and risk level. Tracks pending approvals and resolves them.
 *
 * Rules:
 * - "safe" risk: auto-approve unless trust is "remote"
 * - "low" risk: auto-approve for "trusted" and "guarded" trust
 * - "medium"+ risk: always requires approval
 * - "remote" trust: always requires approval regardless of risk
 */
export class ApprovalGate {
  private _pending = new Map<string, PendingApproval>();
  private _idCounter = 0;

  /**
   * Check whether a tool call requires approval.
   */
  requiresApproval(
    tool: ToolDefinition,
    trustLevel: TrustLevel,
  ): boolean {
    // Remote trust always needs approval
    if (trustLevel === "remote") return true;

    // Explicit tool flag
    if (tool.requiresApproval) return true;

    // Risk-based rules
    switch (tool.riskLevel) {
      case "safe":
        return false;
      case "low":
        return trustLevel === "restricted" || trustLevel === "isolated";
      case "medium":
      case "high":
      case "critical":
        return true;
    }
  }

  /**
   * Request approval for an action. Returns the approval ID.
   * If approval is not required, returns an auto-approved state.
   */
  request(
    tool: ToolDefinition,
    trustLevel: TrustLevel,
    description: string,
  ): PendingApproval {
    const id = `approval_${++this._idCounter}`;

    if (!this.requiresApproval(tool, trustLevel)) {
      const approval: PendingApproval = {
        id,
        toolId: tool.id,
        action: tool.name,
        description,
        trustLevel,
        riskLevel: tool.riskLevel,
        state: { status: "approved", approvedBy: "auto", approvedAt: Date.now() },
        createdAt: Date.now(),
      };
      return approval;
    }

    const approval: PendingApproval = {
      id,
      toolId: tool.id,
      action: tool.name,
      description,
      trustLevel,
      riskLevel: tool.riskLevel,
      state: { status: "pending" },
      createdAt: Date.now(),
    };
    this._pending.set(id, approval);
    return approval;
  }

  /** Approve a pending request. */
  approve(approvalId: string): PendingApproval | undefined {
    const approval = this._pending.get(approvalId);
    if (!approval || approval.state.status !== "pending") return undefined;

    approval.state = {
      status: "approved",
      approvedBy: "user",
      approvedAt: Date.now(),
    };
    this._pending.delete(approvalId);
    return approval;
  }

  /** Deny a pending request. */
  deny(approvalId: string, reason: string): PendingApproval | undefined {
    const approval = this._pending.get(approvalId);
    if (!approval || approval.state.status !== "pending") return undefined;

    approval.state = {
      status: "denied",
      deniedBy: "user",
      deniedAt: Date.now(),
      reason,
    };
    this._pending.delete(approvalId);
    return approval;
  }

  /** Get a pending approval by ID. */
  getPending(approvalId: string): PendingApproval | undefined {
    return this._pending.get(approvalId);
  }

  /** List all pending approvals. */
  listPending(): PendingApproval[] {
    return [...this._pending.values()];
  }

  /** Number of pending approvals. */
  get pendingCount(): number {
    return this._pending.size;
  }

  /** Clear all pending approvals. */
  clear(): void {
    this._pending.clear();
  }
}
