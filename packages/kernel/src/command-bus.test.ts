import { describe, it, expect, vi } from "vitest";
import { CommandBus } from "./command-bus.js";

describe("CommandBus", () => {
  it("registers and executes a command", async () => {
    const bus = new CommandBus();
    const handler = vi.fn().mockReturnValue("done");

    bus.register({ id: "test:cmd", title: "Test Command" }, handler);

    const result = await bus.execute("test:cmd");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(result).toBe("done");
  });

  it("passes context to the handler", async () => {
    const bus = new CommandBus();
    const handler = vi.fn();

    bus.register({ id: "test:cmd", title: "Test" }, handler);
    await bus.execute("test:cmd", { args: { file: "foo.ts" }, callerId: "editor" });

    expect(handler).toHaveBeenCalledWith({
      args: { file: "foo.ts" },
      callerId: "editor",
    });
  });

  it("throws on duplicate registration", () => {
    const bus = new CommandBus();
    bus.register({ id: "test:cmd", title: "Test" }, vi.fn());

    expect(() => {
      bus.register({ id: "test:cmd", title: "Dupe" }, vi.fn());
    }).toThrow("Command already registered: test:cmd");
  });

  it("throws when executing unknown command", async () => {
    const bus = new CommandBus();

    await expect(bus.execute("nope")).rejects.toThrow("Command not found: nope");
  });

  it("unregisters a command", () => {
    const bus = new CommandBus();
    bus.register({ id: "test:cmd", title: "Test" }, vi.fn());
    expect(bus.has("test:cmd")).toBe(true);

    bus.unregister("test:cmd");
    expect(bus.has("test:cmd")).toBe(false);
  });

  it("throws when unregistering unknown command", () => {
    const bus = new CommandBus();
    expect(() => bus.unregister("nope")).toThrow("Command not found: nope");
  });

  it("lists all registered commands", () => {
    const bus = new CommandBus();
    bus.register({ id: "a", title: "Alpha", category: "test" }, vi.fn());
    bus.register({ id: "b", title: "Beta", category: "test" }, vi.fn());

    const list = bus.list();
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("gets a specific command descriptor", () => {
    const bus = new CommandBus();
    bus.register({ id: "test:cmd", title: "Test", keybinding: "Ctrl+T" }, vi.fn());

    const desc = bus.get("test:cmd");
    expect(desc?.keybinding).toBe("Ctrl+T");
  });

  it("returns undefined for unknown command get", () => {
    const bus = new CommandBus();
    expect(bus.get("nope")).toBeUndefined();
  });

  it("executes async handlers", async () => {
    const bus = new CommandBus();
    bus.register({ id: "async:cmd", title: "Async" }, async () => {
      return 42;
    });

    const result = await bus.execute("async:cmd");
    expect(result).toBe(42);
  });

  it("tracks size correctly", () => {
    const bus = new CommandBus();
    expect(bus.size).toBe(0);

    bus.register({ id: "a", title: "A" }, vi.fn());
    expect(bus.size).toBe(1);

    bus.register({ id: "b", title: "B" }, vi.fn());
    expect(bus.size).toBe(2);

    bus.unregister("a");
    expect(bus.size).toBe(1);
  });
});
