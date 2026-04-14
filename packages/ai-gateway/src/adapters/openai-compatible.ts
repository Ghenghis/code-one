import { BaseProvider } from "../provider.js";
import type {
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ChatMessage,
  ContentBlock,
  ProviderConfig,
  TokenUsage,
} from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// OpenAI API shapes (subset we care about)
// ---------------------------------------------------------------------------

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
}

interface OpenAIChatResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string | null };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

interface OpenAIStreamChunk {
  id: string;
  choices: Array<{
    delta: { role?: string; content?: string | null };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
  model: string;
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function toOpenAIMessages(messages: ChatMessage[]): OpenAIMessage[] {
  return messages.map((m) => {
    let content: string | null;
    if (typeof m.content === "string") {
      content = m.content;
    } else {
      // Flatten content blocks to text for OpenAI compatibility
      content =
        (m.content as ContentBlock[])
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text)
          .join("\n") || null;
    }
    const msg: OpenAIMessage = { role: m.role, content };
    if (m.toolCallId) msg.tool_call_id = m.toolCallId;
    return msg;
  });
}

function toTokenUsage(
  usage?: { prompt_tokens: number; completion_tokens: number } | null,
): TokenUsage {
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Provider adapter for any OpenAI-compatible API.
 *
 * Works with OpenAI, Groq, Together, Ollama (with OpenAI compat endpoint),
 * LM Studio, vLLM, and any other server exposing the `/v1/chat/completions`
 * endpoint.
 */
export class OpenAICompatibleProvider extends BaseProvider {
  private _apiKey: string | undefined;

  constructor(config: ProviderConfig, apiKey?: string) {
    super(config);
    this._apiKey = apiKey;
  }

  /** Set or rotate the API key at runtime. */
  setApiKey(key: string): void {
    this._apiKey = key;
  }

  // -- private helpers ------------------------------------------------------

  private _headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this._apiKey) h["Authorization"] = `Bearer ${this._apiKey}`;
    return h;
  }

  private _modelId(request: ChatRequest): string {
    return request.modelOverride ?? this.config.models[0] ?? "gpt-4o";
  }

  // -- public API -----------------------------------------------------------

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const modelId = this._modelId(request);
    const startMs = Date.now();

    const body: Record<string, unknown> = {
      model: modelId,
      messages: toOpenAIMessages(request.messages),
      stream: false,
    };
    if (request.maxTokens != null) body.max_tokens = request.maxTokens;
    if (request.temperature != null) body.temperature = request.temperature;
    if (request.stop) body.stop = request.stop;

    const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = `HTTP ${res.status}: ${text}`;
      this.recordFailure(err);
      throw new Error(err);
    }

    const data = (await res.json()) as OpenAIChatResponse;
    const totalMs = Date.now() - startMs;

    this.recordSuccess(totalMs);

    return {
      content: data.choices[0]?.message?.content ?? "",
      modelId: data.model ?? modelId,
      providerId: this.config.id,
      usage: toTokenUsage(data.usage),
      ttftMs: totalMs, // Non-streaming: TTFT equals total
      totalMs,
    };
  }

  async *chatStream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const modelId = this._modelId(request);
    const startMs = Date.now();
    let firstChunkMs: number | undefined;

    const body: Record<string, unknown> = {
      model: modelId,
      messages: toOpenAIMessages(request.messages),
      stream: true,
      stream_options: { include_usage: true },
    };
    if (request.maxTokens != null) body.max_tokens = request.maxTokens;
    if (request.temperature != null) body.temperature = request.temperature;
    if (request.stop) body.stop = request.stop;

    const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = `HTTP ${res.status}: ${text}`;
      this.recordFailure(err);
      throw new Error(err);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let lastUsage: TokenUsage | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") continue;

          let chunk: OpenAIStreamChunk;
          try {
            chunk = JSON.parse(payload) as OpenAIStreamChunk;
          } catch {
            continue; // skip malformed lines
          }

          if (!firstChunkMs) firstChunkMs = Date.now() - startMs;

          const delta = chunk.choices[0]?.delta?.content ?? "";
          const isDone = chunk.choices[0]?.finish_reason != null;

          if (chunk.usage) {
            lastUsage = toTokenUsage(chunk.usage);
          }

          const out: ChatChunk = {
            delta,
            modelId: chunk.model ?? modelId,
            providerId: this.config.id,
            done: isDone,
          };
          if (isDone && lastUsage) out.usage = lastUsage;

          yield out;
        }
      }
    } finally {
      reader.releaseLock();
    }

    this.recordSuccess(Date.now() - startMs);
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/v1/models`, {
        method: "GET",
        headers: this._headers(),
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.config.baseUrl}/v1/models`, {
        method: "GET",
        headers: this._headers(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return this.config.models;
      const data = (await res.json()) as { data: Array<{ id: string }> };
      return data.data.map((m) => m.id);
    } catch {
      return this.config.models;
    }
  }
}
