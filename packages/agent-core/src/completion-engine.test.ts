import { describe, it, expect } from "vitest";
import {
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
import type { CompletionTaskState } from "./completion-engine.js";

// ── Helpers ────────────────────────────────────────────────────────

/** Drive a task through the full success path: pending → in_progress → awaiting_verification → verified */
function driveToVerified(taskId = "t1", maxRetries = 3): CompletionTaskState {
  let s = createCompletionTaskState(taskId, maxRetries);
  s = recordTaskStarted(s);
  s = recordVerificationStarted(s);
  s = recordVerificationPassed(s);
  return s;
}

// ── State Constructor ──────────────────────────────────────────────

describe("createCompletionTaskState", () => {
  it("creates default state with correct fields", () => {
    const s = createCompletionTaskState("task-1");
    expect(s.taskId).toBe("task-1");
    expect(s.status).toBe("pending");
    expect(s.verificationStatus).toBe("not_started");
    expect(s.retryCount).toBe(0);
    expect(s.maxRetries).toBe(3);
    expect(s.escalationRequired).toBe(false);
    expect(s.lastFailureReason).toBeUndefined();
  });

  it("accepts custom maxRetries", () => {
    const s = createCompletionTaskState("task-2", 5);
    expect(s.maxRetries).toBe(5);
  });
});

// ── Valid State Transitions ────────────────────────────────────────

describe("valid state transitions", () => {
  it("pending → in_progress via recordTaskStarted", () => {
    const s = createCompletionTaskState("t1");
    const next = recordTaskStarted(s);
    expect(next.status).toBe("in_progress");
  });

  it("in_progress → awaiting_verification via recordVerificationStarted", () => {
    let s = createCompletionTaskState("t1");
    s = recordTaskStarted(s);
    s = recordVerificationStarted(s);
    expect(s.status).toBe("awaiting_verification");
    expect(s.verificationStatus).toBe("running");
  });

  it("awaiting_verification → verified via recordVerificationPassed", () => {
    const s = driveToVerified();
    expect(s.status).toBe("verified");
    expect(s.verificationStatus).toBe("passed");
  });

  it("verified → complete via evaluateCompletion", () => {
    const s = driveToVerified();
    const complete = evaluateCompletion(s);
    expect(complete.status).toBe("complete");
  });

  it("in_progress → retrying via recordTaskFailure (retries remaining)", () => {
    let s = createCompletionTaskState("t1", 3);
    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "build failed");
    expect(s.status).toBe("retrying");
    expect(s.retryCount).toBe(1);
    expect(s.lastFailureReason).toBe("build failed");
    expect(s.escalationRequired).toBe(false);
  });

  it("retrying → in_progress via recordTaskStarted", () => {
    let s = createCompletionTaskState("t1", 3);
    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "err");
    expect(s.status).toBe("retrying");
    s = recordTaskStarted(s);
    expect(s.status).toBe("in_progress");
  });

  it("awaiting_verification → retrying via recordVerificationFailed (retries remaining)", () => {
    let s = createCompletionTaskState("t1", 3);
    s = recordTaskStarted(s);
    s = recordVerificationStarted(s);
    s = recordVerificationFailed(s, "tests failed");
    expect(s.status).toBe("retrying");
    expect(s.verificationStatus).toBe("failed");
    expect(s.retryCount).toBe(1);
  });
});

// ── Invalid State Transitions ──────────────────────────────────────

describe("invalid state transitions", () => {
  it("cannot start a task that is already in_progress", () => {
    let s = createCompletionTaskState("t1");
    s = recordTaskStarted(s);
    expect(() => recordTaskStarted(s)).toThrow('Cannot start task in "in_progress"');
  });

  it("cannot start a task that is failed", () => {
    let s = createCompletionTaskState("t1", 1);
    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "err");
    expect(s.status).toBe("failed");
    expect(() => recordTaskStarted(s)).toThrow('Cannot start task in "failed"');
  });

  it("cannot start a task that is complete", () => {
    let s = driveToVerified();
    s = evaluateCompletion(s);
    expect(() => recordTaskStarted(s)).toThrow('Cannot start task in "complete"');
  });

  it("cannot record failure for a pending task", () => {
    const s = createCompletionTaskState("t1");
    expect(() => recordTaskFailure(s, "err")).toThrow('Must be "in_progress"');
  });

  it("cannot start verification for a pending task", () => {
    const s = createCompletionTaskState("t1");
    expect(() => recordVerificationStarted(s)).toThrow(
      'Must be "in_progress" or "awaiting_verification"',
    );
  });

  it("cannot pass verification that hasn't started", () => {
    let s = createCompletionTaskState("t1");
    s = recordTaskStarted(s);
    expect(() => recordVerificationPassed(s)).toThrow('Must be "running"');
  });

  it("cannot fail verification that hasn't started", () => {
    let s = createCompletionTaskState("t1");
    s = recordTaskStarted(s);
    expect(() => recordVerificationFailed(s, "reason")).toThrow('Must be "running"');
  });
});

