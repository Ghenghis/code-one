import type { ProviderRegistry } from "./registry.js";
import type { IProvider } from "./provider.js";
import type {
  FallbackChain,
  ModelRole,
  ChatRequest,
  ChatResponse,
  ChatChunk,
} from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class AllProvidersExhaustedError extends Error {
  readonly role: ModelRole;
  readonly attempts: ReadonlyArray<{ providerId: string; modelId: string; error: string }>;

  constructor(
    role: ModelRole,
    attempts: Array<{ providerId: string; modelId: string; error: string }>,
  ) {
    super(`All providers exhausted for role "${role}" after ${attempts.length} attempt(s)`);
    this.name = "AllProvidersExhaustedError";
    this.role = role;
    this.attempts = attempts;
  }
}

// ---------------------------------------------------------------------------
// Fallback chain router
// ---------------------------------------------------------------------------

export class FallbackRouter {
  private _registry: ProviderRegistry;
  private _chains = new Map<ModelRole, FallbackChain>();

  constructor(registry: ProviderRegistry) {
    this._registry = registry;
  }

  /** Register a fallback chain for a given role. */
  setChain(chain: FallbackChain): void {
    this._chains.set(chain.role, chain);
  }

  /** Remove a chain for a role. */
  removeChain(role: ModelRole): boolean {
    return this._chains.delete(role);
  }

  /** Get the chain for a role. */
  getChain(role: ModelRole): FallbackChain | undefined {
    return this._chains.get(role);
  }

  /** List all registered chains. */
  listChains(): ReadonlyArray<FallbackChain> {
    return [...this._chains.values()];
  }

  /**
   * Route a chat request through the fallback chain for the request's role.
   *
   * Walks the chain in order. For each model profile, looks up the provider
   * in the registry. If the provider is healthy and enabled, tries the request.
   * On failure, moves to the next provider.
   *
   * If all providers fail, behavior depends on `exhaustedStrategy`:
   * - "error": throws AllProvidersExhaustedError
   * - "queue": throws AllProvidersExhaustedError (caller should queue for retry)
   * - "degrade": returns a degraded response with an error message
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const chain = this._chains.get(request.role);
    if (!chain) {
      throw new Error(`No fallback chain configured for role "${request.role}"`);
    }

    const attempts: Array<{ providerId: string; modelId: string; error: string }> = [];

    for (const profile of chain.chain) {
      const provider = this._registry.get(profile.providerId);
      if (!provider) continue;
      if (!provider.config.enabled) continue;
      if (provider.health.status === "down") continue;

      try {
        const response = await provider.chat({
          ...request,
          modelOverride: profile.modelId,
        });
        return response;
      } catch (err) {
        attempts.push({
          providerId: profile.providerId,
          modelId: profile.modelId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return this._handleExhausted(chain, request, attempts);
  }

  /**
   * Route a streaming chat request through the fallback chain.
   *
   * Same fallback logic as chat(), but returns an AsyncIterable of chunks.
   * If the stream fails mid-way, falls to the next provider and starts a
   * new stream (the caller should handle potential duplicate content).
   */
  async *chatStream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const chain = this._chains.get(request.role);
    if (!chain) {
      throw new Error(`No fallback chain configured for role "${request.role}"`);
    }

    const attempts: Array<{ providerId: string; modelId: string; error: string }> = [];

    for (const profile of chain.chain) {
      const provider = this._registry.get(profile.providerId);
      if (!provider) continue;
      if (!provider.config.enabled) continue;
      if (provider.health.status === "down") continue;

      try {
        yield* provider.chatStream({
          ...request,
          modelOverride: profile.modelId,
        });
        return; // Stream completed successfully
      } catch (err) {
        attempts.push({
          providerId: profile.providerId,
          modelId: profile.modelId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // All providers exhausted — streaming has no "degrade" path, always throw
    throw new AllProvidersExhaustedError(request.role, attempts);
  }

  /**
   * Resolve a provider for a role without making a request.
   * Returns the first healthy, enabled provider in the chain.
   */
  resolve(role: ModelRole): { provider: IProvider; modelId: string } | undefined {
    const chain = this._chains.get(role);
    if (!chain) return undefined;

    for (const profile of chain.chain) {
      const provider = this._registry.get(profile.providerId);
      if (!provider) continue;
      if (!provider.config.enabled) continue;
      if (provider.health.status === "down") continue;
      return { provider, modelId: profile.modelId };
    }

    return undefined;
  }

  // -- private ---------------------------------------------------------------

  private _handleExhausted(
    chain: FallbackChain,
    request: ChatRequest,
    attempts: Array<{ providerId: string; modelId: string; error: string }>,
  ): ChatResponse {
    if (chain.exhaustedStrategy === "degrade") {
      return {
        content: "[All providers unavailable. Please try again later.]",
        modelId: "none",
        providerId: "none",
        usage: { inputTokens: 0, outputTokens: 0 },
        ttftMs: 0,
        totalMs: 0,
      };
    }

    // "error" and "queue" both throw — the caller distinguishes queue behavior
    throw new AllProvidersExhaustedError(request.role, attempts);
  }
}
