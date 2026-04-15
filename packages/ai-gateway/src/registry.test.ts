import { describe, it, expect, beforeEach } from "vitest";
import { ProviderRegistry } from "./registry.js";
import { BaseProvider } from "./provider.js";
import type { ChatRequest, ChatResponse, ChatChunk, ProviderConfig } from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

class TestProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

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

function makeConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: "p1",
    kind: "openai-compatible",
    label: "Provider 1",
    baseUrl: "http://localhost:8080",
    models: ["test-model"],
    isLocal: true,
    rateLimit: 0,
    timeoutMs: 30000,
    enabled: true,
    ...overrides,
  };
}

function makeProvider(overrides?: Partial<ProviderConfig>): TestProvider {
  return new TestProvider(makeConfig(overrides));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProviderRegistry", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it("register adds a provider and size increments", () => {
    const p = makeProvider({ id: "a" });
    registry.register(p);
    expect(registry.size).toBe(1);
    expect(registry.has("a")).toBe(true);
  });

  it("register throws on duplicate id", () => {
    const p1 = makeProvider({ id: "dup" });
    const p2 = makeProvider({ id: "dup" });
    registry.register(p1);
    expect(() => registry.register(p2)).toThrow("Provider already registered: dup");
  });

  it("unregister removes provider and returns true", () => {
    const p = makeProvider({ id: "rm" });
    registry.register(p);
    expect(registry.unregister("rm")).toBe(true);
    expect(registry.has("rm")).toBe(false);
    expect(registry.size).toBe(0);
  });

  it("unregister returns false for unknown id", () => {
    expect(registry.unregister("ghost")).toBe(false);
  });

  it("get returns provider or undefined", () => {
    const p = makeProvider({ id: "x" });
    registry.register(p);
    expect(registry.get("x")).toBe(p);
    expect(registry.get("missing")).toBeUndefined();
  });

  it("list returns all providers", () => {
    const a = makeProvider({ id: "a" });
    const b = makeProvider({ id: "b" });
    registry.register(a);
    registry.register(b);
    const all = registry.list();
    expect(all).toHaveLength(2);
    expect(all).toContain(a);
    expect(all).toContain(b);
  });

  it("listConfigs returns all provider configs", () => {
    registry.register(makeProvider({ id: "c1", label: "Config 1" }));
    registry.register(makeProvider({ id: "c2", label: "Config 2" }));
    const configs = registry.listConfigs();
    expect(configs).toHaveLength(2);
    expect(configs.map((c) => c.id)).toEqual(expect.arrayContaining(["c1", "c2"]));
  });

  it("listHealth returns health snapshots for all providers", () => {
    const p = makeProvider({ id: "h1" });
    p.recordSuccess(50);
    registry.register(p);
    const healths = registry.listHealth();
    expect(healths).toHaveLength(1);
    expect(healths[0].providerId).toBe("h1");
    expect(healths[0].status).toBe("healthy");
  });

  it("getHealthy filters out disabled and down providers", () => {
    const healthy = makeProvider({ id: "ok", enabled: true });
    healthy.recordSuccess(50);

    const disabled = makeProvider({ id: "off", enabled: false });

    const down = makeProvider({ id: "bad", enabled: true });
    for (let i = 0; i < 5; i++) down.recordFailure("err");

    registry.register(healthy);
    registry.register(disabled);
    registry.register(down);

    const result = registry.getHealthy();
    expect(result).toHaveLength(1);
    expect(result[0].config.id).toBe("ok");
  });

  it("clear empties the registry", () => {
    registry.register(makeProvider({ id: "a" }));
    registry.register(makeProvider({ id: "b" }));
    expect(registry.size).toBe(2);
    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.list()).toHaveLength(0);
  });
});
