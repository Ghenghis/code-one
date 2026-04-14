import { describe, it, expect, vi } from "vitest";
import { EventBus } from "./event-bus.js";
import type { BaseEvent } from "@code-one/shared-types";

function makeEvent(type: string, overrides: Partial<BaseEvent> = {}): BaseEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    source: "system",
    sessionId: "test-session",
    type,
    ...overrides,
  };
}

describe("EventBus", () => {
  it("emits events to typed subscribers", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on("test:event", handler);
    const event = makeEvent("test:event");
    bus.emit(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("does not deliver events to unrelated subscribers", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on("other:event", handler);
    bus.emit(makeEvent("test:event"));

    expect(handler).not.toHaveBeenCalled();
  });

  it("delivers events to wildcard subscribers", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.onAny(handler);
    bus.emit(makeEvent("first"));
    bus.emit(makeEvent("second"));

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("supports dispose to unsubscribe", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const sub = bus.on("test:event", handler);
    bus.emit(makeEvent("test:event"));
    expect(handler).toHaveBeenCalledTimes(1);

    sub.dispose();
    bus.emit(makeEvent("test:event"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("supports dispose for wildcard subscribers", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const sub = bus.onAny(handler);
    bus.emit(makeEvent("test:event"));
    sub.dispose();
    bus.emit(makeEvent("test:event"));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("maintains append-only event history", () => {
    const bus = new EventBus();
    bus.emit(makeEvent("a"));
    bus.emit(makeEvent("b"));
    bus.emit(makeEvent("a"));

    expect(bus.history()).toHaveLength(3);
    expect(bus.history("a")).toHaveLength(2);
    expect(bus.history("b")).toHaveLength(1);
  });

  it("clear() removes subscriptions but keeps history", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("test:event", handler);
    bus.emit(makeEvent("test:event"));

    bus.clear();
    bus.emit(makeEvent("test:event"));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(bus.history()).toHaveLength(2);
  });

  it("clearHistory() empties the event log", () => {
    const bus = new EventBus();
    bus.emit(makeEvent("a"));
    bus.emit(makeEvent("b"));
    expect(bus.size).toBe(2);

    bus.clearHistory();
    expect(bus.size).toBe(0);
    expect(bus.history()).toHaveLength(0);
  });

  it("handler errors do not prevent other handlers from running", () => {
    const bus = new EventBus();
    const badHandler = vi.fn(() => {
      throw new Error("boom");
    });
    const goodHandler = vi.fn();

    bus.on("test:event", badHandler);
    bus.on("test:event", goodHandler);
    bus.emit(makeEvent("test:event"));

    expect(badHandler).toHaveBeenCalledTimes(1);
    expect(goodHandler).toHaveBeenCalledTimes(1);
  });

  it("supports multiple subscribers for the same event type", () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on("test:event", h1);
    bus.on("test:event", h2);
    bus.emit(makeEvent("test:event"));

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });
});
