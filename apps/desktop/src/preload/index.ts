import { contextBridge, ipcRenderer } from "electron";
import type { CodeOneAPI } from "./api.js";
import type { BaseEvent } from "@code-one/shared-types";

const api: CodeOneAPI = {
  executeCommand: (commandId, args) => ipcRenderer.invoke("command:execute", { commandId, args }),

  listCommands: () => ipcRenderer.invoke("command:list"),

  emitEvent: (event) => ipcRenderer.invoke("event:emit", event),

  onEvent: (type, callback) => {
    const listener = (_ipcEvent: Electron.IpcRendererEvent, event: BaseEvent) => {
      callback(event);
    };
    ipcRenderer.on(`event:forward:${type}`, listener);
    return () => {
      ipcRenderer.removeListener(`event:forward:${type}`, listener);
    };
  },

  getSetting: (key) => ipcRenderer.invoke("settings:get", { key }),

  setSetting: (key, value, scope) => ipcRenderer.invoke("settings:set", { key, value, scope }),

  getSettingsScope: (scope) => ipcRenderer.invoke("settings:get-scope", { scope }),

  getLayout: () => ipcRenderer.invoke("layout:get"),

  setLayout: (state) => ipcRenderer.invoke("layout:set", state),

  listModules: () => ipcRenderer.invoke("module:list"),

  checkPermission: (request) => ipcRenderer.invoke("permission:check", request),

  readFile: (filePath) => ipcRenderer.invoke("fs:read-file", { filePath }),

  writeFile: (filePath, content) => ipcRenderer.invoke("fs:write-file", { filePath, content }),

  listDirectory: (dirPath) => ipcRenderer.invoke("fs:list-dir", { dirPath }),

  openFolder: () => ipcRenderer.invoke("dialog:open-folder"),

  openFileDialog: () => ipcRenderer.invoke("dialog:open-file"),
};

contextBridge.exposeInMainWorld("codeone", api);
