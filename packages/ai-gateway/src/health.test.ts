import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { HealthMonitor } from "./health.js";
import { ProviderRegistry } from "./registry.js";
import { BaseProvider } from "./provider.js";
import type {
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ProviderConfig,
} from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

class TestProvider extends BaseProvider {
  pingResult: boolean | Error = true;

  constructor(config: ProviderConfig) {
    super(config);
  }

  async chat(_request: ChatRequest): Promise<ChatResponse> {
    return {
      content: "test",
      modelId: "m",
      providerId: this.config.id,
      usage: { inputTokens: 1, outputTokens: 1 },
      ttftMs: 10,
      totalMs: 20,
    };
  }

  async *chatStream(_request: ChatRequest): AsyncIterable<ChatChunk> {
    yield { delta: "", modelId: "m", providerId: this.config.id, done: true };
  }

  async ping(): Promise<boolean> {
    if (this.pingResult instanceof Error) throw this.pingResult;
    return this.pingResult;
  }

  async listModels(): Promise<string[]> {
    return ["m"];
  }
}

function makeConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: "p1",
    kind: "openai-compatible",
    label: "Provider",
    baseUrl: "http://localhost:8080",
    models: ["m"],
    isLocal: true,
    rateLimit: 0,
    timeoutMs: 30000,
    enabled: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HealthMonitor", () => {
  let registry: ProviderRegistry;
  let monitor: HealthMonitor;

  beforeEach(() => {
    registry = new ProviderRegistry();
    monitor = new HealthMonitor(registry, 5000);
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
  });

  it("checkAll pings all providers in registry", async () => {
    const a = new TestProvider(makeConfig({ id: "a" }));
    const b = new TestProvider(makeConfig({ id: "b" }));
    const spyA = vi.spyOn(a, "ping");
    const spyB = vi.spyOn(b, "ping");
    registry.register(a);
    registry.register(b);

    await monitor.checkAll();

    expect(spyA).toHaveBeenCalledOnce();
    expect(spyB).toHaveBeenCalledOnce();
  });

  it("checkAll records success for passing pings", async () => {
    const p = new TestProvider(makeConfig({ id: "ok" }));
    p.pingResult = true;
    registry.register(p);

    await monitor.checkAll();

    expect(p.health.status).toBe("healthy");
    expect(p.health.consecutiveFailures).toBe(0);
    expect(p.health.lastSuccessAt).toBeGreaterThan(0);
  });

  it("checkAll records failure when ping returns false", async () => {
    const p = new TestProvider(makeConfig({ id: "fail" }));
    p.pingResult = false;
    registry.register(p);

    await monitor.checkAll();

    expect(p.health.consecutiveFailures).toBe(1);
    expect(p.health.lastError).toBe("Ping returned false");
  });

  it("checkAll records failure when ping throws", async () => {
    const p = new TestProvider(makeConfig({ id: "throw" }));
    p.pingResult = new Error("connection refused");
    registry.register(p);

    await monitor.checkAll();

    expect(p.health.consecutiveFailures).toBe(1);
    expect(p.health.lastError).toBe("connection refused");
  });

  it("checkAll skips disabled providers", async () => {
    const p = new TestProvider(makeConfig({ id: "off", enabled: false }));
    const spy = vi.spyOn(p, "recordSuccess");
    const spyFail = vi.spyOn(p, "recordFailure");
    registry.register(p);

    await monitor.checkAll();

    expect(spy).not.toHaveBeenCalled();
    expect(spyFail).not.toHaveBeenCalled();
  });

  it("checkOne checks a single provider by ID", async () => {
    const a = new TestProvider(makeConfig({ id: "a" }));
    const b = new TestProvider(makeConfig({ id: "b" }));
    const spyA = vi.spyOn(a, "ping");
    const spyB = vi.spyOn(b, "ping");
    registry.register(a);
    registry.register(b);

    await monitor.checkOne("a");

    expect(spyA).toHaveBeenCalledOnce();
    expect(spyB).not.toHaveBeenCalled();
  });

  it("checkOne does nothing for unknown ID", async () => {
    // Should not throw
    await expect(monitor.checkOne("ghost")).resolves.toBeUndefined();
  });

  it("start/stop controls the timer and isRunning reflects state", () => {
    vi.useFakeTimers();

    expect(monitor.isRunning).toBe(false);

    monitor.start();
    expect(monitor.isRunning).toBe(true);

    // Calling start again is a no-op
    monitor.start();
    expect(monitor.isRunning).toBe(true);

    monitor.stop();
    expect(monitor.isRunning).toBe(false);

    // Calling stop again is safe
    monitor.stop();
    expect(monitor.isRunning).toBe(false);
  });

  it("periodic timer fires checkAll on interval", async () => {
    vi.useFakeTimers();
    const p = new TestProvider(makeConfig({ id: "t" }));
    const spy = vi.spyOn(p, "ping");
    registry.register(p);

    monitor.start();

    // Advance past one interval
    await vi.advanceTimersByTimeAsync(5000);
    expect(spy).toHaveBeenCalledTimes(1);

    // Advance past second interval
    await vi.advanceTimersByTimeAsync(5000);
    expect(spy).toHaveBeenCalledTimes(2);

    monitor.stop();
  });
});
