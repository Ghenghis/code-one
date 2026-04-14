import { describe, it, expect } from "vitest";
import { TokenTracker, computeCost, BudgetExceededError } from "./cost.js";
import type { ModelProfile, BudgetConfig, TokenUsage } from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(overrides?: Partial<ModelProfile>): ModelProfile {
  return {
    modelId: "gpt-4o",
    providerId: "openai",
    roles: ["chat"],
    contextWindow: 128_000,
    maxOutputTokens: 4096,
    inputCostPer1M: 5,
    outputCostPer1M: 15,
    ...overrides,
  };
}

function makeBudget(overrides?: Partial<BudgetConfig>): BudgetConfig {
  return {
    sessionLimitUsd: 0,
    dailyLimitUsd: 0,
    onExceeded: "block",
    ...overrides,
  };
}

function makeUsage(input: number, output: number): TokenUsage {
  return { inputTokens: input, outputTokens: output };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeCost", () => {
  it("computes cost from token usage and profile pricing", () => {
    const profile = makeProfile({ inputCostPer1M: 5, outputCostPer1M: 15 });
    const usage = makeUsage(1000, 500);
    // 1000 / 1M * 5 = 0.005, 500 / 1M * 15 = 0.0075
    expect(computeCost(usage, profile)).toBeCloseTo(0.0125, 6);
  });

  it("returns 0 for local models with zero pricing", () => {
    const profile = makeProfile({ inputCostPer1M: 0, outputCostPer1M: 0 });
    expect(computeCost(makeUsage(10000, 5000), profile)).toBe(0);
  });

  it("handles large token counts", () => {
    const profile = makeProfile({ inputCostPer1M: 3, outputCostPer1M: 15 });
    const usage = makeUsage(1_000_000, 100_000);
    // 1M / 1M * 3 = 3, 100K / 1M * 15 = 1.5
    expect(computeCost(usage, profile)).toBeCloseTo(4.5, 6);
  });
});

