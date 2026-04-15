// @code-one/agent-core — Agent loop, tools, approvals, checkpoints

export { EventStream, createEvent } from "./event-stream.js";
export { ToolRegistryImpl } from "./tool-registry.js";
export { ApprovalGate } from "./approval-gate.js";
export type { PendingApproval } from "./approval-gate.js";
export { CheckpointManager } from "./checkpoint.js";
export type { CheckpointData } from "./checkpoint.js";
export { AgentLoop } from "./agent-loop.js";
export type {
  AgentPhase,
  AgentState,
  AgentLoopConfig,
  AgentHandlers,
} from "./agent-loop.js";
export {
  createCompletionTaskState,
  recordTaskStarted,
  recordTaskFailure,
  recordVerificationStarted,
  recordVerificationPassed,
  recordVerificationFailed,
  canMarkComplete,
  evaluateCompletion,
  canRetry,
  evaluateEscalation,
} from "./completion-engine.js";
export type {
  TaskStatus,
  VerificationStatus,
  CompletionTaskState,
  CompletionDecision,
  RetryDecision,
} from "./completion-engine.js";
