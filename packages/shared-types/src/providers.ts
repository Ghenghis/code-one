/**
 * Provider system type contracts (Tier 2).
 *
 * Defines the multi-provider abstraction layer including
 * fallback chains, health tracking, and cost governance.
 */

// ---------------------------------------------------------------------------
// Provider identity
// ---------------------------------------------------------------------------

export type ProviderId = string;

export type ProviderKind =
  | "anthropic"
  | "openai"
  | "google"
  | "minimax"
  | "ollama"
  | "lmstudio"
  | "llamacpp"
  | "openai-compatible";

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  id: ProviderId;
  kind: ProviderKind;
  /** Human-readable label */
  label: string;
  /** Base URL for API requests */
  baseUrl: string;
  /** API key reference (resolved from encrypted store, never stored in plain config) */
  apiKeyRef?: string;
  /** Model IDs available from this provider */
  models: string[];
  /** Whether this provider runs locally (Ollama, LM Studio, llama.cpp) */
  isLocal: boolean;
  /** Maximum requests per minute (0 = unlimited) */
  rateLimit: number;
  /** Connection timeout in ms */
  timeoutMs: number;
  /** Whether provider is enabled */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Model roles and routing
// ---------------------------------------------------------------------------

/** Functional role a model fills in the system */
export type ModelRole =
  | "chat"
  | "completion"
  | "reasoning"
  | "editing"
  | "vision"
  | "embedding"
  | "utility";

export interface ModelProfile {
  /** Provider-specific model ID (e.g. "claude-sonnet-4-20250514") */
  modelId: string;
  /** Which provider serves this model */
  providerId: ProviderId;
  /** Roles this model can fill */
  roles: ModelRole[];
  /** Context window size in tokens */
  contextWindow: number;
  /** Max output tokens */
  maxOutputTokens: number;
  /** Cost per 1M input tokens in USD (0 for local) */
  inputCostPer1M: number;
  /** Cost per 1M output tokens in USD (0 for local) */
  outputCostPer1M: number;
}

// ---------------------------------------------------------------------------
// Fallback chain
// ---------------------------------------------------------------------------

export interface FallbackChain {
  /** Role this chain serves */
  role: ModelRole;
  /** Ordered list of model profiles — first healthy provider wins */
  chain: ModelProfile[];
  /** Strategy when all providers fail */
  exhaustedStrategy: "error" | "queue" | "degrade";
}

// ---------------------------------------------------------------------------
// Health tracking
// ---------------------------------------------------------------------------

export type ProviderStatus = "healthy" | "degraded" | "down" | "unknown";

export interface ProviderHealth {
  providerId: ProviderId;
  status: ProviderStatus;
  /** Rolling average latency in ms */
  avgLatencyMs: number;
  /** Error rate 0-1 over last 100 requests */
  errorRate: number;
  /** Last successful request timestamp */
  lastSuccessAt: number | null;
  /** Last error message */
  lastError: string | null;
  /** Consecutive failures */
  consecutiveFailures: number;
}

// ---------------------------------------------------------------------------
// Chat request/response
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentBlock[];
  /** Tool call ID (for tool role) */
  toolCallId?: string;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; url: string; mimeType?: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: string; isError?: boolean };

export interface ChatRequest {
  /** Which fallback chain role to use */
  role: ModelRole;
  messages: ChatMessage[];
  /** Override specific model (bypasses fallback chain) */
  modelOverride?: string;
  /** Max tokens for this request */
  maxTokens?: number;
  /** Temperature 0-2 */
  temperature?: number;
  /** Stop sequences */
  stop?: string[];
  /** Whether to stream the response */
  stream: boolean;
  /** Request metadata for tracking */
  metadata?: Record<string, string>;
}

export interface ChatChunk {
  /** Incremental text content */
  delta: string;
  /** Model that produced this chunk */
  modelId: string;
  /** Provider that served this chunk */
  providerId: ProviderId;
  /** Whether this is the final chunk */
  done: boolean;
  /** Token usage (populated on final chunk) */
  usage?: TokenUsage;
}

export interface ChatResponse {
  content: string;
  modelId: string;
  providerId: ProviderId;
  usage: TokenUsage;
  /** Time to first token in ms */
  ttftMs: number;
  /** Total response time in ms */
  totalMs: number;
}

// ---------------------------------------------------------------------------
// Token tracking / cost governance
// ---------------------------------------------------------------------------

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** Cache read tokens (Anthropic prompt caching) */
  cacheReadTokens?: number;
  /** Cache write tokens */
  cacheWriteTokens?: number;
}

export interface CostRecord {
  providerId: ProviderId;
  modelId: string;
  usage: TokenUsage;
  costUsd: number;
  timestamp: number;
  sessionId: string;
}

export interface BudgetConfig {
  /** Max spend per session in USD (0 = unlimited) */
  sessionLimitUsd: number;
  /** Max spend per day in USD (0 = unlimited) */
  dailyLimitUsd: number;
  /** What to do when budget is exceeded */
  onExceeded: "block" | "warn" | "downgrade-model";
}
