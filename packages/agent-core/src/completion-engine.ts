// Completion Engine v1 — deterministic task completion enforcement
//
// Decides whether a task is incomplete, blocked, failed, retrying,
// verified, or complete. Enforces verification gates, retry bounds,
// and escalation rules. Pure logic — no UI, no persistence, no I/O.

// ── Types ──────────────────────────────────────────────────────────

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "retrying"
  | "failed"
  | "awaiting_verification"
  | "verified"
  | "complete";

export type VerificationStatus = "not_started" | "running" | "passed" | "failed";

export interface CompletionTaskState {
  taskId: string;
  status: TaskStatus;
  verificationStatus: VerificationStatus;
  retryCount: number;
  maxRetries: number;
  lastFailureReason?: string;
  escalationRequired: boolean;
}

export interface CompletionDecision {
  canComplete: boolean;
  reason: string;
}

export interface RetryDecision {
  canRetry: boolean;
  reason: string;
}

// ── State Constructor ──────────────────────────────────────────────

export function createCompletionTaskState(
  taskId: string,
  maxRetries: number = 3,
): CompletionTaskState {
  return {
    taskId,
    status: "pending",
    verificationStatus: "not_started",
    retryCount: 0,
    maxRetries,
    escalationRequired: false,
  };
}

// ── Transition Functions ───────────────────────────────────────────

export function recordTaskStarted(state: CompletionTaskState): CompletionTaskState {
  if (state.status !== "pending" && state.status !== "retrying") {
    throw new Error(
      `Cannot start task in "${state.status}" state. Must be "pending" or "retrying".`,
    );
  }
  return { ...state, status: "in_progress" };
}

export function recordTaskFailure(state: CompletionTaskState, reason: string): CompletionTaskState {
  if (state.status !== "in_progress") {
    throw new Error(
      `Cannot record failure for task in "${state.status}" state. Must be "in_progress".`,
    );
  }

  const nextRetryCount = state.retryCount + 1;
  const exhausted = nextRetryCount >= state.maxRetries;

  return {
    ...state,
    status: exhausted ? "failed" : "retrying",
    retryCount: nextRetryCount,
    lastFailureReason: reason,
    escalationRequired: exhausted,
  };
}

export function recordVerificationStarted(state: CompletionTaskState): CompletionTaskState {
  if (state.status !== "in_progress" && state.status !== "awaiting_verification") {
    throw new Error(
      `Cannot start verification for task in "${state.status}" state. Must be "in_progress" or "awaiting_verification".`,
    );
  }
  return {
    ...state,
    status: "awaiting_verification",
    verificationStatus: "running",
  };
}

export function recordVerificationPassed(state: CompletionTaskState): CompletionTaskState {
  if (state.verificationStatus !== "running") {
    throw new Error(
      `Cannot pass verification when verification status is "${state.verificationStatus}". Must be "running".`,
    );
  }
  return {
    ...state,
    status: "verified",
    verificationStatus: "passed",
  };
}

export function recordVerificationFailed(
  state: CompletionTaskState,
  reason: string,
): CompletionTaskState {
  if (state.verificationStatus !== "running") {
    throw new Error(
      `Cannot fail verification when verification status is "${state.verificationStatus}". Must be "running".`,
    );
  }

  const nextRetryCount = state.retryCount + 1;
  const exhausted = nextRetryCount >= state.maxRetries;

  return {
    ...state,
    status: exhausted ? "failed" : "retrying",
    verificationStatus: "failed",
    retryCount: nextRetryCount,
    lastFailureReason: reason,
    escalationRequired: exhausted,
  };
}

// ── Completion Evaluation ──────────────────────────────────────────

export function canMarkComplete(state: CompletionTaskState): CompletionDecision {
  if (state.status === "failed") {
    return { canComplete: false, reason: "Task is in failed state." };
  }
  if (state.status === "blocked") {
    return { canComplete: false, reason: "Task is blocked." };
  }
  if (state.status === "awaiting_verification") {
    return { canComplete: false, reason: "Task is awaiting verification result." };
  }
  if (state.verificationStatus !== "passed") {
    return {
      canComplete: false,
      reason: `Verification has not passed (status: "${state.verificationStatus}").`,
    };
  }
  if (state.escalationRequired) {
    return { canComplete: false, reason: "Escalation is required." };
  }
  if (state.status !== "verified") {
    return {
      canComplete: false,
      reason: `Task status must be "verified" to complete (current: "${state.status}").`,
    };
  }
  return { canComplete: true, reason: "All completion conditions satisfied." };
}

export function evaluateCompletion(state: CompletionTaskState): CompletionTaskState {
  const decision = canMarkComplete(state);
  if (!decision.canComplete) {
    throw new Error(`Cannot complete task: ${decision.reason}`);
  }
  return { ...state, status: "complete" };
}

// ── Retry / Escalation Evaluation ──────────────────────────────────

export function canRetry(state: CompletionTaskState): RetryDecision {
  if (state.status !== "retrying" && state.status !== "failed") {
    return { canRetry: false, reason: `Task is in "${state.status}" state, not retryable.` };
  }
  if (state.retryCount >= state.maxRetries) {
    return {
      canRetry: false,
      reason: `Retry limit reached (${state.retryCount}/${state.maxRetries}). Escalation required.`,
    };
  }
  return { canRetry: true, reason: "Retry available." };
}

export function evaluateEscalation(state: CompletionTaskState): boolean {
  return state.retryCount >= state.maxRetries;
}
