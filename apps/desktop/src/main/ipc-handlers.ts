import type { Kernel } from "@code-one/kernel";
import type {
  BaseEvent,
  CommandContext,
  LayoutState,
  PermissionRequest,
  SettingsScope,
  IPCError,
} from "@code-one/shared-types";

type HandlerFn = (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>;

export interface IPCHandlerMap {
  [channel: string]: HandlerFn;
}

interface IPCErrorResponse {
  error: IPCError;
}

function wrapError(err: unknown): IPCErrorResponse {
  const message = err instanceof Error ? err.message : String(err);
  return { error: { code: "IPC_ERROR", message } };
}

function safeHandler(fn: HandlerFn): HandlerFn {
  return async (event: unknown, ...args: unknown[]) => {
    try {
      return await fn(event, ...args);
    } catch (err) {
      return wrapError(err);
    }
  };
}

export function createIPCHandlers(kernel: Kernel): IPCHandlerMap {
  return {
    "command:execute": safeHandler(
      async (_event, payload: unknown) => {
        const { commandId, args } = payload as {
          commandId: string;
          args?: Record<string, unknown>;
        };
        const ctx: Partial<CommandContext> | undefined = args ? { args } : undefined;
        return kernel.commands.execute(commandId, ctx);
      },
    ),

    "command:list": (_event: unknown) => {
      return kernel.commands.list();
    },

    "event:emit": (_event: unknown, payload: unknown) => {
      kernel.events.emit(payload as BaseEvent);
    },

    "settings:get": (_event: unknown, payload: unknown) => {
      const { key } = payload as { key: string };
      return kernel.settings.get(key);
    },

    "settings:set": (_event: unknown, payload: unknown) => {
      const { key, value, scope } = payload as {
        key: string;
        value: unknown;
        scope?: SettingsScope;
      };
      kernel.settings.set(key, value, scope);
    },

    "settings:get-scope": (_event: unknown, payload: unknown) => {
      const { scope } = payload as { scope: SettingsScope };
      return kernel.settings.getScope(scope);
    },

    "layout:get": (_event: unknown) => {
      return kernel.layout.getState();
    },

    "layout:set": (_event: unknown, payload: unknown) => {
      kernel.layout.setState(payload as LayoutState);
    },

    "module:list": (_event: unknown) => {
      return kernel.modules.list();
    },

    "permission:check": safeHandler(
      async (_event, payload: unknown) => {
        return kernel.permissions.check(payload as PermissionRequest);
      },
    ),
  };
}
