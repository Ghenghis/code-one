/**
 * Module registry type contracts.
 *
 * Every feature in the IDE is a module with a defined lifecycle.
 * Modules register capabilities, declare dependencies, and
 * go through a managed init → ready → active → disposed lifecycle.
 */

// ---------------------------------------------------------------------------
// Module manifest
// ---------------------------------------------------------------------------

export interface ModuleManifest {
  /** Unique module ID, e.g. "editor", "ai-gateway", "terminal" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Which tier this module belongs to (enforces dependency direction) */
  tier: number;
  /** Module IDs this module depends on (must be same or lower tier) */
  dependencies?: string[];
  /** Capabilities this module provides */
  provides?: string[];
  /** Capabilities this module requires from others */
  requires?: string[];
  /** Human-readable description */
  description?: string;
}

// ---------------------------------------------------------------------------
// Module lifecycle
// ---------------------------------------------------------------------------

export type ModuleStatus =
  | "registered"  // manifest accepted, not yet initialized
  | "initializing" // init() in progress
  | "ready"       // initialized, dependencies satisfied
  | "active"      // fully running
  | "deactivating" // shutdown in progress
  | "disposed"    // cleaned up
  | "error";      // lifecycle failure

export interface ModuleLifecycle {
  /** Called when the module is first loaded. Set up internal state. */
  init?(): Promise<void> | void;
  /** Called after all dependencies are ready. Start providing services. */
  activate?(): Promise<void> | void;
  /** Called when the module is being shut down. Release resources. */
  deactivate?(): Promise<void> | void;
  /** Called for final cleanup. Module will not be reactivated. */
  dispose?(): Promise<void> | void;
}

export interface ModuleEntry {
  manifest: ModuleManifest;
  lifecycle: ModuleLifecycle;
  status: ModuleStatus;
}

// ---------------------------------------------------------------------------
// ModuleRegistry interface
// ---------------------------------------------------------------------------

export interface IModuleRegistry {
  /** Register a module with its manifest and lifecycle hooks */
  register(manifest: ModuleManifest, lifecycle: ModuleLifecycle): void;
  /** Unregister a module by ID */
  unregister(moduleId: string): Promise<void>;
  /** Initialize and activate all registered modules in dependency order */
  activateAll(): Promise<void>;
  /** Deactivate and dispose all modules in reverse dependency order */
  deactivateAll(): Promise<void>;
  /** Get the current status of a module */
  getStatus(moduleId: string): ModuleStatus | undefined;
  /** Get a module entry */
  get(moduleId: string): ModuleEntry | undefined;
  /** List all registered modules */
  list(): ReadonlyArray<ModuleEntry>;
  /** Check if a module is registered */
  has(moduleId: string): boolean;
  /** Check if a capability is provided by any active module */
  hasCapability(capability: string): boolean;
}
