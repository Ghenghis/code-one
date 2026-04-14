import type {
  ToolDefinition,
  ToolId,
  ToolPermissionSet,
  ModeId,
  ModeDefinition,
} from "@code-one/shared-types";

/**
 * Check if a tool ID matches a permission pattern.
 * Supports exact match and glob patterns with trailing `*`.
 */
function matchesPattern(toolId: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) {
    return toolId.startsWith(pattern.slice(0, -1));
  }
  return toolId === pattern;
}

/**
 * Registry for agent tools.
 *
 * Manages tool definitions and resolves mode-based access control.
 * Each mode has an allow/deny list with glob patterns, plus a default
 * policy for unlisted tools.
 */
export class ToolRegistryImpl {
  private _tools = new Map<ToolId, ToolDefinition>();
  private _modes = new Map<ModeId, ModeDefinition>();

  // -- Tool management -------------------------------------------------------

  register(tool: ToolDefinition): void {
    if (this._tools.has(tool.id)) {
      throw new Error(`Tool already registered: ${tool.id}`);
    }
    this._tools.set(tool.id, tool);
  }

  unregister(toolId: ToolId): boolean {
    return this._tools.delete(toolId);
  }

  get(toolId: ToolId): ToolDefinition | undefined {
    return this._tools.get(toolId);
  }

  list(): ToolDefinition[] {
    return [...this._tools.values()];
  }

  // -- Mode management -------------------------------------------------------

  registerMode(mode: ModeDefinition): void {
    this._modes.set(mode.id, mode);
  }

  getMode(modeId: ModeId): ModeDefinition | undefined {
    return this._modes.get(modeId);
  }

  listModes(): ModeDefinition[] {
    return [...this._modes.values()];
  }

  // -- Permission resolution -------------------------------------------------

  /**
   * Check if a tool is allowed in a mode.
   *
   * Resolution order:
   * 1. Deny list (explicit deny wins)
   * 2. Allow list (explicit allow)
   * 3. Default policy
   */
  isAllowed(toolId: ToolId, modeId: ModeId): boolean {
    const mode = this._modes.get(modeId);
    if (!mode) return false;

    return this._resolvePermission(toolId, mode.allowedTools);
  }

  /**
   * List tools available for a given mode.
   */
  listForMode(modeId: ModeId): ToolDefinition[] {
    return this.list().filter((t) => this.isAllowed(t.id, modeId));
  }

  /**
   * Resolve permission from a ToolPermissionSet.
   */
  private _resolvePermission(toolId: ToolId, perms: ToolPermissionSet): boolean {
    // Check deny list first
    for (const pattern of perms.deny) {
      if (matchesPattern(toolId, pattern)) return false;
    }

    // Check allow list
    for (const pattern of perms.allow) {
      if (matchesPattern(toolId, pattern)) return true;
    }

    // Fall back to default
    return perms.defaultPolicy === "allow";
  }

  // -- Queries ---------------------------------------------------------------

  /** List tools by category. */
  listByCategory(category: string): ToolDefinition[] {
    return this.list().filter((t) => t.categories.includes(category));
  }

  /** List tools that require approval. */
  listRequiringApproval(): ToolDefinition[] {
    return this.list().filter((t) => t.requiresApproval);
  }

  get size(): number {
    return this._tools.size;
  }

  clear(): void {
    this._tools.clear();
    this._modes.clear();
  }
}
