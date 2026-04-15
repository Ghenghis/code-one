import { describe, it, expect } from "vitest";
import { BaseProvider } from "./provider.js";
import type { ChatRequest, ChatResponse, ChatChunk, ProviderConfig } from "@code-one/shared-types";

class TestProvider extends BaseProvider {
  async chat(_request: ChatRequest): Promise<ChatResponse> {
    return {
      content: "test",
      modelId: "test-model",
      providerId: this.config.id,
      usage: { inputTokens: 10, outputTokens: 5 },
      ttftMs: 100,
      totalMs: 200,
    };
  }

  async *chatStream(_request: ChatRequest): AsyncIterable<ChatChunk> {
    yield {
      delta: "hello",
      modelId: "test-model",
      providerId: this.config.id,
      done: false,
    };
    yield {
      delta: "",
      modelId: "test-model",
      providerId: this.config.id,
      done: true,
      usage: { inputTokens: 10, outputTokens: 5 },
    };
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async listModels(): Promise<string[]> {
    return ["test-model"];
  }
}

function testConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: "test-provider",
    kind: "openai-compatible",
    label: "Test Provider",
    baseUrl: "http://localhost:8080",
    models: ["test-model"],
    isLocal: true,
    rateLimit: 0,
    timeoutMs: 30000,
    enabled: true,
    ...overrides,
  };
}

describe("BaseProvider", () => {
  it("initializes with unknown health status", () => {
    const p = new TestProvider(testConfig());
    expect(p.health.status).toBe("unknown");
    expect(p.health.consecutiveFailures).toBe(0);
    expect(p.health.lastSuccessAt).toBeNull();
  });

  it("stores config", () => {
    const config = testConfig({ id: "my-provider" });
    const p = new TestProvider(config);
    expect(p.config.id).toBe("my-provider");
    expect(p.config.kind).toBe("openai-compatible");
  });

  describe("recordSuccess", () => {
    it("updates health to healthy", () => {
      const p = new TestProvider(testConfig());
      p.recordSuccess(100);
      expect(p.health.status).toBe("healthy");
      expect(p.health.avgLatencyMs).toBe(100);
      expect(p.health.lastSuccessAt).toBeGreaterThan(0);
      expect(p.health.consecutiveFailures).toBe(0);
    });

    it("computes rolling average latency", () => {
      const p = new TestProvider(testConfig());
      p.recordSuccess(100);
      p.recordSuccess(200);
      p.recordSuccess(300);
      expect(p.health.avgLatencyMs).toBe(200);
    });

    it("clears consecutive failures", () => {
      const p = new TestProvider(testConfig());
      p.recordFailure("err");
      p.recordFailure("err");
      expect(p.health.consecutiveFailures).toBe(2);
      p.recordSuccess(100);
      expect(p.health.consecutiveFailures).toBe(0);
    });

    it("updates errorRate on success", () => {
      const p = new TestProvider(testConfig());
      p.recordSuccess(100);
      expect(p.health.errorRate).toBe(0);
    });
  });

  describe("recordFailure", () => {
    it("increments consecutive failures", () => {
      const p = new TestProvider(testConfig());
      p.recordFailure("timeout");
      expect(p.health.consecutiveFailures).toBe(1);
      expect(p.health.lastError).toBe("timeout");
    });

    it("marks degraded after 2 failures", () => {
      const p = new TestProvider(testConfig());
      p.recordFailure("err");
      p.recordFailure("err");
      expect(p.health.status).toBe("degraded");
    });

    it("marks down after 5 failures", () => {
      const p = new TestProvider(testConfig());
      for (let i = 0; i < 5; i++) p.recordFailure("err");
      expect(p.health.status).toBe("down");
    });

    it("updates errorRate on failure", () => {
      const p = new TestProvider(testConfig());
      p.recordFailure("err");
      expect(p.health.errorRate).toBe(1);
    });
  });

  describe("errorRate sliding window", () => {
    it("computes errorRate from mixed outcomes", () => {
      const p = new TestProvider(testConfig());
      p.recordSuccess(100);
      p.recordSuccess(100);
      p.recordFailure("err");
      p.recordSuccess(100);
      // 1 failure out of 4 = 0.25
      expect(p.health.errorRate).toBe(0.25);
    });

    it("returns 0 errorRate when all successes", () => {
      const p = new TestProvider(testConfig());
      for (let i = 0; i < 10; i++) p.recordSuccess(100);
      expect(p.health.errorRate).toBe(0);
    });

    it("returns 1 errorRate when all failures", () => {
      const p = new TestProvider(testConfig());
      for (let i = 0; i < 5; i++) p.recordFailure("err");
      expect(p.health.errorRate).toBe(1);
    });
  });

  describe("health snapshot is a copy", () => {
    it("returns a new object each time", () => {
      const p = new TestProvider(testConfig());
      const h1 = p.health;
      const h2 = p.health;
      expect(h1).not.toBe(h2);
      expect(h1).toEqual(h2);
    });
  });

  describe("concrete methods", () => {
    it("chat returns a response", async () => {
      const p = new TestProvider(testConfig());
      const res = await p.chat({ role: "chat", messages: [], stream: false });
      expect(res.content).toBe("test");
    });

    it("chatStream yields chunks", async () => {
      const p = new TestProvider(testConfig());
      const chunks: ChatChunk[] = [];
      for await (const chunk of p.chatStream({ role: "chat", messages: [], stream: true })) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(2);
      expect(chunks[0].delta).toBe("hello");
      expect(chunks[1].done).toBe(true);
    });

    it("ping returns true", async () => {
      const p = new TestProvider(testConfig());
      expect(await p.ping()).toBe(true);
    });

    it("listModels returns models", async () => {
      const p = new TestProvider(testConfig());
      expect(await p.listModels()).toEqual(["test-model"]);
    });
  });
});
