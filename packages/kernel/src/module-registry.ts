import type {
  IModuleRegistry,
  ModuleEntry,
  ModuleLifecycle,
  ModuleManifest,
  ModuleStatus,
  IEventBus,
  BaseEvent,
} from "@code-one/shared-types";

/**
 * Module lifecycle management with dependency resolution.
 *
 * - Modules declare their tier, dependencies, and capabilities
 * - Activation respects dependency order (topological sort)
 * - Deactivation runs in reverse order
 * - Tier constraint: no module may depend on a higher-tier module
 */
export class ModuleRegistry implements IModuleRegistry {
  private modules = new Map<string, ModuleEntry>();
  private capabilities = new Map<string, string>(); // capability → moduleId

  constructor(private eventBus?: IEventBus) {}

  register(manifest: ModuleManifest, lifecycle: ModuleLifecycle): void {
    if (this.modules.has(manifest.id)) {
      throw new Error(`Module already registered: ${manifest.id}`);
    }

    // Validate tier constraint: dependencies must be same or lower tier
    if (manifest.dependencies) {
      for (const depId of manifest.dependencies) {
        const dep = this.modules.get(depId);
        if (dep && dep.manifest.tier > manifest.tier) {
          throw new Error(
            `Tier violation: ${manifest.id} (tier ${manifest.tier}) cannot depend on ${depId} (tier ${dep.manifest.tier})`,
          );
        }
      }
    }

    const entry: ModuleEntry = {
      manifest,
      lifecycle,
      status: "registered",
    };
    this.modules.set(manifest.id, entry);

    if (manifest.provides) {
      for (const cap of manifest.provides) {
        this.capabilities.set(cap, manifest.id);
      }
    }

    this.emitLifecycle(manifest.id, "registered");
  }

  async unregister(moduleId: string): Promise<void> {
    const entry = this.modules.get(moduleId);
    if (!entry) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    // Check no other active module depends on this one
    for (const [, other] of this.modules) {
      if (
        other.manifest.id !== moduleId &&
        other.status === "active" &&
        other.manifest.dependencies?.includes(moduleId)
      ) {
        throw new Error(`Cannot unregister ${moduleId}: ${other.manifest.id} depends on it`);
      }
    }

    if (entry.status === "active" || entry.status === "ready") {
      await this.deactivateModule(entry);
    }

    // Remove capabilities
    if (entry.manifest.provides) {
      for (const cap of entry.manifest.provides) {
        this.capabilities.delete(cap);
      }
    }

    this.modules.delete(moduleId);
  }

  async activateAll(): Promise<void> {
    const order = this.topologicalSort();

    for (const moduleId of order) {
      const entry = this.modules.get(moduleId)!;
      if (entry.status !== "registered") continue;

      // Validate dependencies are ready/active
      this.validateDependencies(entry);

      try {
        entry.status = "initializing";
        this.emitLifecycle(moduleId, "initializing");

        if (entry.lifecycle.init) {
          await entry.lifecycle.init();
        }

        entry.status = "ready";
        this.emitLifecycle(moduleId, "ready");

        if (entry.lifecycle.activate) {
          await entry.lifecycle.activate();
        }

        entry.status = "active";
        this.emitLifecycle(moduleId, "active");
      } catch (err) {
        entry.status = "error";
        this.emitLifecycle(moduleId, "error");
        throw new Error(
          `Module ${moduleId} failed to activate: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        );
      }
    }
  }

  async deactivateAll(): Promise<void> {
    const order = this.topologicalSort().reverse();

    for (const moduleId of order) {
      const entry = this.modules.get(moduleId)!;
      if (entry.status !== "active" && entry.status !== "ready") continue;
      await this.deactivateModule(entry);
    }
  }

  getStatus(moduleId: string): ModuleStatus | undefined {
    return this.modules.get(moduleId)?.status;
  }

  get(moduleId: string): ModuleEntry | undefined {
    return this.modules.get(moduleId);
  }

  list(): ReadonlyArray<ModuleEntry> {
    return Array.from(this.modules.values());
  }

  has(moduleId: string): boolean {
    return this.modules.has(moduleId);
  }

  hasCapability(capability: string): boolean {
    const moduleId = this.capabilities.get(capability);
    if (!moduleId) return false;
    const entry = this.modules.get(moduleId);
    return entry?.status === "active";
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async deactivateModule(entry: ModuleEntry): Promise<void> {
    try {
      entry.status = "deactivating";
      this.emitLifecycle(entry.manifest.id, "deactivating");

      if (entry.lifecycle.deactivate) {
        await entry.lifecycle.deactivate();
      }
      if (entry.lifecycle.dispose) {
        await entry.lifecycle.dispose();
      }

      entry.status = "disposed";
      this.emitLifecycle(entry.manifest.id, "disposed");
    } catch {
      entry.status = "error";
      this.emitLifecycle(entry.manifest.id, "error");
    }
  }

  private validateDependencies(entry: ModuleEntry): void {
    if (!entry.manifest.dependencies) return;
    for (const depId of entry.manifest.dependencies) {
      const dep = this.modules.get(depId);
      if (!dep) {
        throw new Error(`Missing dependency: ${entry.manifest.id} requires ${depId}`);
      }
      if (dep.status !== "active" && dep.status !== "ready") {
        throw new Error(
          `Dependency not ready: ${entry.manifest.id} requires ${depId} (status: ${dep.status})`,
        );
      }
    }
  }

  /**
   * Topological sort of modules by dependency order.
   * Modules with no dependencies come first.
   */
  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const visiting = new Set<string>();

    const visit = (moduleId: string) => {
      if (visited.has(moduleId)) return;
      if (visiting.has(moduleId)) {
        throw new Error(`Circular dependency detected involving: ${moduleId}`);
      }
      visiting.add(moduleId);

      const entry = this.modules.get(moduleId);
      if (entry?.manifest.dependencies) {
        for (const depId of entry.manifest.dependencies) {
          if (this.modules.has(depId)) {
            visit(depId);
          }
        }
      }

      visiting.delete(moduleId);
      visited.add(moduleId);
      result.push(moduleId);
    };

    for (const moduleId of this.modules.keys()) {
      visit(moduleId);
    }

    return result;
  }

  private emitLifecycle(moduleId: string, status: ModuleStatus): void {
    if (!this.eventBus) return;
    this.eventBus.emit({
      id: `lifecycle-${moduleId}-${status}-${Date.now()}`,
      timestamp: Date.now(),
      source: "system",
      sessionId: "kernel",
      type: "module:lifecycle",
      payload: { moduleId, status },
    } as BaseEvent & { payload: { moduleId: string; status: ModuleStatus } });
  }
}
