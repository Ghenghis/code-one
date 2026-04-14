// apps/desktop/src/renderer/index.ts
// Minimal renderer entry — Phase 2 will add React + UI components.
// For now, verify IPC bridge is available.

declare global {
  interface Window {
    codeone: import("../preload/api.js").CodeOneAPI;
  }
}

async function verifyBridge(): Promise<void> {
  if (!window.codeone) {
    document.getElementById("root")!.textContent =
      "Error: IPC bridge not available";
    return;
  }

  const layout = await window.codeone.getLayout();
  const modules = await window.codeone.listModules();
  const commands = await window.codeone.listCommands();

  document.getElementById("root")!.textContent =
    `Code One — Kernel connected. ` +
    `Layout: ${layout.root.kind}, ` +
    `Modules: ${modules.length}, ` +
    `Commands: ${commands.length}`;
}

verifyBridge();
