import type { ProviderRegistry } from "./registry.js";
import type { IProvider } from "./provider.js";

export class HealthMonitor {
  private _registry: ProviderRegistry;
  private _intervalMs: number;
  private _timer: ReturnType<typeof setInterval> | null = null;

  constructor(registry: ProviderRegistry, intervalMs = 30_000) {
    this._registry = registry;
    this._intervalMs = intervalMs;
  }

  /** Run a single health check on all providers */
  async checkAll(): Promise<void> {
    const providers = this._registry.list();
    await Promise.allSettled(providers.map((p) => this._check(p)));
  }

  /** Check a single provider */
  async checkOne(providerId: string): Promise<void> {
    const provider = this._registry.get(providerId);
    if (!provider) return;
    await this._check(provider);
  }

  private async _check(provider: IProvider): Promise<void> {
    if (!provider.config.enabled) return;
    const start = Date.now();
    try {
      const ok = await provider.ping();
      if (ok) {
        provider.recordSuccess(Date.now() - start);
      } else {
        provider.recordFailure("Ping returned false");
      }
    } catch (err) {
      provider.recordFailure(err instanceof Error ? err.message : String(err));
    }
  }

  /** Start periodic health checks */
  start(): void {
    if (this._timer) return;
    this._timer = setInterval(() => this.checkAll(), this._intervalMs);
    // Allow process to exit even if health checks are running
    if (this._timer && typeof this._timer === "object" && "unref" in this._timer) {
      (this._timer as NodeJS.Timeout).unref();
    }
  }

  /** Stop periodic health checks */
  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  get isRunning(): boolean {
    return this._timer !== null;
  }
}
