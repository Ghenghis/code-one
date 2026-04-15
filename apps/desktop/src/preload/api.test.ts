import { describe, it, expect } from "vitest";
import { API_METHODS } from "./api.js";

describe("Preload API shape", () => {
  it("exports all expected method names", () => {
    const expected = [
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
      "listDirectory",
      "openFolder",
      "openFileDialog",
    ];
    for (const method of expected) {
      expect(API_METHODS).toContain(method);
    }
  });

  it("method count matches expected", () => {
    expect(API_METHODS.length).toBe(16);
  });
});
