import fs from "node:fs/promises";
import { dialog } from "electron";
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
    "command:execute": safeHandler(async (_event, payload: unknown) => {
      const { commandId, args } = payload as {
        commandId: string;
        args?: Record<string, unknown>;
      };
      const ctx: Partial<CommandContext> | undefined = args ? { args } : undefined;
      return kernel.commands.execute(commandId, ctx);
    }),

    "command:list": (_event: unknown) => {
      return kernel.commands.list();
    },

    "event:emit": (_event: unknown, payload: unknown) => {
      kernel.events.emit(payload as BaseEvent);
    },

    "event:subscribe": (_event: unknown, payload: unknown) => {
      const { type } = payload as { type: string };
      const sender = (
        _event as {
          sender: {
            send: (channel: string, ...args: unknown[]) => void;
            isDestroyed: () => boolean;
          };
        }
      ).sender;

      const disposable = kernel.events.on(type, (evt: BaseEvent) => {
        try {
          if (!sender.isDestroyed()) {
            sender.send(`event:forward:${type}`, evt);
          }
        } catch {
          // webContents destroyed — safe to ignore
        }
      });

      return { subscribed: true, type, dispose: disposable.dispose };
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

    "permission:check": safeHandler(async (_event, payload: unknown) => {
      return kernel.permissions.check(payload as PermissionRequest);
    }),

    "fs:read-file": safeHandler(async (_event, payload: unknown) => {
      const { filePath } = payload as { filePath: string };
      return fs.readFile(filePath, "utf-8");
    }),

    "fs:write-file": safeHandler(async (_event, payload: unknown) => {
      const { filePath, content } = payload as { filePath: string; content: string };
      await fs.writeFile(filePath, content, "utf-8");
      return { ok: true };
    }),

    "fs:list-dir": safeHandler(async (_event, payload: unknown) => {
      const { dirPath } = payload as { dirPath: string };
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => !e.name.startsWith("."))
        .map((e) => ({
          name: e.name,
          path: `${dirPath}/${e.name}`.replace(/\\/g, "/"),
          isDirectory: e.isDirectory(),
        }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    }),

    "dialog:open-folder": safeHandler(async () => {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    }),

    "dialog:open-file": safeHandler(async () => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile", "multiSelections"],
      });
      if (result.canceled) return [];
      return result.filePaths;
    }),
  };
}
