import { describe, it, expect, vi } from "vitest";
import { AIGateway } from "./gateway.js";
import { BaseProvider } from "./provider.js";
import { BudgetExceededError } from "./cost.js";
import { AllProvidersExhaustedError } from "./fallback.js";
import type {
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ProviderConfig,
  FallbackChain,
  ModelProfile,
  BudgetConfig,
} from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// Mock provider
// ---------------------------------------------------------------------------

class MockProvider extends BaseProvider {
  chatFn = vi.fn<(req: ChatRequest) => Promise<ChatResponse>>();
  chatStreamFn = vi.fn<(req: ChatRequest) => AsyncIterable<ChatChunk>>();

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.chatFn(request);
  }

  async *chatStream(request: ChatRequest): AsyncIterable<ChatChunk> {
    yield* this.chatStreamFn(request);
  }

  async ping(): Promise<boolean> {
    return true;
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
    inputCostPer1M: 5,
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

function makeResponse(providerId: string): ChatResponse {
  return {
    content: `Response from ${providerId}`,
    modelId: `${providerId}-model`,
    providerId,
    usage: { inputTokens: 1000, outputTokens: 500 },
    ttftMs: 50,
    totalMs: 100,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AIGateway", () => {
  function createGateway(budget?: Partial<BudgetConfig>): AIGateway {
    return new AIGateway({
      sessionId: "test-session",
      budget: makeBudget(budget),
    });
  }

  describe("provider management", () => {
    it("registers and lists providers", () => {
      const gw = createGateway();
      const p1 = new MockProvider(makeConfig("p1"));
      gw.registerProvider(p1, [makeProfile("p1")]);

      expect(gw.listProviders()).toHaveLength(1);
      expect(gw.listProviders()[0].id).toBe("p1");
    });

    it("unregisters a provider", () => {
      const gw = createGateway();
      const p1 = new MockProvider(makeConfig("p1"));
      gw.registerProvider(p1);

      expect(gw.unregisterProvider("p1")).toBe(true);
      expect(gw.listProviders()).toHaveLength(0);
    });

    it("lists health for all providers", () => {
      const gw = createGateway();
      const p1 = new MockProvider(makeConfig("p1"));
      gw.registerProvider(p1);

      const health = gw.listHealth();
      expect(health).toHaveLength(1);
      expect(health[0].providerId).toBe("p1");
    });
  });

  describe("chat()", () => {
    it("routes request and records cost", async () => {
      const gw = createGateway();
      const p1 = new MockProvider(makeConfig("p1"));
      p1.chatFn.mockResolvedValue(makeResponse("p1"));
      gw.registerProvider(p1, [makeProfile("p1")]);
      gw.setFallbackChain(makeChain({ chain: [makeProfile("p1")] }));

      const result = await gw.chat(makeRequest());

      expect(result.content).toBe("Response from p1");
      expect(gw.getCostRecords()).toHaveLength(1);
      expect(gw.getSessionCostUsd()).toBeGreaterThan(0);
    });

    it("tracks total tokens", async () => {
      const gw = createGateway();
      const p1 = new MockProvider(makeConfig("p1"));
      p1.chatFn.mockResolvedValue(makeResponse("p1"));
      gw.registerProvider(p1, [makeProfile("p1")]);
      gw.setFallbackChain(makeChain({ chain: [makeProfile("p1")] }));

      await gw.chat(makeRequest());

      const tokens = gw.getTotalTokens();
      expect(tokens.input).toBe(1000);
      expect(tokens.output).toBe(500);
    });

    it("throws BudgetExceededError when over session limit", async () => {
      const gw = createGateway({ sessionLimitUsd: 0.001, onExceeded: "block" });
      const p1 = new MockProvider(makeConfig("p1"));
      p1.chatFn.mockResolvedValue(makeResponse("p1"));
      gw.registerProvider(p1, [makeProfile("p1")]);
      gw.setFallbackChain(makeChain({ chain: [makeProfile("p1")] }));

      // First call succeeds
      await gw.chat(makeRequest());

      // Second call should be blocked by budget
      await expect(gw.chat(makeRequest())).rejects.toBeInstanceOf(BudgetExceededError);
    });

    it("falls through to second provider on failure", async () => {
      const gw = createGateway();

      const p1 = new MockProvider(makeConfig("p1"));
      p1.chatFn.mockRejectedValue(new Error("timeout"));
      gw.registerProvider(p1, [makeProfile("p1")]);

      const p2 = new MockProvider(makeConfig("p2"));
      p2.chatFn.mockResolvedValue(makeResponse("p2"));
      gw.registerProvider(p2, [makeProfile("p2")]);

      gw.setFallbackChain(makeChain({
        chain: [makeProfile("p1"), makeProfile("p2")],
      }));

      const result = await gw.chat(makeRequest());
      expect(result.providerId).toBe("p2");
    });
  });

  describe("chatStream()", () => {
    it("streams and records usage from final chunk", async () => {
      const gw = createGateway();
      const p1 = new MockProvider(makeConfig("p1"));

      async function* fakeStream(): AsyncIterable<ChatChunk> {
        yield { delta: "Hi", modelId: "p1-model", providerId: "p1", done: false };
        yield {
          delta: "",
          modelId: "p1-model",
          providerId: "p1",
          done: true,
          usage: { inputTokens: 500, outputTokens: 200 },
        };
      }
      p1.chatStreamFn.mockReturnValue(fakeStream());
      gw.registerProvider(p1, [makeProfile("p1")]);
      gw.setFallbackChain(makeChain({ chain: [makeProfile("p1")] }));

      const chunks: ChatChunk[] = [];
      for await (const chunk of gw.chatStream(makeRequest({ stream: true }))) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(gw.getCostRecords()).toHaveLength(1);
      expect(gw.getTotalTokens().input).toBe(500);
    });

    it("blocks stream when budget exceeded", async () => {
      const gw = createGateway({ sessionLimitUsd: 0.001, onExceeded: "block" });
      const p1 = new MockProvider(makeConfig("p1"));

      // First: non-stream call to burn budget
      p1.chatFn.mockResolvedValue(makeResponse("p1"));
      gw.registerProvider(p1, [makeProfile("p1")]);
      gw.setFallbackChain(makeChain({ chain: [makeProfile("p1")] }));
      await gw.chat(makeRequest());

      // Second: stream should be blocked
      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of gw.chatStream(makeRequest({ stream: true }))) {
          // should not reach
        }
      }).rejects.toBeInstanceOf(BudgetExceededError);
    });
  });

  describe("resolveProvider()", () => {
    it("resolves the first healthy provider for a role", () => {
      const gw = createGateway();
      const p1 = new MockProvider(makeConfig("p1"));
      p1.recordSuccess(50);
      gw.registerProvider(p1);
      gw.setFallbackChain(makeChain({ chain: [makeProfile("p1", "gpt-4o")] }));

      const result = gw.resolveProvider("chat");
      expect(result).toEqual({ providerId: "p1", modelId: "gpt-4o" });
    });

    it("returns undefined when no providers available", () => {
      const gw = createGateway();
      expect(gw.resolveProvider("chat")).toBeUndefined();
    });
  });

  describe("health monitor lifecycle", () => {
    it("starts and stops health monitor", () => {
      const gw = createGateway();
      gw.startHealthMonitor();
      expect(gw.healthMonitor.isRunning).toBe(true);

      gw.stopHealthMonitor();
      expect(gw.healthMonitor.isRunning).toBe(false);
    });

    it("shutdown stops health monitor", () => {
      const gw = createGateway();
      gw.startHealthMonitor();
      gw.shutdown();
      expect(gw.healthMonitor.isRunning).toBe(false);
    });
  });
});