describe("TokenTracker", () => {
  describe("record()", () => {
    it("records a request and computes cost", () => {
      const tracker = new TokenTracker("session-1", makeBudget());
      tracker.registerProfile(makeProfile());

      const record = tracker.record("openai", "gpt-4o", makeUsage(1000, 500));

      expect(record.providerId).toBe("openai");
      expect(record.modelId).toBe("gpt-4o");
      expect(record.costUsd).toBeCloseTo(0.0125, 6);
      expect(record.sessionId).toBe("session-1");
      expect(record.timestamp).toBeGreaterThan(0);
    });

    it("returns 0 cost when no profile registered", () => {
      const tracker = new TokenTracker("session-1", makeBudget());
      const record = tracker.record("unknown", "unknown-model", makeUsage(1000, 500));
      expect(record.costUsd).toBe(0);
    });

    it("accumulates records", () => {
      const tracker = new TokenTracker("session-1", makeBudget());
      tracker.registerProfile(makeProfile());

      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));
      tracker.record("openai", "gpt-4o", makeUsage(2000, 1000));

      expect(tracker.recordCount).toBe(2);
    });
  });

  describe("sessionTotalUsd()", () => {
    it("sums costs for the current session", () => {
      const tracker = new TokenTracker("session-1", makeBudget());
      tracker.registerProfile(makeProfile());

      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));
      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));

      expect(tracker.sessionTotalUsd()).toBeCloseTo(0.025, 6);
    });
  });

  describe("totalTokens()", () => {
    it("sums input and output tokens", () => {
      const tracker = new TokenTracker("session-1", makeBudget());
      tracker.registerProfile(makeProfile());

      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));
      tracker.record("openai", "gpt-4o", makeUsage(2000, 1500));

      const totals = tracker.totalTokens();
      expect(totals.input).toBe(3000);
      expect(totals.output).toBe(2000);
    });
  });

  describe("getRecordsByProvider()", () => {
    it("filters records by provider", () => {
      const tracker = new TokenTracker("session-1", makeBudget());
      tracker.registerProfile(makeProfile({ providerId: "openai" }));
      tracker.registerProfile(makeProfile({ providerId: "anthropic", modelId: "claude-sonnet" }));

      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));
      tracker.record("anthropic", "claude-sonnet", makeUsage(2000, 1000));
      tracker.record("openai", "gpt-4o", makeUsage(500, 200));

      expect(tracker.getRecordsByProvider("openai")).toHaveLength(2);
      expect(tracker.getRecordsByProvider("anthropic")).toHaveLength(1);
    });
  });

  describe("checkBudget()", () => {
    it("returns ok when no limits set", () => {
      const tracker = new TokenTracker("session-1", makeBudget());
      tracker.registerProfile(makeProfile());
      tracker.record("openai", "gpt-4o", makeUsage(1_000_000, 500_000));

      expect(tracker.checkBudget()).toEqual({ status: "ok" });
    });

    it("detects session limit exceeded", () => {
      const tracker = new TokenTracker("session-1", makeBudget({ sessionLimitUsd: 0.01 }));
      tracker.registerProfile(makeProfile());

      // This costs 0.0125 which exceeds 0.01
      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));

      const check = tracker.checkBudget();
      expect(check.status).toBe("exceeded");
      if (check.status === "exceeded") {
        expect(check.kind).toBe("session");
        expect(check.limitUsd).toBe(0.01);
      }
    });

    it("detects daily limit exceeded", () => {
      const tracker = new TokenTracker("session-1", makeBudget({ dailyLimitUsd: 0.01 }));
      tracker.registerProfile(makeProfile());

      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));

      const check = tracker.checkBudget();
      expect(check.status).toBe("exceeded");
      if (check.status === "exceeded") {
        expect(check.kind).toBe("daily");
      }
    });
  });

  describe("enforceBudget()", () => {
    it("throws BudgetExceededError when block strategy and over budget", () => {
      const tracker = new TokenTracker("session-1", makeBudget({
        sessionLimitUsd: 0.01,
        onExceeded: "block",
      }));
      tracker.registerProfile(makeProfile());
      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));

      expect(() => tracker.enforceBudget()).toThrow(BudgetExceededError);
    });

    it("returns exceeded status without throwing for warn strategy", () => {
      const tracker = new TokenTracker("session-1", makeBudget({
        sessionLimitUsd: 0.01,
        onExceeded: "warn",
      }));
      tracker.registerProfile(makeProfile());
      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));

      const result = tracker.enforceBudget();
      expect(result.status).toBe("exceeded");
    });

    it("returns exceeded status without throwing for downgrade-model strategy", () => {
      const tracker = new TokenTracker("session-1", makeBudget({
        sessionLimitUsd: 0.01,
        onExceeded: "downgrade-model",
      }));
      tracker.registerProfile(makeProfile());
      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));

      const result = tracker.enforceBudget();
      expect(result.status).toBe("exceeded");
    });

    it("returns ok when within budget", () => {
      const tracker = new TokenTracker("session-1", makeBudget({
        sessionLimitUsd: 100,
        onExceeded: "block",
      }));
      tracker.registerProfile(makeProfile());
      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));

      expect(tracker.enforceBudget()).toEqual({ status: "ok" });
    });
  });

  describe("setBudget()", () => {
    it("updates budget at runtime", () => {
      const tracker = new TokenTracker("session-1", makeBudget({ sessionLimitUsd: 100 }));
      tracker.setBudget(makeBudget({ sessionLimitUsd: 0.01, onExceeded: "block" }));

      expect(tracker.budget.sessionLimitUsd).toBe(0.01);
    });
  });

  describe("clear()", () => {
    it("removes all records", () => {
      const tracker = new TokenTracker("session-1", makeBudget());
      tracker.registerProfile(makeProfile());
      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));
      tracker.record("openai", "gpt-4o", makeUsage(1000, 500));

      tracker.clear();
      expect(tracker.recordCount).toBe(0);
      expect(tracker.sessionTotalUsd()).toBe(0);
    });
  });
});
