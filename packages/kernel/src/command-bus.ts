import type {
  CommandContext,
  CommandDescriptor,
  CommandHandler,
  ICommandBus,
} from "@code-one/shared-types";

interface Registration {
  descriptor: CommandDescriptor;
  handler: CommandHandler;
}

/**
 * Central command dispatch.
 *
 * Every user action, keybinding, and menu item routes through here.
 * Commands are registered by modules and can be listed for the command palette.
 */
export class CommandBus implements ICommandBus {
  private commands = new Map<string, Registration>();

  register(descriptor: CommandDescriptor, handler: CommandHandler): void {
    if (this.commands.has(descriptor.id)) {
      throw new Error(`Command already registered: ${descriptor.id}`);
    }
    this.commands.set(descriptor.id, { descriptor, handler });
  }

  unregister(commandId: string): void {
    if (!this.commands.has(commandId)) {
      throw new Error(`Command not found: ${commandId}`);
    }
    this.commands.delete(commandId);
  }

  async execute(
    commandId: string,
    ctx?: Partial<CommandContext>,
  ): Promise<unknown> {
    const reg = this.commands.get(commandId);
    if (!reg) {
      throw new Error(`Command not found: ${commandId}`);
    }
    const fullCtx: CommandContext = {
      args: ctx?.args ?? {},
      callerId: ctx?.callerId,
    };
    return reg.handler(fullCtx);
  }

  has(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  list(): ReadonlyArray<CommandDescriptor> {
    return Array.from(this.commands.values()).map((r) => r.descriptor);
  }

  get(commandId: string): CommandDescriptor | undefined {
    return this.commands.get(commandId)?.descriptor;
  }

  /** Get the number of registered commands */
  get size(): number {
    return this.commands.size;
  }
}
