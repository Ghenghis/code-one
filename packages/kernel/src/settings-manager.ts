import type {
  ISettingsManager,
  SettingsBackend,
  SettingsChangeEvent,
  SettingsChangeHandler,
  SettingsSchemaEntry,
  SettingsScope,
} from "@code-one/shared-types";

interface Subscription {
  handler: SettingsChangeHandler;
  key?: string;
}

/**
 * Three-level scoped settings: default → user → project.
 *
 * - Values resolve through the scope chain (project overrides user overrides default)
 * - Supports dot-notation keys (e.g. "editor.fontSize")
 * - Change events for reactive UI updates
 * - Pluggable persistence backend
 */
export class SettingsManager implements ISettingsManager {
  private scopes: Record<SettingsScope, Record<string, unknown>> = {
    default: {},
    user: {},
    project: {},
  };
  private schema: SettingsSchemaEntry[] = [];
  private subscriptions = new Set<Subscription>();
  private backend?: SettingsBackend;

  constructor(backend?: SettingsBackend) {
    this.backend = backend;
  }

  get<T = unknown>(key: string): T | undefined {
    // Project > User > Default
    if (key in this.scopes.project) return this.scopes.project[key] as T;
    if (key in this.scopes.user) return this.scopes.user[key] as T;
    if (key in this.scopes.default) return this.scopes.default[key] as T;
    return undefined;
  }

  getOr<T = unknown>(key: string, fallback: T): T {
    const value = this.get<T>(key);
    return value !== undefined ? value : fallback;
  }

  set(key: string, value: unknown, scope: SettingsScope = "user"): void {
    const oldValue = this.get(key);
    this.scopes[scope][key] = value;
    const newValue = this.get(key);

    if (oldValue !== newValue) {
      this.notifyChange({ key, oldValue, newValue, scope });
    }
  }

  delete(key: string, scope: SettingsScope = "user"): void {
    const oldValue = this.get(key);
    delete this.scopes[scope][key];
    const newValue = this.get(key);

    if (oldValue !== newValue) {
      this.notifyChange({ key, oldValue, newValue, scope });
    }
  }

  onChange(
    handler: SettingsChangeHandler,
    key?: string,
  ): { dispose(): void } {
    const sub: Subscription = { handler, key };
    this.subscriptions.add(sub);
    return {
      dispose: () => {
        this.subscriptions.delete(sub);
      },
    };
  }

  registerSchema(entry: SettingsSchemaEntry): void {
    // Avoid duplicates
    const existing = this.schema.findIndex((s) => s.key === entry.key);
    if (existing >= 0) {
      this.schema[existing] = entry;
    } else {
      this.schema.push(entry);
    }
    // Set default value if not already set
    if (!(entry.key in this.scopes.default)) {
      this.scopes.default[entry.key] = entry.defaultValue;
    }
  }

  listSchema(): ReadonlyArray<SettingsSchemaEntry> {
    return this.schema;
  }

  async load(): Promise<void> {
    if (!this.backend) return;
    this.scopes.user = await this.backend.load("user");
    this.scopes.project = await this.backend.load("project");
  }

  async save(): Promise<void> {
    if (!this.backend) return;
    await this.backend.save("user", this.scopes.user);
    await this.backend.save("project", this.scopes.project);
  }

  getScope(scope: SettingsScope): Readonly<Record<string, unknown>> {
    return { ...this.scopes[scope] };
  }

  /** Set the persistence backend (for deferred initialization) */
  setBackend(backend: SettingsBackend): void {
    this.backend = backend;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private notifyChange(event: SettingsChangeEvent): void {
    for (const sub of this.subscriptions) {
      if (sub.key === undefined || sub.key === event.key) {
        try {
          sub.handler(event);
        } catch {
          // Subscribers must not crash the settings manager.
        }
      }
    }
  }
}
