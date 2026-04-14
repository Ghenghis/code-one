import type { BaseEvent, Disposable, EventHandler, IEventBus } from "@code-one/shared-types";

/**
 * In-memory event bus implementing the append-only EventStream pattern.
 *
 * - Events are immutable once emitted
 * - Full history is retained for replay
 * - Supports typed subscriptions and wildcard listeners
 */
export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private wildcardHandlers = new Set<EventHandler>();
  private events: BaseEvent[] = [];

  emit<E extends BaseEvent>(event: E): void {
    this.events.push(event);

    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(event);
        } catch {
          // Handlers must not crash the bus.
          // Errors are silently caught; use Logger for observability.
        }
      }
    }

    for (const handler of this.wildcardHandlers) {
      try {
        handler(event);
      } catch {
        // Same: wildcard handlers must not crash the bus.
      }
    }
  }

  on<E extends BaseEvent>(type: string, handler: EventHandler<E>): Disposable {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const h = handler as EventHandler;
    set.add(h);

    return {
      dispose: () => {
        set!.delete(h);
        if (set!.size === 0) {
          this.handlers.delete(type);
        }
      },
    };
  }

  onAny(handler: EventHandler): Disposable {
    this.wildcardHandlers.add(handler);
    return {
      dispose: () => {
        this.wildcardHandlers.delete(handler);
      },
    };
  }

  history(type?: string): ReadonlyArray<BaseEvent> {
    if (type === undefined) {
      return [...this.events];
    }
    return this.events.filter((e) => e.type === type);
  }

  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
    // Note: event history is NOT cleared — it is append-only.
    // Use clearHistory() explicitly if needed for testing.
  }

  /** Clear event history. Intended for testing only. */
  clearHistory(): void {
    this.events = [];
  }

  /** Get the total number of events emitted */
  get size(): number {
    return this.events.length;
  }
}
