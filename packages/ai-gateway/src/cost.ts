import type {
  TokenUsage,
  CostRecord,
  BudgetConfig,
  ModelProfile,
  ProviderId,
} from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// Budget exceeded error
// ---------------------------------------------------------------------------

export class BudgetExceededError extends Error {
  readonly kind: "session" | "daily";
  readonly currentUsd: number;
  readonly limitUsd: number;

  constructor(kind: "session" | "daily", currentUsd: number, limitUsd: number) {
    super(
      `${kind === "session" ? "Session" : "Daily"} budget exceeded: $${currentUsd.toFixed(4)} / $${limitUsd.toFixed(4)}`,
    );
    this.name = "BudgetExceededError";
    this.kind = kind;
    this.currentUsd = currentUsd;
    this.limitUsd = limitUsd;
  }
}

// ---------------------------------------------------------------------------
// Cost calculator
// ---------------------------------------------------------------------------

/** Compute cost in USD for a single request given the model's pricing. */
export function computeCost(usage: TokenUsage, profile: ModelProfile): number {
  const inputCost = (usage.inputTokens / 1_000_000) * profile.inputCostPer1M;
  const outputCost = (usage.outputTokens / 1_000_000) * profile.outputCostPer1M;
  return inputCost + outputCost;
}

// ---------------------------------------------------------------------------
// Token tracker
// ---------------------------------------------------------------------------

export class TokenTracker {
  private _records: CostRecord[] = [];
  private _sessionId: string;
  private _budget: BudgetConfig;
  private _profiles = new Map<string, ModelProfile>();

  constructor(sessionId: string, budget: BudgetConfig) {
    this._sessionId = sessionId;
    this._budget = budget;
  }

  /** Register a model profile so we can compute costs. */
  registerProfile(profile: ModelProfile): void {
    this._profiles.set(`${profile.providerId}:${profile.modelId}`, profile);
  }

  /** Update the budget config at runtime. */
  setBudget(budget: BudgetConfig): void {
    this._budget = budget;
  }

  get budget(): BudgetConfig {
    return { ...this._budget };
  }

  /**
   * Record a completed request.
   * Returns the cost record. Throws BudgetExceededError if onExceeded is "block".
   */
  record(
    providerId: ProviderId,
    modelId: string,
    usage: TokenUsage,
  ): CostRecord {
    const profile = this._profiles.get(`${providerId}:${modelId}`);
    const costUsd = profile ? computeCost(usage, profile) : 0;

    const record: CostRecord = {
      providerId,
      modelId,
      usage,
      costUsd,
      timestamp: Date.now(),
      sessionId: this._sessionId,
    };

    this._records.push(record);
    return record;
  }

  /**
   * Check if the budget allows another request.
   *
   * Returns "ok" if within budget, or the exceeded kind.
   * Does NOT throw — call this before making a request to decide what to do.
   */
  checkBudget(): { status: "ok" } | { status: "exceeded"; kind: "session" | "daily"; currentUsd: number; limitUsd: number } {
    const sessionTotal = this.sessionTotalUsd();
    if (this._budget.sessionLimitUsd > 0 && sessionTotal >= this._budget.sessionLimitUsd) {
      return {
        status: "exceeded",
        kind: "session",
        currentUsd: sessionTotal,
        limitUsd: this._budget.sessionLimitUsd,
      };
    }

    const dailyTotal = this.dailyTotalUsd();
    if (this._budget.dailyLimitUsd > 0 && dailyTotal >= this._budget.dailyLimitUsd) {
      return {
        status: "exceeded",
        kind: "daily",
        currentUsd: dailyTotal,
        limitUsd: this._budget.dailyLimitUsd,
      };
    }

    return { status: "ok" };
  }

  /**
   * Enforce the budget — throws if exceeded and strategy is "block".
   * Returns the check result otherwise.
   */
  enforceBudget(): { status: "ok" } | { status: "exceeded"; kind: "session" | "daily"; currentUsd: number; limitUsd: number } {
    const check = this.checkBudget();
    if (check.status === "exceeded" && this._budget.onExceeded === "block") {
      throw new BudgetExceededError(check.kind, check.currentUsd, check.limitUsd);
    }
    return check;
  }

  // -- Queries ---------------------------------------------------------------

  /** Total cost for the current session. */
  sessionTotalUsd(): number {
    return this._records
      .filter((r) => r.sessionId === this._sessionId)
      .reduce((sum, r) => sum + r.costUsd, 0);
  }

  /** Total cost for today (UTC). */
  dailyTotalUsd(): number {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const ts = todayStart.getTime();
    return this._records
      .filter((r) => r.timestamp >= ts)
      .reduce((sum, r) => sum + r.costUsd, 0);
  }

  /** Total tokens across all records. */
  totalTokens(): { input: number; output: number } {
    return this._records.reduce(
      (acc, r) => ({
        input: acc.input + r.usage.inputTokens,
        output: acc.output + r.usage.outputTokens,
      }),
      { input: 0, output: 0 },
    );
  }

  /** Get all records. */
  getRecords(): ReadonlyArray<CostRecord> {
    return [...this._records];
  }

  /** Get records for a specific provider. */
  getRecordsByProvider(providerId: ProviderId): ReadonlyArray<CostRecord> {
    return this._records.filter((r) => r.providerId === providerId);
  }

  /** Number of recorded requests. */
  get recordCount(): number {
    return this._records.length;
  }

  /** Clear all records. */
  clear(): void {
    this._records = [];
  }
}
