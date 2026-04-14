import type {
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ProviderConfig,
  ProviderHealth,
  ProviderStatus,
} from "@code-one/shared-types";

export interface IProvider {
  readonly config: ProviderConfig;
  readonly health: ProviderHealth;

  /** Send a chat request and get a full response */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /** Send a streaming chat request, yielding chunks */
  chatStream(request: ChatRequest): AsyncIterable<ChatChunk>;

  /** Check if provider is reachable */
  ping(): Promise<boolean>;

  /** List available models from this provider */
  listModels(): Promise<string[]>;

  /** Update health status after a request */
  recordSuccess(latencyMs: number): void;
  recordFailure(error: string): void;
}

export abstract class BaseProvider implements IProvider {
  readonly config: ProviderConfig;
  private _health: ProviderHealth;
  private _latencies: number[] = [];
  /** Sliding window of request outcomes: true = success, false = failure */
  private _outcomes: boolean[] = [];
  private static readonly MAX_SAMPLES = 100;

  constructor(config: ProviderConfig) {
    this.config = config;
    this._health = {
      providerId: config.id,
      status: "unknown",
      avgLatencyMs: 0,
      errorRate: 0,
      lastSuccessAt: null,
      lastError: null,
      consecutiveFailures: 0,
    };
  }

  get health(): ProviderHealth {
    return { ...this._health };
  }

  recordSuccess(latencyMs: number): void {
    this._latencies.push(latencyMs);
    if (this._latencies.length > BaseProvider.MAX_SAMPLES) {
      this._latencies.shift();
    }
    this._outcomes.push(true);
    if (this._outcomes.length > BaseProvider.MAX_SAMPLES) {
      this._outcomes.shift();
    }
    this._health.avgLatencyMs =
      this._latencies.reduce((a, b) => a + b, 0) / this._latencies.length;
    this._health.errorRate = this._computeErrorRate();
    this._health.lastSuccessAt = Date.now();
    this._health.lastError = null;
    this._health.consecutiveFailures = 0;
    this._health.status = this._computeStatus();
  }

  recordFailure(error: string): void {
    this._outcomes.push(false);
    if (this._outcomes.length > BaseProvider.MAX_SAMPLES) {
      this._outcomes.shift();
    }
    this._health.lastError = error;
    this._health.errorRate = this._computeErrorRate();
    this._health.consecutiveFailures += 1;
    this._health.status = this._computeStatus();
  }

  private _computeErrorRate(): number {
    if (this._outcomes.length === 0) return 0;
    const failures = this._outcomes.filter((ok) => !ok).length;
    return failures / this._outcomes.length;
  }

  private _computeStatus(): ProviderStatus {
    if (this._health.consecutiveFailures >= 5) return "down";
    if (this._health.consecutiveFailures >= 2) return "degraded";
    if (this._health.lastSuccessAt === null) return "unknown";
    return "healthy";
  }

  abstract chat(request: ChatRequest): Promise<ChatResponse>;
  abstract chatStream(request: ChatRequest): AsyncIterable<ChatChunk>;
  abstract ping(): Promise<boolean>;
  abstract listModels(): Promise<string[]>;
}
