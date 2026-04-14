import type {
  Capability,
  HookEvent,
  IPermissionEngine,
  PermissionPolicy,
  PermissionRequest,
  PermissionResult,
  ToolHook,
  TrustLevel,
} from "@code-one/shared-types";

/** Ordered trust levels from least to most restrictive */
const TRUST_ORDER: TrustLevel[] = ["trusted", "guarded", "restricted", "isolated", "remote"];

/**
 * Capability-based permission engine with three-layer evaluation:
 *
 * 1. Policy layer: explicit grants per module
 * 2. Trust-level layer: minimum trust requirement per capability
 * 3. Hook layer: programmable pre/post checks
 *
 * Default-deny: if no policy explicitly allows an action, it is denied.
 */
export class PermissionEngine implements IPermissionEngine {
  private capabilities = new Map<string, Capability>();
  private policies = new Map<string, PermissionPolicy>();
  private hooks = new Map<HookEvent, ToolHook[]>();

  registerCapability(capability: Capability): void {
    this.capabilities.set(capability.id, capability);
  }

  setPolicy(policy: PermissionPolicy): void {
    this.policies.set(policy.moduleId, policy);
  }

  removePolicy(moduleId: string): void {
    this.policies.delete(moduleId);
  }

  async check(request: PermissionRequest): Promise<PermissionResult> {
    const capability = this.capabilities.get(request.capabilityId);
    if (!capability) {
      return {
        decision: "deny",
        reason: `Unknown capability: ${request.capabilityId}`,
        decidedBy: "default",
      };
    }

    // Layer 1: Check explicit policy
    const policy = this.policies.get(request.moduleId);
    if (policy) {
      const grant = policy.grants.find((g) => g.capabilityId === request.capabilityId);
      if (grant) {
        // Check conditions if any
        if (grant.conditions && grant.conditions.length > 0) {
          const conditionsMet = this.evaluateConditions(grant.conditions, request);
          if (!conditionsMet) {
            return {
              decision: "deny",
              reason: `Policy conditions not met for ${request.capabilityId}`,
              decidedBy: "policy",
            };
          }
        }
        return {
          decision: grant.decision,
          reason: `Policy grant for ${request.moduleId}`,
          decidedBy: "policy",
        };
      }
    }

    // Layer 2: Check trust level
    const requiredLevel = capability.trustLevel;
    const requiredIndex = TRUST_ORDER.indexOf(requiredLevel);
    if (requiredIndex >= TRUST_ORDER.indexOf("restricted")) {
      return {
        decision: "prompt",
        reason: `Capability ${request.capabilityId} requires trust level: ${requiredLevel}`,
        decidedBy: "trust-level",
      };
    }

    // Layer 3: Run hooks
    const preHooks = this.hooks.get("PreToolUse") ?? [];
    for (const hook of preHooks) {
      const hookResult = await hook.handler({
        action: request.capabilityId,
        args: (request.context ?? {}) as Record<string, unknown>,
        moduleId: request.moduleId,
      });
      if (hookResult !== "allow") {
        return {
          decision: hookResult,
          reason: `Hook returned ${hookResult} for ${request.capabilityId}`,
          decidedBy: "hook",
        };
      }
    }

    // Default: deny anything not explicitly allowed
    return {
      decision: "deny",
      reason: `No policy found for ${request.moduleId}:${request.capabilityId}`,
      decidedBy: "default",
    };
  }

  addHook(hook: ToolHook): void {
    let list = this.hooks.get(hook.event);
    if (!list) {
      list = [];
      this.hooks.set(hook.event, list);
    }
    list.push(hook);
  }

  clearHooks(event: HookEvent): void {
    this.hooks.delete(event);
  }

  listCapabilities(): ReadonlyArray<Capability> {
    return Array.from(this.capabilities.values());
  }

  getPolicy(moduleId: string): PermissionPolicy | undefined {
    return this.policies.get(moduleId);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private evaluateConditions(
    conditions: { type: string; value: string }[],
    request: PermissionRequest,
  ): boolean {
    for (const condition of conditions) {
      switch (condition.type) {
        case "mode-match": {
          const currentMode = request.context?.["mode"] as string | undefined;
          if (currentMode !== condition.value) return false;
          break;
        }
        case "path-glob": {
          const targetPath = request.context?.["path"] as string | undefined;
          if (!targetPath) return false;
          // Simple glob: just check prefix for now. Full glob matching
          // will be added when the workspace module provides minimatch.
          if (!targetPath.startsWith(condition.value.replace("*", ""))) {
            return false;
          }
          break;
        }
        // command-allowlist and custom conditions are evaluated at runtime
        // by the hook layer. Skip here.
        default:
          break;
      }
    }
    return true;
  }
}
