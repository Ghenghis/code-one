import { describe, it, expect, vi } from "vitest";
import { EventStream, createEvent } from "./event-stream.js";
import type { UserMessageEvent, ToolCallEvent, AgentEvent } from "@code-one/shared-types";

function userMsg(sessionId = "s1", parentId?: string): UserMessageEvent {
  return createEvent<UserMessageEvent>(
    "user:message",
    sessionId,
    "user",
    { text: "hello" },
    parentId,
  );
}

function toolCall(sessionId = "s1", parentId?: string): ToolCallEvent {
  return createEvent<ToolCallEvent>(
    "tool:call",
    sessionId,
    "agent",
    { toolName: "read_file", args: { path: "test.ts" }, trustLevel: "trusted" },
    parentId,
  );
}

describe("EventStream", () => {
  it("starts empty", () => {
    const stream = new EventStream();
    expect(stream.length).toBe(0);
    expect(stream.getEvents()).toEqual([]);
  });

  describe("append", () => {
    it("appends events and increments length", () => {
      const stream = new EventStream();
      stream.append(userMsg());
      stream.append(toolCall());
      expect(stream.length).toBe(2);
    });

    it("notifies type-specific handlers", () => {
      const stream = new EventStream();
      const handler = vi.fn();
      stream.on("user:message", handler);

      const msg = userMsg();
      stream.append(msg);
      stream.append(toolCall());

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(msg);
    });

    it("notifies wildcard handlers for all events", () => {
      const stream = new EventStream();
      const handler = vi.fn();
      stream.onAny(handler);

      stream.append(userMsg());
      stream.append(toolCall());

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe("subscriptions", () => {
    it("disposes type-specific subscription", () => {
      const stream = new EventStream();
      const handler = vi.fn();
      const sub = stream.on("user:message", handler);

      stream.append(userMsg());
      expect(handler).toHaveBeenCalledOnce();

      sub.dispose();
      stream.append(userMsg());
      expect(handler).toHaveBeenCalledOnce(); // not called again
    });

    it("disposes wildcard subscription", () => {
      const stream = new EventStream();
      const handler = vi.fn();
      const sub = stream.onAny(handler);

      stream.append(userMsg());
      sub.dispose();
      stream.append(userMsg());

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe("getEvents", () => {
    it("returns all events without filter", () => {
      const stream = new EventStream();
      stream.append(userMsg());
      stream.append(toolCall());
      expect(stream.getEvents()).toHaveLength(2);
    });

    it("filters by event type", () => {
      const stream = new EventStream();
      stream.append(userMsg());
      stream.append(toolCall());
      stream.append(userMsg());

      expect(stream.getEvents("user:message")).toHaveLength(2);
      expect(stream.getEvents("tool:call")).toHaveLength(1);
    });
  });

  describe("getSessionEvents", () => {
    it("returns events for a specific session", () => {
      const stream = new EventStream();
      stream.append(userMsg("s1"));
      stream.append(userMsg("s2"));
      stream.append(toolCall("s1"));

      expect(stream.getSessionEvents("s1")).toHaveLength(2);
      expect(stream.getSessionEvents("s2")).toHaveLength(1);
    });
  });

  describe("getById", () => {
    it("finds event by ID", () => {
      const stream = new EventStream();
      const msg = userMsg();
      stream.append(msg);

      expect(stream.getById(msg.id)).toEqual(msg);
    });

    it("returns undefined for unknown ID", () => {
      const stream = new EventStream();
      expect(stream.getById("nope")).toBeUndefined();
    });
  });

  describe("getCausalChain", () => {
    it("returns causal chain following parentId", () => {
      const stream = new EventStream();
      const e1 = userMsg("s1");
      const e2 = toolCall("s1", e1.id);
      stream.append(e1);
      stream.append(e2);

      const chain = stream.getCausalChain(e2.id);
      expect(chain).toHaveLength(2);
      expect(chain[0].id).toBe(e1.id);
      expect(chain[1].id).toBe(e2.id);
    });

    it("returns single event when no parent", () => {
      const stream = new EventStream();
      const e1 = userMsg("s1");
      stream.append(e1);

      const chain = stream.getCausalChain(e1.id);
      expect(chain).toHaveLength(1);
    });
  });

  describe("getEventsSince", () => {
    it("returns events after a given event ID", () => {
      const stream = new EventStream();
      const e1 = userMsg();
      const e2 = toolCall();
      const e3 = userMsg();
      stream.append(e1);
      stream.append(e2);
      stream.append(e3);

      const since = stream.getEventsSince(e1.id);
      expect(since).toHaveLength(2);
      expect(since[0].id).toBe(e2.id);
    });

    it("returns all events if ID not found", () => {
      const stream = new EventStream();
      stream.append(userMsg());
      stream.append(toolCall());

      expect(stream.getEventsSince("unknown")).toHaveLength(2);
    });
  });

  describe("clear", () => {
    it("removes all events and handlers", () => {
      const stream = new EventStream();
      const handler = vi.fn();
      stream.on("user:message", handler);
      stream.append(userMsg());

      stream.clear();

      expect(stream.length).toBe(0);
      stream.append(userMsg());
      expect(handler).toHaveBeenCalledOnce(); // handler was cleared, not called again
    });
  });
});

describe("createEvent", () => {
  it("creates an event with ID, timestamp, and correct fields", () => {
    const event = createEvent<UserMessageEvent>(
      "user:message",
      "session-1",
      "user",
      { text: "hi" },
    );

    expect(event.id).toMatch(/^evt_/);
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.type).toBe("user:message");
    expect(event.sessionId).toBe("session-1");
    expect(event.source).toBe("user");
    expect(event.payload.text).toBe("hi");
    expect(event.parentId).toBeUndefined();
  });

  it("sets parentId when provided", () => {
    const event = createEvent<ToolCallEvent>(
      "tool:call",
      "s1",
      "agent",
      { toolName: "test", args: {}, trustLevel: "trusted" },
      "parent-123",
    );

    expect(event.parentId).toBe("parent-123");
  });
});
