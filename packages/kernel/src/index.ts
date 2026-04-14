/**
 * @code-one/kernel — Platform Kernel (Tier 0)
 *
 * The foundation everything plugs into. Knows nothing about
 * coding, models, or SSH by itself.
 *
 * Subsystems:
 * - EventBus:         Append-only event stream (pub/sub)
 * - CommandBus:       Command dispatch and keybinding registry
 * - ModuleRegistry:   Module lifecycle management
 * - PermissionEngine: Capability-based access control
 * - SettingsManager:  Scoped settings with persistence
 * - LayoutManager:    Panel arrangement and tab state
 * - LoggerFactory:    Structured logging
 */

export { EventBus } from "./event-bus.js";
export { CommandBus } from "./command-bus.js";
export { ModuleRegistry } from "./module-registry.js";
export { PermissionEngine } from "./permission-engine.js";
export { SettingsManager } from "./settings-manager.js";
export { LayoutManager } from "./layout-manager.js";
export { LoggerFactory } from "./logger.js";

// Re-export key interfaces for convenience
export type {
  IEventBus,
  ICommandBus,
  IModuleRegistry,
  IPermissionEngine,
  ISettingsManager,
  ILayoutManager,
  ILoggerFactory,
  ILogger,
} from "@code-one/shared-types";

import { EventBus } from "./event-bus.js";
import { CommandBus } from "./command-bus.js";
import { ModuleRegistry } from "./module-registry.js";
import { PermissionEngine } from "./permission-engine.js";
import { SettingsManager } from "./settings-manager.js";
import { LayoutManager } from "./layout-manager.js";
import { LoggerFactory } from "./logger.js";
import type { ILogger, SettingsBackend } from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// Kernel instance — the single entry point for all Tier 0 services
// ---------------------------------------------------------------------------

export interface KernelConfig {
  /** Persistence backend for settings (optional; in-memory if omitted) */
  settingsBackend?: SettingsBackend;
  /** Log level override */
  logLevel?: "debug" | "info" | "warn" | "error";
}

export interface Kernel {
  events: EventBus;
  commands: CommandBus;
  modules: ModuleRegistry;
  permissions: PermissionEngine;
  settings: SettingsManager;
  layout: LayoutManager;
  loggerFactory: LoggerFactory;
  logger: ILogger;
  /** Shut down all modules and clean up */
  shutdown(): Promise<void>;
}

/**
 * Create and initialize a Kernel instance.
 *
 * This is the primary entry point for the application.
 * Call this once at startup (in the Electron main process).
 */
export function createKernel(config: KernelConfig = {}): Kernel {
  const loggerFactory = new LoggerFactory();
  if (config.logLevel) {
    loggerFactory.setLevel(config.logLevel);
  }

  const logger = loggerFactory.createLogger("kernel");
  logger.info("Kernel initializing");

  const events = new EventBus();
  const commands = new CommandBus();
  const modules = new ModuleRegistry(events);
  const permissions = new PermissionEngine();
  const settings = new SettingsManager(config.settingsBackend);
  const layout = new LayoutManager();

  logger.info("Kernel subsystems created");

  return {
    events,
    commands,
    modules,
    permissions,
    settings,
    layout,
    loggerFactory,
    logger,
    async shutdown() {
      logger.info("Kernel shutting down");
      await modules.deactivateAll();
      await settings.save();
      await layout.save();
      events.clear();
      logger.info("Kernel shutdown complete");
    },
  };
}
