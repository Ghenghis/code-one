import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type { ProviderConfig, ChatRequest } from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function testConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: "oai-test",
    kind: "openai-compatible",
    label: "Test OpenAI",
    baseUrl: "http://localhost:11434",
    models: ["gpt-4o"],
    isLocal: false,
    rateLimit: 0,
    timeoutMs: 30_000,
    enabled: true,
    ...overrides,
  };
}

function makeRequest(overrides?: Partial<ChatRequest>): ChatRequest {
  return {
    role: "chat",
    messages: [{ role: "user", content: "Hello" }],
    stream: false,
    ...overrides,
  };
}

/** Build a mock Response for non-streaming calls. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Build a mock SSE streaming response. */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OpenAICompatibleProvider", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- chat() -------------------------------------------------------------

  describe("chat()", () => {
    it("sends correct request body and parses response", async () => {
      const apiResponse = {
        id: "chatcmpl-1",
        choices: [{ message: { role: "assistant", content: "Hi there" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        model: "gpt-4o",
      };
      fetchSpy.mockResolvedValueOnce(jsonResponse(apiResponse));

      const provider = new OpenAICompatibleProvider(testConfig(), "sk-test");
      const result = await provider.chat(makeRequest({ temperature: 0.7, maxTokens: 100 }));

      // Verify outgoing request
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, opts] = fetchSpy.mock.calls[0];
      expect(url).toBe("http://localhost:11434/v1/chat/completions");
      expect(opts.method).toBe("POST");

      const sentBody = JSON.parse(opts.body);
      expect(sentBody.model).toBe("gpt-4o");
      expect(sentBody.messages).toEqual([{ role: "user", content: "Hello" }]);
      expect(sentBody.temperature).toBe(0.7);
      expect(sentBody.max_tokens).toBe(100);
      expect(sentBody.stream).toBe(false);

      // Verify parsed response
      expect(result.content).toBe("Hi there");
      expect(result.modelId).toBe("gpt-4o");
      expect(result.providerId).toBe("oai-test");
      expect(result.usage.inputTokens).toBe(5);
      expect(result.usage.outputTokens).toBe(3);
      expect(result.totalMs).toBeGreaterThanOrEqual(0);
    });

    it("records success with latency on 200", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          id: "c-1",
          choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          model: "gpt-4o",
        }),
      );

      const provider = new OpenAICompatibleProvider(testConfig());
      await provider.chat(makeRequest());

      expect(provider.health.status).toBe("healthy");
      expect(provider.health.avgLatencyMs).toBeGreaterThanOrEqual(0);
      expect(provider.health.lastSuccessAt).toBeGreaterThan(0);
    });

    it("records failure and throws on non-200", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("rate limit exceeded", { status: 429 }));

      const provider = new OpenAICompatibleProvider(testConfig());
      await expect(provider.chat(makeRequest())).rejects.toThrow("HTTP 429");
      expect(provider.health.consecutiveFailures).toBe(1);
      expect(provider.health.lastError).toContain("429");
    });

    it("throws on empty choices array", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          id: "c-1",
          choices: [],
          model: "gpt-4o",
        }),
      );

      const provider = new OpenAICompatibleProvider(testConfig());
      await expect(provider.chat(makeRequest())).rejects.toThrow("Empty choices");
      expect(provider.health.consecutiveFailures).toBe(1);
    });

    it("throws on missing choices field", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          id: "c-1",
          model: "gpt-4o",
        }),
      );

      const provider = new OpenAICompatibleProvider(testConfig());
      await expect(provider.chat(makeRequest())).rejects.toThrow("Empty choices");
    });
  });

  // ---- chatStream() -------------------------------------------------------

  describe("chatStream()", () => {
    it("parses SSE chunks correctly", async () => {
      const sseData = [
        'data: {"id":"c-1","choices":[{"delta":{"role":"assistant","content":"Hel"},"finish_reason":null}],"model":"gpt-4o"}\n\n',
        'data: {"id":"c-1","choices":[{"delta":{"content":"lo"},"finish_reason":null}],"model":"gpt-4o"}\n\n',
        'data: {"id":"c-1","choices":[{"delta":{},"finish_reason":"stop"}],"model":"gpt-4o","usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n\n',
        "data: [DONE]\n\n",
      ];
      fetchSpy.mockResolvedValueOnce(sseResponse(sseData));

      const provider = new OpenAICompatibleProvider(testConfig());
      const chunks: Array<{ delta: string; done: boolean; usage?: unknown }> = [];

      for await (const chunk of provider.chatStream(makeRequest({ stream: true }))) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(3);
      expect(chunks[0].delta).toBe("Hel");
      expect(chunks[0].done).toBe(false);
      expect(chunks[1].delta).toBe("lo");
      expect(chunks[1].done).toBe(false);
    });

    it("yields done:true with usage on final chunk", async () => {
      const sseData = [
        'data: {"id":"c-1","choices":[{"delta":{"content":"Hi"},"finish_reason":null}],"model":"gpt-4o"}\n\n',
        'data: {"id":"c-1","choices":[{"delta":{},"finish_reason":"stop"}],"model":"gpt-4o","usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
        "data: [DONE]\n\n",
      ];
      fetchSpy.mockResolvedValueOnce(sseResponse(sseData));

      const provider = new OpenAICompatibleProvider(testConfig());
      const chunks: Array<{
        delta: string;
        done: boolean;
        usage?: { inputTokens: number; outputTokens: number };
      }> = [];

      for await (const chunk of provider.chatStream(makeRequest({ stream: true }))) {
        chunks.push(chunk);
      }

      const last = chunks[chunks.length - 1];
      expect(last.done).toBe(true);
      expect(last.usage).toBeDefined();
      expect(last.usage!.inputTokens).toBe(10);
      expect(last.usage!.outputTokens).toBe(5);
    });

    it("throws on non-200 streaming response", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("server error", { status: 500 }));

      const provider = new OpenAICompatibleProvider(testConfig());
      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of provider.chatStream(makeRequest({ stream: true }))) {
          // should not reach here
        }
      }).rejects.toThrow("HTTP 500");
    });

    it("records success after full stream consumption", async () => {
      const sseData = [
        'data: {"id":"c-1","choices":[{"delta":{"content":"Hi"},"finish_reason":null}],"model":"gpt-4o"}\n\n',
        'data: {"id":"c-1","choices":[{"delta":{},"finish_reason":"stop"}],"model":"gpt-4o"}\n\n',
        "data: [DONE]\n\n",
      ];
      fetchSpy.mockResolvedValueOnce(sseResponse(sseData));

      const provider = new OpenAICompatibleProvider(testConfig());
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of provider.chatStream(makeRequest({ stream: true }))) {
        // consume all
      }

      expect(provider.health.status).toBe("healthy");
      expect(provider.health.lastSuccessAt).toBeGreaterThan(0);
    });

    it("handles \\r\\n line endings in SSE", async () => {
      const sseData = [
        'data: {"id":"c-1","choices":[{"delta":{"content":"Hi"},"finish_reason":null}],"model":"gpt-4o"}\r\n\r\n',
        'data: {"id":"c-1","choices":[{"delta":{},"finish_reason":"stop"}],"model":"gpt-4o"}\r\n\r\n',
        "data: [DONE]\r\n\r\n",
      ];
      fetchSpy.mockResolvedValueOnce(sseResponse(sseData));

      const provider = new OpenAICompatibleProvider(testConfig());
      const chunks: Array<{ delta: string; done: boolean }> = [];
      for await (const chunk of provider.chatStream(makeRequest({ stream: true }))) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(2);
      expect(chunks[0].delta).toBe("Hi");
      expect(chunks[1].done).toBe(true);
    });
  });

  // ---- toOpenAIMessages (via round-trip) -----------------------------------

  describe("message conversion", () => {
    it("converts string content messages", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          id: "c-1",
          choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          model: "gpt-4o",
        }),
      );

      const provider = new OpenAICompatibleProvider(testConfig());
      await provider.chat(
        makeRequest({
          messages: [
            { role: "system", content: "You are helpful" },
            { role: "user", content: "Hi" },
          ],
        }),
      );

      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody.messages).toEqual([
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hi" },
      ]);
    });

    it("converts ContentBlock[] messages to text", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          id: "c-1",
          choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          model: "gpt-4o",
        }),
      );

      const provider = new OpenAICompatibleProvider(testConfig());
      await provider.chat(
        makeRequest({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "First block" },
                { type: "image", url: "http://example.com/img.png" },
                { type: "text", text: "Second block" },
              ],
            },
          ],
        }),
      );

      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      // Image blocks are filtered out; text blocks joined with \n
      expect(sentBody.messages[0].content).toBe("First block\nSecond block");
    });

    it("includes tool_call_id for tool messages", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          id: "c-1",
          choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          model: "gpt-4o",
        }),
      );

      const provider = new OpenAICompatibleProvider(testConfig());
      await provider.chat(
        makeRequest({
          messages: [{ role: "tool", content: "result data", toolCallId: "call_abc123" }],
        }),
      );

      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody.messages[0].tool_call_id).toBe("call_abc123");
    });
  });

  // ---- ping() --------------------------------------------------------------

  describe("ping()", () => {
    it("returns true on 200", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ data: [] }));
      const provider = new OpenAICompatibleProvider(testConfig());
      expect(await provider.ping()).toBe(true);

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe("http://localhost:11434/v1/models");
    });

    it("returns false on error", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const provider = new OpenAICompatibleProvider(testConfig());
      expect(await provider.ping()).toBe(false);
    });
  });

  // ---- listModels() --------------------------------------------------------

  describe("listModels()", () => {
    it("parses model list from API", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }, { id: "o1-preview" }],
        }),
      );

      const provider = new OpenAICompatibleProvider(testConfig());
      const models = await provider.listModels();
      expect(models).toEqual(["gpt-4o", "gpt-4o-mini", "o1-preview"]);
    });

    it("falls back to config.models on error", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("network down"));
      const provider = new OpenAICompatibleProvider(testConfig({ models: ["fallback-model"] }));
      const models = await provider.listModels();
      expect(models).toEqual(["fallback-model"]);
    });
  });

  // ---- setApiKey / Authorization header ------------------------------------

  describe("setApiKey()", () => {
    it("includes Authorization header after setApiKey", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          id: "c-1",
          choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          model: "gpt-4o",
        }),
      );

      const provider = new OpenAICompatibleProvider(testConfig());
      provider.setApiKey("sk-new-key");
      await provider.chat(makeRequest());

      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers["Authorization"]).toBe("Bearer sk-new-key");
    });

    it("omits Authorization header when no key set", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          id: "c-1",
          choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          model: "gpt-4o",
        }),
      );

      const provider = new OpenAICompatibleProvider(testConfig());
      await provider.chat(makeRequest());

      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers["Authorization"]).toBeUndefined();
    });
  });

  // ---- modelOverride -------------------------------------------------------

  describe("model selection", () => {
    it("uses modelOverride when provided", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          id: "c-1",
          choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          model: "gpt-4o-mini",
        }),
      );

      const provider = new OpenAICompatibleProvider(testConfig());
      await provider.chat(makeRequest({ modelOverride: "gpt-4o-mini" }));

      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody.model).toBe("gpt-4o-mini");
    });

    it("throws when no models configured and no override", async () => {
      const provider = new OpenAICompatibleProvider(testConfig({ models: [] }));
      await expect(provider.chat(makeRequest())).rejects.toThrow("no models configured");
    });

    it("falls back to first config model when no override", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          id: "c-1",
          choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          model: "llama-3",
        }),
      );

      const provider = new OpenAICompatibleProvider(testConfig({ models: ["llama-3", "llama-2"] }));
      await provider.chat(makeRequest());

      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody.model).toBe("llama-3");
    });
  });
});
