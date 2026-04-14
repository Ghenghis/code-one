/**
 * Mode and tool system type contracts (Tier 4).
 *
 * Based on KiloCode/Claude Code mode patterns:
 * - Modes define scoped autonomy levels
 * - Tools are registered capabilities with schemas
 * - Each mode grants/denies specific tool access
 */

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

export type BuiltinModeId = "ask" | "architect" | "code" | "debug" | "agent";

export type ModeId = BuiltinModeId | `custom:${string}`;

export interface ModeDefinition {
  id: ModeId;
  /** Human-readable label */
  label: string;
  /** Short description shown in mode picker */
  description: string;
  /** System prompt injected when this mode is active */
  systemPrompt: string;
  /** Tools this mode is allowed to use */
  allowedTools: ToolPermissionSet;
  /** Default model role preference for this mode */
  preferredRole: import("./providers.js").ModelRole;
  /** Whether the agent can switch to this mode autonomously */
  agentSelectable: boolean;
  /** Group for UI display */
  group: "builtin" | "custom";
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export type ToolId = string;

export interface ToolDefinition {
  id: ToolId;
  /** Human-readable name */
  name: string;
  /** What this tool does */
  description: string;
  /** JSON Schema for tool input */
  inputSchema: Record<string, unknown>;
  /** JSON Schema for tool output */
  outputSchema?: Record<string, unknown>;
  /** Which tier provides this tool */
  sourceTier: number;
  /** Whether this tool requires approval before execution */
  requiresApproval: boolean;
  /** Risk level for approval broker */
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  /** Categories for filtering */
  categories: string[];
}

export interface ToolPermissionSet {
  /** Explicitly allowed tool IDs or patterns (glob) */
  allow: string[];
  /** Explicitly denied tool IDs or patterns (glob) */
  deny: string[];
  /** Default for tools not in allow/deny lists */
  defaultPolicy: "allow" | "deny" | "prompt";
}

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

export interface ToolRegistry {
  /** Register a tool definition */
  register(tool: ToolDefinition): void;
  /** Unregister by ID */
  unregister(toolId: ToolId): void;
  /** Get a tool by ID */
  get(toolId: ToolId): ToolDefinition | undefined;
  /** List all registered tools */
  list(): ToolDefinition[];
  /** List tools available for a given mode */
  listForMode(modeId: ModeId): ToolDefinition[];
  /** Check if a tool is allowed in a mode */
  isAllowed(toolId: ToolId, modeId: ModeId): boolean;
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

export interface ToolCall {
  /** Unique call ID */
  id: string;
  /** Tool being called */
  toolId: ToolId;
  /** Input arguments */
  input: Record<string, unknown>;
  /** Mode under which this call was made */
  modeId: ModeId;
  /** Whether approval was required and granted */
  approval: ApprovalState;
  /** Timestamp of call */
  timestamp: number;
}

export type ApprovalState =
  | { status: "not-required" }
  | { status: "pending" }
  | { status: "approved"; approvedBy: "user" | "auto"; approvedAt: number }
  | { status: "denied"; deniedBy: "user" | "policy"; deniedAt: number; reason: string };

export interface ToolResult {
  callId: string;
  toolId: ToolId;
  /** Whether the tool succeeded */
  success: boolean;
  /** Output data */
  output: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution time in ms */
  durationMs: number;
}
