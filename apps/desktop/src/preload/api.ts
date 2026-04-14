import type {
  BaseEvent,
  CommandDescriptor,
  LayoutState,
  ModuleEntry,
  PermissionRequest,
  PermissionResult,
  SettingsScope,
} from "@code-one/shared-types";

export interface CodeOneAPI {
  executeCommand(commandId: string, args?: Record<string, unknown>): Promise<unknown>;
  listCommands(): Promise<ReadonlyArray<CommandDescriptor>>;
  emitEvent(event: BaseEvent): Promise<void>;
  onEvent(type: string, callback: (event: BaseEvent) => void): () => void;
  getSetting<T = unknown>(key: string): Promise<T | undefined>;
  setSetting(key: string, value: unknown, scope?: SettingsScope): Promise<void>;
  getSettingsScope(scope: SettingsScope): Promise<Readonly<Record<string, unknown>>>;
  getLayout(): Promise<LayoutState>;
  setLayout(state: LayoutState): Promise<void>;
  listModules(): Promise<ReadonlyArray<ModuleEntry>>;
  checkPermission(request: PermissionRequest): Promise<PermissionResult>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<{ ok: boolean }>;
  openFolder(): Promise<string | null>;
  openFileDialog(): Promise<string[]>;
}

export const API_METHODS: ReadonlyArray<keyof CodeOneAPI> = [
  "executeCommand",
  "listCommands",
  "emitEvent",
  "onEvent",
  "getSetting",
  "setSetting",
  "getSettingsScope",
  "getLayout",
  "setLayout",
  "listModules",
  "checkPermission",
  "readFile",
  "writeFile",
  "openFolder",
  "openFileDialog",
];
