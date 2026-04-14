import { describe, it, expect, afterEach } from "vitest";
import { createTempDir, waitFor, deferred, captureConsole } from "./index.js";

describe("test-harness utilities", () => {
  describe("createTempDir", () => {
    it("creates and cleans up a temp directory", async () => {
      const { path, cleanup } = await createTempDir();
      const { stat } = await import("node:fs/promises");

      const info = await stat(path);
      expect(info.isDirectory()).toBe(true);

      await cleanup();
      await expect(stat(path)).rejects.toThrow();
    });
  });

  describe("waitFor", () => {
    it("resolves when condition is true", async () => {
      let ready = false;
      setTimeout(() => {
        ready = true;
      }, 50);
      await waitFor(() => ready, 1000);
      expect(ready).toBe(true);
    });

    it("throws on timeout", async () => {
      await expect(waitFor(() => false, 100)).rejects.toThrow("timed out");
    });
  });

  describe("deferred", () => {
    it("resolves with value", async () => {
      const d = deferred<number>();
      d.resolve(42);
      expect(await d.promise).toBe(42);
    });

    it("rejects with reason", async () => {
      const d = deferred<number>();
      d.reject(new Error("fail"));
      await expect(d.promise).rejects.toThrow("fail");
    });
  });

  describe("captureConsole", () => {
    let restore: (() => void) | undefined;

    afterEach(() => {
      restore?.();
    });

    it("captures log and error output", () => {
      const capture = captureConsole();
      restore = capture.restore;

      console.log("hello", "world");
      console.error("bad", "thing");

      expect(capture.logs).toEqual(["hello world"]);
      expect(capture.errors).toEqual(["bad thing"]);
    });
  });
});