// ── Retry Counting ─────────────────────────────────────────────────

describe("retry counting", () => {
  it("increments retry count on each failure", () => {
    let s = createCompletionTaskState("t1", 5);

    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "fail 1");
    expect(s.retryCount).toBe(1);

    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "fail 2");
    expect(s.retryCount).toBe(2);

    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "fail 3");
    expect(s.retryCount).toBe(3);
  });

  it("increments retry count on verification failure", () => {
    let s = createCompletionTaskState("t1", 5);
    s = recordTaskStarted(s);
    s = recordVerificationStarted(s);
    s = recordVerificationFailed(s, "tests failed");
    expect(s.retryCount).toBe(1);
  });

  it("preserves last failure reason", () => {
    let s = createCompletionTaskState("t1", 5);
    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "reason A");
    expect(s.lastFailureReason).toBe("reason A");

    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "reason B");
    expect(s.lastFailureReason).toBe("reason B");
  });
});

// ── Max Retry Enforcement ──────────────────────────────────────────

describe("max retry enforcement", () => {
  it("transitions to failed when retries exhausted", () => {
    let s = createCompletionTaskState("t1", 2);

    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "fail 1"); // retryCount=1, status=retrying
    expect(s.status).toBe("retrying");

    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "fail 2"); // retryCount=2 >= maxRetries=2
    expect(s.status).toBe("failed");
    expect(s.escalationRequired).toBe(true);
  });

  it("transitions to failed on verification failure when retries exhausted", () => {
    let s = createCompletionTaskState("t1", 1);
    s = recordTaskStarted(s);
    s = recordVerificationStarted(s);
    s = recordVerificationFailed(s, "tests broken");
    expect(s.status).toBe("failed");
    expect(s.retryCount).toBe(1);
    expect(s.escalationRequired).toBe(true);
  });

  it("with maxRetries=1, first failure exhausts retries", () => {
    let s = createCompletionTaskState("t1", 1);
    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "instant fail");
    expect(s.status).toBe("failed");
    expect(s.escalationRequired).toBe(true);
    expect(s.retryCount).toBe(1);
  });
});

// ── Escalation Behavior ────────────────────────────────────────────

describe("escalation behavior", () => {
  it("sets escalationRequired when retries exhausted via task failure", () => {
    let s = createCompletionTaskState("t1", 1);
    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "fail");
    expect(s.escalationRequired).toBe(true);
    expect(evaluateEscalation(s)).toBe(true);
  });

  it("sets escalationRequired when retries exhausted via verification failure", () => {
    let s = createCompletionTaskState("t1", 1);
    s = recordTaskStarted(s);
    s = recordVerificationStarted(s);
    s = recordVerificationFailed(s, "bad");
    expect(s.escalationRequired).toBe(true);
    expect(evaluateEscalation(s)).toBe(true);
  });

  it("does not set escalationRequired while retries remain", () => {
    let s = createCompletionTaskState("t1", 3);
    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "fail");
    expect(s.escalationRequired).toBe(false);
    expect(evaluateEscalation(s)).toBe(false);
  });

  it("evaluateEscalation returns false for fresh task", () => {
    const s = createCompletionTaskState("t1");
    expect(evaluateEscalation(s)).toBe(false);
  });
});

// ── Verification Gate Behavior ─────────────────────────────────────

describe("verification gate", () => {
  it("blocks completion when verification not started", () => {
    let s = createCompletionTaskState("t1");
    s = recordTaskStarted(s);
    const d = canMarkComplete(s);
    expect(d.canComplete).toBe(false);
    expect(d.reason).toContain("not_started");
  });

  it("blocks completion when verification is running", () => {
    let s = createCompletionTaskState("t1");
    s = recordTaskStarted(s);
    s = recordVerificationStarted(s);
    const d = canMarkComplete(s);
    expect(d.canComplete).toBe(false);
    expect(d.reason).toContain("awaiting verification");
  });

  it("blocks completion when verification failed", () => {
    let s = createCompletionTaskState("t1", 5);
    s = recordTaskStarted(s);
    s = recordVerificationStarted(s);
    s = recordVerificationFailed(s, "bad output");
    const d = canMarkComplete(s);
    expect(d.canComplete).toBe(false);
  });

  it("allows completion when verification passed and status is verified", () => {
    const s = driveToVerified();
    const d = canMarkComplete(s);
    expect(d.canComplete).toBe(true);
    expect(d.reason).toContain("All completion conditions satisfied");
  });
});

