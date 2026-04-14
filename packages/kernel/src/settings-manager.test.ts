import { describe, it, expect, vi } from "vitest";
import { SettingsManager } from "./settings-manager.js";
import type { SettingsBackend } from "@code-one/shared-types";

describe("SettingsManager", () => {
  it("returns undefined for unknown keys", () => {
    const mgr = new SettingsManager();
    expect(mgr.get("nope")).toBeUndefined();
  });

  it("returns fallback via getOr", () => {
    const mgr = new SettingsManager();
    expect(mgr.getOr("nope", 42)).toBe(42);
  });

  it("sets and gets values at user scope by default", () => {
    const mgr = new SettingsManager();
    mgr.set("editor.fontSize", 14);
    expect(mgr.get("editor.fontSize")).toBe(14);
  });

  it("project scope overrides user scope", () => {
    const mgr = new SettingsManager();
    mgr.set("editor.fontSize", 14, "user");
    mgr.set("editor.fontSize", 16, "project");

    expect(mgr.get("editor.fontSize")).toBe(16);
  });

  it("user scope overrides default scope", () => {
    const mgr = new SettingsManager();
    mgr.set("theme", "dark", "default");
    mgr.set("theme", "light", "user");

    expect(mgr.get("theme")).toBe("light");
  });

  it("falls back through scope chain correctly", () => {
    const mgr = new SettingsManager();
    mgr.set("a", 1, "default");
    expect(mgr.get("a")).toBe(1);

    mgr.set("a", 2, "user");
    expect(mgr.get("a")).toBe(2);

    mgr.set("a", 3, "project");
    expect(mgr.get("a")).toBe(3);

    mgr.delete("a", "project");
    expect(mgr.get("a")).toBe(2);

    mgr.delete("a", "user");
    expect(mgr.get("a")).toBe(1);
  });

  it("emits change events", () => {
    const mgr = new SettingsManager();
    const handler = vi.fn();

    mgr.onChange(handler);
    mgr.set("key", "value");

    expect(handler).toHaveBeenCalledWith({
      key: "key",
      oldValue: undefined,
      newValue: "value",
      scope: "user",
    });
  });

  it("emits change events filtered by key", () => {
    const mgr = new SettingsManager();
    const handler = vi.fn();

    mgr.onChange(handler, "specific.key");
    mgr.set("other.key", 1);
    expect(handler).not.toHaveBeenCalled();

    mgr.set("specific.key", 2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not emit when value does not change", () => {
    const mgr = new SettingsManager();
    const handler = vi.fn();

    mgr.set("key", "same");
    mgr.onChange(handler);
    mgr.set("key", "same");

    expect(handler).not.toHaveBeenCalled();
  });

  it("dispose stops change notifications", () => {
    const mgr = new SettingsManager();
    const handler = vi.fn();

    const sub = mgr.onChange(handler);
    mgr.set("key", 1);
    expect(handler).toHaveBeenCalledTimes(1);

    sub.dispose();
    mgr.set("key", 2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("registerSchema sets default value", () => {
    const mgr = new SettingsManager();
    mgr.registerSchema({
      key: "editor.tabSize",
      type: "number",
      defaultValue: 2,
      description: "Tab size",
    });

    expect(mgr.get("editor.tabSize")).toBe(2);
    expect(mgr.listSchema()).toHaveLength(1);
  });

  it("registerSchema updates existing entry", () => {
    const mgr = new SettingsManager();
    mgr.registerSchema({
      key: "editor.tabSize",
      type: "number",
      defaultValue: 2,
      description: "Tab size",
    });
    mgr.registerSchema({
      key: "editor.tabSize",
      type: "number",
      defaultValue: 4,
      description: "Tab size (updated)",
    });

    expect(mgr.listSchema()).toHaveLength(1);
    expect(mgr.listSchema()[0].description).toBe("Tab size (updated)");
  });

  it("getScope returns a copy of scope data", () => {
    const mgr = new SettingsManager();
    mgr.set("a", 1, "user");
    mgr.set("b", 2, "user");

    const scope = mgr.getScope("user");
    expect(scope).toEqual({ a: 1, b: 2 });
  });

  it("loads and saves via backend", async () => {
    const backend: SettingsBackend = {
      load: vi.fn().mockResolvedValue({ theme: "dark" }),
      save: vi.fn().mockResolvedValue(undefined),
    };

    const mgr = new SettingsManager(backend);
    await mgr.load();

    expect(mgr.get("theme")).toBe("dark");

    mgr.set("extra", true);
    await mgr.save();

    expect(backend.save).toHaveBeenCalled();
  });

  it("handles missing backend gracefully", async () => {
    const mgr = new SettingsManager();
    // Should not throw
    await mgr.load();
    await mgr.save();
  });
});
