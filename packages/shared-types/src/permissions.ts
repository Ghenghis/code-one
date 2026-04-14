/**
 * Permission engine type contracts.
 *
 * Capability-based access control with trust levels.
 * Three-layer evaluation: mode permissions → auto-approve rules → hooks.
 */

import type { TrustLevel } from "./events.js";

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

export interface Capability {
  /** Unique capability ID, e.g. "fs:read", "terminal:execute", "agent:spawn" */
  id: string;
  /** Human-readable description */
  description: string;
  /** Minimum trust level required */
  trustLevel: TrustLevel;
  /** Category for grouping in UI */
  category?: string;
}

// ---------------------------------------------------------------------------
// Permission policies
// ---------------------------------------------------------------------------

export type PermissionDecision = "allow" | "deny" | "prompt";

export interface PermissionPolicy {
  /** Module this policy applies to */
  moduleId: string;
  /** Granted capabilities */
  grants: PermissionGrant[];
}

export interface PermissionGrant {
  /** Capability ID */
  capabilityId: string;
  /** Whether this is auto-approved, always denied, or requires prompt */
  decision: PermissionDecision;
  /** Optional conditions for this grant */
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  /** Type of condition */
  type: "path-glob" | "command-allowlist" | "mode-match" | "custom";
  /** Condition value */
  value: string;
}

// ---------------------------------------------------------------------------
// Permission check
// ---------------------------------------------------------------------------

export interface PermissionRequest {
  /** Module requesting the permission */
  moduleId: string;
  /** Capability being requested */
  capabilityId: string;
  /** Context for the request (varies by capability) */
  context?: Record<string, unknown>;
}

export interface PermissionResult {
  decision: PermissionDecision;
  /** Why this decision was made */
  reason: string;
  /** Which layer made the decision */
  decidedBy: "policy" | "trust-level" | "hook" | "default";
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export type HookEvent = "PreToolUse" | "PostToolUse" | "PreEdit" | "PreCommand";

export interface ToolHook {
  event: HookEvent;
  handler: (context: HookContext) => PermissionDecision | Promise<PermissionDecision>;
}

export interface HookContext {
  /** The tool or action being invoked */
  action: string;
  /** Arguments to the action */
  args: Record<string, unknown>;
  /** Module requesting the action */
  moduleId: string;
  /** Current mode slug */
  mode?: string;
}

// ---------------------------------------------------------------------------
// PermissionEngine interface
// ---------------------------------------------------------------------------

export interface IPermissionEngine {
  /** Register a capability */
  registerCapability(capability: Capability): void;
  /** Set a permission policy for a module */
  setPolicy(policy: PermissionPolicy): void;
  /** Remove a policy for a module */
  removePolicy(moduleId: string): void;
  /** Check whether an action is permitted */
  check(request: PermissionRequest): Promise<PermissionResult>;
  /** Register a hook */
  addHook(hook: ToolHook): void;
  /** Remove all hooks for an event */
  clearHooks(event: HookEvent): void;
  /** List all registered capabilities */
  listCapabilities(): ReadonlyArray<Capability>;
  /** Get a specific policy */
  getPolicy(moduleId: string): PermissionPolicy | undefined;
}