// ── Completion Blocking ────────────────────────────────────────────

describe("completion blocking", () => {
  it("Rule 1: cannot complete without verification", () => {
    let s = createCompletionTaskState("t1");
    s = recordTaskStarted(s);
    expect(() => evaluateCompletion(s)).toThrow("Verification has not passed");
  });

  it("Rule 5: failed task cannot complete", () => {
    let s = createCompletionTaskState("t1", 1);
    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "done");
    const d = canMarkComplete(s);
    expect(d.canComplete).toBe(false);
    expect(d.reason).toContain("failed");
  });

  it("Rule 6: blocked task cannot complete", () => {
    const s: CompletionTaskState = {
      taskId: "t1",
      status: "blocked",
      verificationStatus: "not_started",
      retryCount: 0,
      maxRetries: 3,
      escalationRequired: false,
    };
    const d = canMarkComplete(s);
    expect(d.canComplete).toBe(false);
    expect(d.reason).toContain("blocked");
  });

  it("Rule 7: awaiting_verification cannot complete", () => {
    let s = createCompletionTaskState("t1");
    s = recordTaskStarted(s);
    s = recordVerificationStarted(s);
    const d = canMarkComplete(s);
    expect(d.canComplete).toBe(false);
    expect(d.reason).toContain("awaiting verification");
  });

  it("escalationRequired blocks completion even if otherwise valid", () => {
    // Manually construct a state that looks "verified" but has escalation flag
    const s: CompletionTaskState = {
      taskId: "t1",
      status: "verified",
      verificationStatus: "passed",
      retryCount: 3,
      maxRetries: 3,
      escalationRequired: true,
    };
    const d = canMarkComplete(s);
    expect(d.canComplete).toBe(false);
    expect(d.reason).toContain("Escalation");
  });
});

// ── Successful Completion ──────────────────────────────────────────

describe("successful completion", () => {
  it("full happy path: pending → in_progress → verified → complete", () => {
    let s = createCompletionTaskState("task-happy");
    expect(s.status).toBe("pending");

    s = recordTaskStarted(s);
    expect(s.status).toBe("in_progress");

    s = recordVerificationStarted(s);
    expect(s.status).toBe("awaiting_verification");

    s = recordVerificationPassed(s);
    expect(s.status).toBe("verified");

    s = evaluateCompletion(s);
    expect(s.status).toBe("complete");
  });

  it("retry then succeed: fail → retry → succeed → verify → complete", () => {
    let s = createCompletionTaskState("task-retry", 3);

    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "first attempt failed");
    expect(s.status).toBe("retrying");
    expect(s.retryCount).toBe(1);

    s = recordTaskStarted(s);
    s = recordVerificationStarted(s);
    s = recordVerificationPassed(s);
    expect(s.status).toBe("verified");

    s = evaluateCompletion(s);
    expect(s.status).toBe("complete");
  });

  it("verification fail then retry and succeed", () => {
    let s = createCompletionTaskState("task-vfail", 3);

    s = recordTaskStarted(s);
    s = recordVerificationStarted(s);
    s = recordVerificationFailed(s, "tests failed");
    expect(s.status).toBe("retrying");
    expect(s.retryCount).toBe(1);

    // Retry
    s = recordTaskStarted(s);
    s = recordVerificationStarted(s);
    s = recordVerificationPassed(s);
    expect(s.status).toBe("verified");

    s = evaluateCompletion(s);
    expect(s.status).toBe("complete");
  });
});

// ── canRetry ───────────────────────────────────────────────────────

describe("canRetry", () => {
  it("returns true for retrying task with retries remaining", () => {
    let s = createCompletionTaskState("t1", 3);
    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "err");
    const d = canRetry(s);
    expect(d.canRetry).toBe(true);
  });

  it("returns false when retries exhausted", () => {
    let s = createCompletionTaskState("t1", 1);
    s = recordTaskStarted(s);
    s = recordTaskFailure(s, "err");
    const d = canRetry(s);
    expect(d.canRetry).toBe(false);
    expect(d.reason).toContain("Retry limit reached");
  });

  it("returns false for non-retryable states", () => {
    const s = createCompletionTaskState("t1");
    const d = canRetry(s);
    expect(d.canRetry).toBe(false);
    expect(d.reason).toContain("pending");
  });
});
