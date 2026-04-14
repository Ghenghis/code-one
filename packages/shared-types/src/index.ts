/**
 * @code-one/shared-types
 *
 * Typed contracts shared across all packages in the code-one monorepo.
 * This package contains type definitions, interfaces, and minimal constants.
 *
 * Organized by subsystem:
 * - events: Event bus, agent events, trust levels
 * - commands: Command bus, command descriptors
 * - modules: Module registry, lifecycle, manifests
 * - permissions: Capability-based access control
 * - settings: Scoped settings with persistence
 * - layout: Panel arrangement, tabs, layout tree
 * - ipc: Electron IPC message contracts
 * - logger: Structured logging
 */

export * from "./events.js";
export * from "./commands.js";
export * from "./modules.js";
export * from "./permissions.js";
export * from "./settings.js";
export * from "./layout.js";
export * from "./ipc.js";
export * from "./logger.js";
