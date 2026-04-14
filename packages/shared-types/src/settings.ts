/**
 * Settings system type contracts.
 *
 * Three-level scoping: defaults → user → project.
 * Project settings override user settings override defaults.
 */

// ---------------------------------------------------------------------------
// Settings scopes
// ---------------------------------------------------------------------------

export type SettingsScope = "default" | "user" | "project";

// ---------------------------------------------------------------------------
// Settings schema (for validation and UI generation)
// ---------------------------------------------------------------------------

export type SettingsValueType = "string" | "number" | "boolean" | "array" | "object";

export interface SettingsSchemaEntry {
  /** Dot-notation key, e.g. "editor.fontSize", "ai.provider.primary" */
  key: string;
  /** Value type */
  type: SettingsValueType;
  /** Default value */
  defaultValue: unknown;
  /** Human-readable description */
  description: string;
  /** Category for grouping in settings UI */
  category?: string;
  /** Allowed values (for enums) */
  enum?: unknown[];
  /** Minimum value (for numbers) */
  min?: number;
  /** Maximum value (for numbers) */
  max?: number;
}

// ---------------------------------------------------------------------------
// Settings change events
// ---------------------------------------------------------------------------

export interface SettingsChangeEvent {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  scope: SettingsScope;
}

export type SettingsChangeHandler = (event: SettingsChangeEvent) => void;

// ---------------------------------------------------------------------------
// Persistence backend
// ---------------------------------------------------------------------------

export interface SettingsBackend {
  /** Load all settings for a given scope */
  load(scope: SettingsScope): Promise<Record<string, unknown>>;
  /** Persist all settings for a given scope */
  save(scope: SettingsScope, data: Record<string, unknown>): Promise<void>;
}

// ---------------------------------------------------------------------------
// SettingsManager interface
// ---------------------------------------------------------------------------

export interface ISettingsManager {
  /** Get a setting value (resolved through scope chain) */
  get<T = unknown>(key: string): T | undefined;
  /** Get a setting value with a fallback */
  getOr<T = unknown>(key: string, fallback: T): T;
  /** Set a setting value at a specific scope */
  set(key: string, value: unknown, scope?: SettingsScope): void;
  /** Delete a setting at a specific scope (falls back to next scope) */
  delete(key: string, scope?: SettingsScope): void;
  /** Subscribe to changes for a specific key (or all changes) */
  onChange(handler: SettingsChangeHandler, key?: string): { dispose(): void };
  /** Register a settings schema entry */
  registerSchema(entry: SettingsSchemaEntry): void;
  /** Get all schema entries */
  listSchema(): ReadonlyArray<SettingsSchemaEntry>;
  /** Load settings from backend */
  load(): Promise<void>;
  /** Persist current settings to backend */
  save(): Promise<void>;
  /** Get all settings at a specific scope */
  getScope(scope: SettingsScope): Readonly<Record<string, unknown>>;
}
