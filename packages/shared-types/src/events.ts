/**
 * Event system type contracts.
 *
 * Based on OpenHands' append-only EventStream pattern:
 * - Every agent action, tool call, and state change is an event
 * - Events are immutable, timestamped, and causally linked
 * - The event stream is the single source of truth
 */

// ---------------------------------------------------------------------------
// Base event
// ---------------------------------------------------------------------------

export interface BaseEvent {
  /** Globally unique event ID (UUID v4) */
  id: string;
  /** Unix epoch ms */
  timestamp: number;
  /** What produced this event */
  source: EventSource;
  /** ID of the event that caused this one (causation chain) */
  parentId?: string;
  /** Session this event belongs to */
  sessionId: string;
  /** Discriminator */
  type: string;
}

export type EventSource = "user" | "agent" | "system" | "subagent";

// ---------------------------------------------------------------------------
// Concrete event types
// ---------------------------------------------------------------------------

export interface UserMessageEvent extends BaseEvent {
  type: "user:message";
  payload: { text: string; attachments?: string[] };
}

export interface AssistantMessageEvent extends BaseEvent {
  type: "assistant:message";
  payload: { text: string; model?: string; provider?: string };
}

export interface ToolCallEvent extends BaseEvent {
  type: "tool:call";
  payload: {
    toolName: string;
    args: Record<string, unknown>;
    /** Trust level required for this tool */
    trustLevel: TrustLevel;
  };
}

export interface ToolResultEvent extends BaseEvent {
  type: "tool:result";
  payload: {
    toolName: string;
    /** Correlates to the ToolCallEvent */
    callEventId: string;
    result: unknown;
    success: boolean;
    durationMs: number;
  };
}

export interface PlanEvent extends BaseEvent {
  type: "agent:plan";
  payload: { steps: PlanStep[] };
}

export interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
}

export interface EditProposalEvent extends BaseEvent {
  type: "agent:edit-proposal";
  payload: {
    files: FileEdit[];
    format: EditFormat;
  };
}

export interface FileEdit {
  filePath: string;
  hunks: EditHunk[];
}

export interface EditHunk {
  oldText: string;
  newText: string;
  startLine?: number;
}

export type EditFormat = "search-replace" | "whole-file" | "unified-diff" | "patch";

export interface ApprovalRequestEvent extends BaseEvent {
  type: "approval:request";
  payload: {
    action: string;
    description: string;
    /** The event that triggered this approval request */
    triggerEventId: string;
    trustLevel: TrustLevel;
    /** Optional diff preview */
    diff?: string;
  };
}

export interface ApprovalResponseEvent extends BaseEvent {
  type: "approval:response";
  payload: {
    /** The approval request this responds to */
    requestEventId: string;
    decision: "approved" | "denied" | "modified";
    reason?: string;
  };
}

export interface CheckpointEvent extends BaseEvent {
  type: "session:checkpoint";
  payload: {
    stepNumber: number;
    stateSnapshot: Record<string, unknown>;
  };
}

export interface SubagentSpawnEvent extends BaseEvent {
  type: "subagent:spawn";
  payload: {
    childSessionId: string;
    mode: string;
    prompt: string;
    tools: string[];
  };
}

export interface SubagentResultEvent extends BaseEvent {
  type: "subagent:result";
  payload: {
    childSessionId: string;
    result: unknown;
    success: boolean;
  };
}

export interface ErrorEvent extends BaseEvent {
  type: "system:error";
  payload: {
    code: string;
    message: string;
    stack?: string;
    recoverable: boolean;
  };
}

export interface ModeChangeEvent extends BaseEvent {
  type: "agent:mode-change";
  payload: {
    from: string;
    to: string;
  };
}

export interface MemoryWriteEvent extends BaseEvent {
  type: "memory:write";
  payload: {
    scope: MemoryScope;
    key: string;
    value: unknown;
  };
}

export type MemoryScope = "turn" | "session" | "project" | "user";

// ---------------------------------------------------------------------------
// Trust levels
// ---------------------------------------------------------------------------

export type TrustLevel =
  | "trusted" // read-only ops
  | "guarded" // local mutations
  | "restricted" // system access
  | "isolated" // untrusted code execution
  | "remote"; // external systems — always requires approval

// ---------------------------------------------------------------------------
// Event union
// ---------------------------------------------------------------------------

export type AgentEvent =
  | UserMessageEvent
  | AssistantMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | PlanEvent
  | EditProposalEvent
  | ApprovalRequestEvent
  | ApprovalResponseEvent
  | CheckpointEvent
  | SubagentSpawnEvent
  | SubagentResultEvent
  | ErrorEvent
  | ModeChangeEvent
  | MemoryWriteEvent;

/** Extract the type string from an event union member */
export type EventType = AgentEvent["type"];

// ---------------------------------------------------------------------------
// EventBus interface
// ---------------------------------------------------------------------------

export interface Disposable {
  dispose(): void;
}

export type EventHandler<E extends BaseEvent = BaseEvent> = (event: E) => void | Promise<void>;

export interface IEventBus {
  /** Emit an event to all subscribers */
  emit<E extends BaseEvent>(event: E): void;
  /** Subscribe to a specific event type */
  on<E extends BaseEvent>(type: string, handler: EventHandler<E>): Disposable;
  /** Subscribe to all events */
  onAny(handler: EventHandler): Disposable;
  /** Get event history, optionally filtered by type */
  history(type?: string): ReadonlyArray<BaseEvent>;
  /** Clear all subscriptions */
  clear(): void;
}
