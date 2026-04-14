/**
 * Command bus type contracts.
 *
 * Commands are the primary way modules interact with the kernel.
 * Every user action, keybinding, and menu item routes through
 * the command bus. Commands are observable, logged, and undoable.
 */

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

export interface CommandDescriptor {
  /** Unique command ID, e.g. "workspace:open-file" */
  id: string;
  /** Human-readable title for command palette */
  title: string;
  /** Category for grouping in command palette */
  category?: string;
  /** Default keybinding (Electron accelerator format) */
  keybinding?: string;
  /** Icon identifier */
  icon?: string;
  /** Whether this command appears in the command palette */
  palette?: boolean;
  /** Module that registered this command */
  source?: string;
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

export interface CommandContext {
  /** Arguments passed to the command */
  args: Record<string, unknown>;
  /** ID of the module invoking the command (for permission checks) */
  callerId?: string;
}

export type CommandHandler = (ctx: CommandContext) => unknown | Promise<unknown>;

export interface CommandRegistration {
  descriptor: CommandDescriptor;
  handler: CommandHandler;
}

// ---------------------------------------------------------------------------
// CommandBus interface
// ---------------------------------------------------------------------------

export interface ICommandBus {
  /** Register a command handler */
  register(descriptor: CommandDescriptor, handler: CommandHandler): void;
  /** Unregister a command by ID */
  unregister(commandId: string): void;
  /** Execute a command */
  execute(commandId: string, ctx?: Partial<CommandContext>): Promise<unknown>;
  /** Check if a command is registered */
  has(commandId: string): boolean;
  /** List all registered command descriptors */
  list(): ReadonlyArray<CommandDescriptor>;
  /** Get a specific command descriptor */
  get(commandId: string): CommandDescriptor | undefined;
}
