import { describe, it, expect, vi } from "vitest";
import { FallbackRouter, AllProvidersExhaustedError } from "./fallback.js";
import { ProviderRegistry } from "./registry.js";
import { BaseProvider } from "./provider.js";
import type {
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ProviderConfig,
  FallbackChain,
  ModelProfile,
} from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// Test provider
// ---------------------------------------------------------------------------

class MockProvider extends BaseProvider {
  chatFn = vi.fn<(req: ChatRequest) => Promise<ChatResponse>>();
  chatStreamFn = vi.fn<(req: ChatRequest) => AsyncIterable<ChatChunk>>();
  pingFn = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.chatFn(request);
  }

  async *chatStream(request: ChatRequest): AsyncIterable<ChatChunk> {
    yield* this.chatStreamFn(request);
  }

  async ping(): Promise<boolean> {
    return this.pingFn();
  }

  async listModels(): Promise<string[]> {
    return this.config.models;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(id: string, overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    id,
    kind: "openai-compatible",
    label: id,
    baseUrl: `http://${id}`,
    models: [`${id}-model`],
    isLocal: false,
    rateLimit: 0,
    timeoutMs: 30_000,
    enabled: true,
    ...overrides,
  };
}

function makeProfile(providerId: string, modelId?: string): ModelProfile {
  return {
    modelId: modelId ?? `${providerId}-model`,
    providerId,
    roles: ["chat"],
    contextWindow: 128_000,
    maxOutputTokens: 4096,
    inputCostPer1M: 3,
    outputCostPer1M: 15,
  };
}

