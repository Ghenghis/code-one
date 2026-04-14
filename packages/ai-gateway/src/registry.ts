import type { IProvider } from "./provider.js";
import type { ProviderConfig, ProviderId, ProviderHealth } from "@code-one/shared-types";

export class ProviderRegistry {
  private _providers = new Map<ProviderId, IProvider>();

  register(provider: IProvider): void {
    if (this._providers.has(provider.config.id)) {
      throw new Error(`Provider already registered: ${provider.config.id}`);
    }
    this._providers.set(provider.config.id, provider);
  }

  unregister(id: ProviderId): boolean {
    return this._providers.delete(id);
  }

  get(id: ProviderId): IProvider | undefined {
    return this._providers.get(id);
  }

  has(id: ProviderId): boolean {
    return this._providers.has(id);
  }

  list(): ReadonlyArray<IProvider> {
    return [...this._providers.values()];
  }

  listConfigs(): ReadonlyArray<ProviderConfig> {
    return this.list().map((p) => p.config);
  }

  listHealth(): ReadonlyArray<ProviderHealth> {
    return this.list().map((p) => p.health);
  }

  getHealthy(): ReadonlyArray<IProvider> {
    return this.list().filter(
      (p) => p.config.enabled && p.health.status !== "down",
    );
  }

  clear(): void {
    this._providers.clear();
  }

  get size(): number {
    return this._providers.size;
  }
}
