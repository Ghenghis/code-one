import type {
  AgentEvent,
  BaseEvent,
  EventType,
  EventHandler,
  Disposable,
} from "@code-one/shared-types";

/**
 * Append-only event stream.
 *
 * Every agent action, tool call, and state change is recorded as an
 * immutable event. The stream is the single source of truth for session
 * replay, debugging, and checkpoint/restore.
 *
 * In-memory implementation. A production version would persist to SQLite.
 */
export class EventStream {
  private _events: AgentEvent[] = [];
  private _handlers = new Map<string, Set<EventHandler>>();
  private _anyHandlers = new Set<EventHandler>();

  /** Append an event and notify subscribers. */
  append(event: AgentEvent): void {
    this._events.push(event);

    // Notify type-specific handlers
    const handlers = this._handlers.get(event.type);
    if (handlers) {
      for (const h of handlers) {
        h(event);
      }
    }

    // Notify wildcard handlers
    for (const h of this._anyHandlers) {
      h(event);
    }
  }

  /** Subscribe to events of a specific type. */
  on<E extends AgentEvent>(type: EventType, handler: EventHandler<E>): Disposable {
    if (!this._handlers.has(type)) {
      this._handlers.set(type, new Set());
    }
    this._handlers.get(type)!.add(handler as EventHandler);

    return {
      dispose: () => {
        this._handlers.get(type)?.delete(handler as EventHandler);
      },
    };
  }

  /** Subscribe to all events. */
  onAny(handler: EventHandler): Disposable {
    this._anyHandlers.add(handler);
    return {
      dispose: () => {
        this._anyHandlers.delete(handler);
      },
    };
  }

  /** Get all events, optionally filtered by type. */
  getEvents(type?: EventType): ReadonlyArray<AgentEvent> {
    if (!type) return [...this._events];
    return this._events.filter((e) => e.type === type);
  }

  /** Get all events for a session. */
  getSessionEvents(sessionId: string): ReadonlyArray<AgentEvent> {
    return this._events.filter((e) => e.sessionId === sessionId);
  }

  /** Get an event by ID. */
  getById(id: string): AgentEvent | undefined {
    return this._events.find((e) => e.id === id);
  }

  /** Get the causal chain of events (following parentId links). */
  getCausalChain(eventId: string): AgentEvent[] {
    const chain: AgentEvent[] = [];
    let current = this.getById(eventId);
    while (current) {
      chain.unshift(current);
      current = current.parentId ? this.getById(current.parentId) : undefined;
    }
    return chain;
  }

  /** Get events since a given event ID (exclusive). */
  getEventsSince(eventId: string): ReadonlyArray<AgentEvent> {
    const idx = this._events.findIndex((e) => e.id === eventId);
    if (idx === -1) return [...this._events];
    return this._events.slice(idx + 1);
  }

  /** Total number of events. */
  get length(): number {
    return this._events.length;
  }

  /** Clear all events and handlers. */
  clear(): void {
    this._events = [];
    this._handlers.clear();
    this._anyHandlers.clear();
  }
}

// ---------------------------------------------------------------------------
// Event factory helper
// ---------------------------------------------------------------------------

let _counter = 0;

/** Create a base event with auto-generated ID and timestamp. */
export function createEvent<T extends AgentEvent>(
  type: T["type"],
  sessionId: string,
  source: BaseEvent["source"],
  payload: T["payload"],
  parentId?: string,
): T {
  return {
    id: `evt_${++_counter}_${Date.now()}`,
    timestamp: Date.now(),
    source,
    sessionId,
    parentId,
    type,
    payload,
  } as unknown as T;
}