function makeChain(overrides?: Partial<FallbackChain>): FallbackChain {
  return {
    role: "chat",
    chain: [],
    exhaustedStrategy: "error",
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

function makeResponse(providerId: string, modelId: string): ChatResponse {
  return {
    content: `Response from ${providerId}`,
    modelId,
    providerId,
    usage: { inputTokens: 10, outputTokens: 5 },
    ttftMs: 50,
    totalMs: 100,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FallbackRouter", () => {
  describe("chain management", () => {
    it("registers and retrieves chains", () => {
      const router = new FallbackRouter(new ProviderRegistry());
      const chain = makeChain({ role: "chat", chain: [makeProfile("p1")] });
      router.setChain(chain);

      expect(router.getChain("chat")).toEqual(chain);
      expect(router.listChains()).toHaveLength(1);
    });

    it("overwrites existing chain for same role", () => {
      const router = new FallbackRouter(new ProviderRegistry());
      router.setChain(makeChain({ role: "chat", chain: [makeProfile("p1")] }));
      router.setChain(makeChain({ role: "chat", chain: [makeProfile("p2")] }));

      expect(router.getChain("chat")!.chain[0].providerId).toBe("p2");
      expect(router.listChains()).toHaveLength(1);
    });

    it("removes a chain", () => {
      const router = new FallbackRouter(new ProviderRegistry());
      router.setChain(makeChain({ role: "chat" }));
      expect(router.removeChain("chat")).toBe(true);
      expect(router.getChain("chat")).toBeUndefined();
    });

    it("returns false when removing non-existent chain", () => {
      const router = new FallbackRouter(new ProviderRegistry());
      expect(router.removeChain("chat")).toBe(false);
    });
  });

  describe("chat()", () => {
    it("routes to the first healthy provider", async () => {
      const registry = new ProviderRegistry();
      const p1 = new MockProvider(makeConfig("p1"));
      p1.chatFn.mockResolvedValue(makeResponse("p1", "p1-model"));
      registry.register(p1);

      const router = new FallbackRouter(registry);
      router.setChain(makeChain({ chain: [makeProfile("p1")] }));

      const result = await router.chat(makeRequest());
      expect(result.providerId).toBe("p1");
      expect(result.content).toBe("Response from p1");
    });

    it("passes modelOverride from the chain profile", async () => {
      const registry = new ProviderRegistry();
      const p1 = new MockProvider(makeConfig("p1"));
      p1.chatFn.mockResolvedValue(makeResponse("p1", "custom-model"));
      registry.register(p1);

      const router = new FallbackRouter(registry);
      router.setChain(makeChain({ chain: [makeProfile("p1", "custom-model")] }));

      await router.chat(makeRequest());
      expect(p1.chatFn.mock.calls[0][0].modelOverride).toBe("custom-model");
    });

    it("falls through to next provider on failure", async () => {
      const registry = new ProviderRegistry();

      const p1 = new MockProvider(makeConfig("p1"));
      p1.chatFn.mockRejectedValue(new Error("rate limited"));
      registry.register(p1);

      const p2 = new MockProvider(makeConfig("p2"));
      p2.chatFn.mockResolvedValue(makeResponse("p2", "p2-model"));
      registry.register(p2);

      const router = new FallbackRouter(registry);
      router.setChain(
        makeChain({
          chain: [makeProfile("p1"), makeProfile("p2")],
        }),
      );

      const result = await router.chat(makeRequest());
      expect(result.providerId).toBe("p2");
    });

    it("skips disabled providers", async () => {
      const registry = new ProviderRegistry();

      const p1 = new MockProvider(makeConfig("p1", { enabled: false }));
      p1.chatFn.mockResolvedValue(makeResponse("p1", "p1-model"));
      registry.register(p1);

      const p2 = new MockProvider(makeConfig("p2"));
      p2.chatFn.mockResolvedValue(makeResponse("p2", "p2-model"));
      registry.register(p2);

      const router = new FallbackRouter(registry);
      router.setChain(
        makeChain({
          chain: [makeProfile("p1"), makeProfile("p2")],
        }),
      );

      const result = await router.chat(makeRequest());
      expect(result.providerId).toBe("p2");
      expect(p1.chatFn).not.toHaveBeenCalled();
    });

    it("skips providers with 'down' health status", async () => {
      const registry = new ProviderRegistry();

      const p1 = new MockProvider(makeConfig("p1"));
      // Drive p1 to "down" status
      for (let i = 0; i < 5; i++) p1.recordFailure("err");
      registry.register(p1);

      const p2 = new MockProvider(makeConfig("p2"));
      p2.chatFn.mockResolvedValue(makeResponse("p2", "p2-model"));
      registry.register(p2);

      const router = new FallbackRouter(registry);
      router.setChain(
        makeChain({
          chain: [makeProfile("p1"), makeProfile("p2")],
        }),
      );

      const result = await router.chat(makeRequest());
      expect(result.providerId).toBe("p2");
      expect(p1.chatFn).not.toHaveBeenCalled();
    });

    it("skips providers not in the registry", async () => {
      const registry = new ProviderRegistry();

      const p2 = new MockProvider(makeConfig("p2"));
      p2.chatFn.mockResolvedValue(makeResponse("p2", "p2-model"));
      registry.register(p2);

      const router = new FallbackRouter(registry);
      router.setChain(
        makeChain({
          chain: [makeProfile("nonexistent"), makeProfile("p2")],
        }),
      );

      const result = await router.chat(makeRequest());
      expect(result.providerId).toBe("p2");
    });

    it("throws when no chain configured for role", async () => {
      const router = new FallbackRouter(new ProviderRegistry());
      await expect(router.chat(makeRequest())).rejects.toThrow("No fallback chain configured");
    });

    it("throws AllProvidersExhaustedError with error strategy", async () => {
      const registry = new ProviderRegistry();
      const p1 = new MockProvider(makeConfig("p1"));
      p1.chatFn.mockRejectedValue(new Error("timeout"));
      registry.register(p1);

      const router = new FallbackRouter(registry);
      router.setChain(
        makeChain({
          chain: [makeProfile("p1")],
          exhaustedStrategy: "error",
        }),
      );

      try {
        await router.chat(makeRequest());
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(AllProvidersExhaustedError);
        const e = err as AllProvidersExhaustedError;
        expect(e.role).toBe("chat");
        expect(e.attempts).toHaveLength(1);
        expect(e.attempts[0].providerId).toBe("p1");
        expect(e.attempts[0].error).toBe("timeout");
      }
    });

    it("throws AllProvidersExhaustedError with queue strategy", async () => {
      const registry = new ProviderRegistry();
      const p1 = new MockProvider(makeConfig("p1"));
      p1.chatFn.mockRejectedValue(new Error("busy"));
      registry.register(p1);

      const router = new FallbackRouter(registry);
      router.setChain(
        makeChain({
          chain: [makeProfile("p1")],
          exhaustedStrategy: "queue",
        }),
      );

      await expect(router.chat(makeRequest())).rejects.toBeInstanceOf(AllProvidersExhaustedError);
    });

    it("returns degraded response with degrade strategy", async () => {
      const registry = new ProviderRegistry();
      const p1 = new MockProvider(makeConfig("p1"));
      p1.chatFn.mockRejectedValue(new Error("down"));
      registry.register(p1);

      const router = new FallbackRouter(registry);
      router.setChain(
        makeChain({
          chain: [makeProfile("p1")],
          exhaustedStrategy: "degrade",
        }),
      );

      const result = await router.chat(makeRequest());
      expect(result.content).toContain("unavailable");
      expect(result.providerId).toBe("none");
      expect(result.usage.inputTokens).toBe(0);
    });
  });

  describe("chatStream()", () => {
    it("streams from the first healthy provider", async () => {
      const registry = new ProviderRegistry();
      const p1 = new MockProvider(makeConfig("p1"));

      async function* fakeStream(): AsyncIterable<ChatChunk> {
        yield { delta: "Hi", modelId: "p1-model", providerId: "p1", done: false };
        yield { delta: "", modelId: "p1-model", providerId: "p1", done: true };
      }
      p1.chatStreamFn.mockReturnValue(fakeStream());
      registry.register(p1);

      const router = new FallbackRouter(registry);
      router.setChain(makeChain({ chain: [makeProfile("p1")] }));

      const chunks: ChatChunk[] = [];
      for await (const chunk of router.chatStream(makeRequest({ stream: true }))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0].delta).toBe("Hi");
      expect(chunks[1].done).toBe(true);
    });

    it("falls through on stream error", async () => {
      const registry = new ProviderRegistry();

      const p1 = new MockProvider(makeConfig("p1"));
      async function* failStream(): AsyncIterable<ChatChunk> {
        throw new Error("stream broken");
      }
      p1.chatStreamFn.mockReturnValue(failStream());
      registry.register(p1);

      const p2 = new MockProvider(makeConfig("p2"));
      async function* okStream(): AsyncIterable<ChatChunk> {
        yield { delta: "OK", modelId: "p2-model", providerId: "p2", done: true };
      }
      p2.chatStreamFn.mockReturnValue(okStream());
      registry.register(p2);

      const router = new FallbackRouter(registry);
      router.setChain(
        makeChain({
          chain: [makeProfile("p1"), makeProfile("p2")],
        }),
      );

      const chunks: ChatChunk[] = [];
      for await (const chunk of router.chatStream(makeRequest({ stream: true }))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].providerId).toBe("p2");
    });

    it("throws AllProvidersExhaustedError when all streams fail", async () => {
      const registry = new ProviderRegistry();
      const p1 = new MockProvider(makeConfig("p1"));
      async function* failStream(): AsyncIterable<ChatChunk> {
        throw new Error("fail");
      }
      p1.chatStreamFn.mockReturnValue(failStream());
      registry.register(p1);

      const router = new FallbackRouter(registry);
      router.setChain(makeChain({ chain: [makeProfile("p1")] }));

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of router.chatStream(makeRequest({ stream: true }))) {
          // consume
        }
      }).rejects.toBeInstanceOf(AllProvidersExhaustedError);
    });
  });

  describe("resolve()", () => {
    it("returns the first healthy provider for a role", () => {
      const registry = new ProviderRegistry();
      const p1 = new MockProvider(makeConfig("p1"));
      p1.recordSuccess(100); // mark healthy
      registry.register(p1);

      const router = new FallbackRouter(registry);
      router.setChain(makeChain({ chain: [makeProfile("p1", "gpt-4o")] }));

      const result = router.resolve("chat");
      expect(result).toBeDefined();
      expect(result!.modelId).toBe("gpt-4o");
    });

    it("skips down providers", () => {
      const registry = new ProviderRegistry();

      const p1 = new MockProvider(makeConfig("p1"));
      for (let i = 0; i < 5; i++) p1.recordFailure("err");
      registry.register(p1);

      const p2 = new MockProvider(makeConfig("p2"));
      p2.recordSuccess(50);
      registry.register(p2);

      const router = new FallbackRouter(registry);
      router.setChain(
        makeChain({
          chain: [makeProfile("p1"), makeProfile("p2")],
        }),
      );

      const result = router.resolve("chat");
      expect(result).toBeDefined();
      expect(result!.provider.config.id).toBe("p2");
    });

    it("returns undefined when no chain exists", () => {
      const router = new FallbackRouter(new ProviderRegistry());
      expect(router.resolve("chat")).toBeUndefined();
    });

    it("returns undefined when all providers unavailable", () => {
      const registry = new ProviderRegistry();
      const p1 = new MockProvider(makeConfig("p1", { enabled: false }));
      registry.register(p1);

      const router = new FallbackRouter(registry);
      router.setChain(makeChain({ chain: [makeProfile("p1")] }));

      expect(router.resolve("chat")).toBeUndefined();
    });
  });
});
