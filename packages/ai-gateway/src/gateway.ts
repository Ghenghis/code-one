import { ProviderRegistry } from "./registry.js";
import { FallbackRouter, AllProvidersExhaustedError } from "./fallback.js";
import { HealthMonitor } from "./health.js";
import { TokenTracker, BudgetExceededError } from "./cost.js";
import type { IProvider } from "./provider.js";
import type {
  ChatRequest,
  ChatResponse,
  ChatChunk,
  FallbackChain,
  ModelProfile,
  BudgetConfig,
  ProviderConfig,
  ProviderHealth,
  ModelRole,
  CostRecord,
} from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// Gateway configuration
// ---------------------------------------------------------------------------

export interface GatewayConfig {
  sessionId: string;
  budget: BudgetConfig;
  healthCheckIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// AI Gateway — unified facade
// ---------------------------------------------------------------------------

/**
 * Central entry point for all AI provider interactions.
 *
 * Composes: ProviderRegistry, FallbackRouter, HealthMonitor, TokenTracker.
 * Consumers call gateway.chat() / gateway.chatStream() — the gateway handles
 * provider selection, fallback, health tracking, and cost governance.
 */
export class AIGateway {
  readonly registry: ProviderRegistry;
  readonly router: FallbackRouter;
  readonly healthMonitor: HealthMonitor;
  readonly tokenTracker: TokenTracker;

  constructor(config: GatewayConfig) {
    this.registry = new ProviderRegistry();
    this.router = new FallbackRouter(this.registry);
    this.healthMonitor = new HealthMonitor(this.registry, config.healthCheckIntervalMs ?? 30_000);
    this.tokenTracker = new TokenTracker(config.sessionId, config.budget);
  }

  // -- Provider management ---------------------------------------------------

  /** Register a provider and optionally its model profiles for cost tracking. */
  registerProvider(provider: IProvider, profiles?: ModelProfile[]): void {
    this.registry.register(provider);
    if (profiles) {
      for (const p of profiles) {
        this.tokenTracker.registerProfile(p);
      }
    }
  }

  /** Unregister a provider by ID. */
  unregisterProvider(id: string): boolean {
    return this.registry.unregister(id);
  }

  // -- Chain management ------------------------------------------------------

  /** Configure a fallback chain for a model role. */
  setFallbackChain(chain: FallbackChain): void {
    this.router.setChain(chain);
  }

  // -- Chat ------------------------------------------------------------------

  /**
   * Send a chat request. The gateway:
   * 1. Checks budget (throws BudgetExceededError if blocked)
   * 2. Routes through fallback chain
   * 3. Records token usage and cost
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.tokenTracker.enforceBudget();

    const response = await this.router.chat(request);

    this.tokenTracker.record(response.providerId, response.modelId, response.usage);

    return response;
  }

  /**
   * Send a streaming chat request. The gateway:
   * 1. Checks budget (throws BudgetExceededError if blocked)
   * 2. Streams through fallback chain
   * 3. Records token usage from the final chunk
   */
  async *chatStream(request: ChatRequest): AsyncIterable<ChatChunk> {
    this.tokenTracker.enforceBudget();

    let lastChunk: ChatChunk | undefined;

    for await (const chunk of this.router.chatStream(request)) {
      lastChunk = chunk;
      yield chunk;
    }

    // Record usage from the final chunk if available
    if (lastChunk?.usage) {
      this.tokenTracker.record(lastChunk.providerId, lastChunk.modelId, lastChunk.usage);
    }
  }

  // -- Health ----------------------------------------------------------------

  /** Start periodic health monitoring. */
  startHealthMonitor(): void {
    this.healthMonitor.start();
  }

  /** Stop periodic health monitoring. */
  stopHealthMonitor(): void {
    this.healthMonitor.stop();
  }

  /** Run a one-off health check on all providers. */
  async checkHealth(): Promise<void> {
    await this.healthMonitor.checkAll();
  }

  // -- Queries ---------------------------------------------------------------

  /** List all registered provider configs. */
  listProviders(): ReadonlyArray<ProviderConfig> {
    return this.registry.listConfigs();
  }

  /** List health status for all providers. */
  listHealth(): ReadonlyArray<ProviderHealth> {
    return this.registry.listHealth();
  }

  /** Resolve the provider+model that would handle a given role. */
  resolveProvider(role: ModelRole): { providerId: string; modelId: string } | undefined {
    const result = this.router.resolve(role);
    if (!result) return undefined;
    return { providerId: result.provider.config.id, modelId: result.modelId };
  }

  /** Get cost records. */
  getCostRecords(): ReadonlyArray<CostRecord> {
    return this.tokenTracker.getRecords();
  }

  /** Get current session cost. */
  getSessionCostUsd(): number {
    return this.tokenTracker.sessionTotalUsd();
  }

  /** Get total token counts. */
  getTotalTokens(): { input: number; output: number } {
    return this.tokenTracker.totalTokens();
  }

  // -- Lifecycle -------------------------------------------------------------

  /** Shut down the gateway (stop health monitor, clean up). */
  shutdown(): void {
    this.healthMonitor.stop();
  }
}
