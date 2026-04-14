// apps/desktop/src/main/index.ts
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { createKernel } from "@code-one/kernel";
import { createIPCHandlers } from "./ipc-handlers.js";
import { IPC_CHANNELS } from "../shared/channels.js";

// Handle Squirrel events on Windows (install/update/uninstall)
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require("electron-squirrel-startup")) app.quit();

// Vite injects these constants at build time
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// ---------------------------------------------------------------------------
// Kernel
// ---------------------------------------------------------------------------

const kernel = createKernel({ logLevel: "info" });

// ---------------------------------------------------------------------------
// IPC registration
// ---------------------------------------------------------------------------

const handlers = createIPCHandlers(kernel);

for (const channel of IPC_CHANNELS) {
  const handler = handlers[channel];
  if (handler) {
    ipcMain.handle(channel, handler as Parameters<typeof ipcMain.handle>[1]);
  }
}

kernel.logger.info("IPC handlers registered", { channels: IPC_CHANNELS });

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    title: "Code One",
  });

  // Show window once ready to avoid flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  kernel.logger.info("Main window created");
  return mainWindow;
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.on("ready", () => {
  kernel.logger.info("App ready");
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", async () => {
  kernel.logger.info("App quitting — shutting down kernel");
  await kernel.shutdown();
});
