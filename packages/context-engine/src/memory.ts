import type { MemoryEntry, MemoryStore } from "@code-one/shared-types";
import type { MemoryScope } from "@code-one/shared-types";

/**
 * In-memory implementation of MemoryStore.
 *
 * Provides scoped key-value storage with namespace grouping,
 * TTL expiration, and basic substring search. A production
 * implementation would back this with SQLite + embeddings.
 */
export class InMemoryStore implements MemoryStore {
  private _entries = new Map<string, MemoryEntry>();
  private _idCounter = 0;

  private _key(scope: MemoryScope, namespace: string, key: string): string {
    return `${scope}::${namespace}::${key}`;
  }

  private _nextId(): string {
    return `mem_${++this._idCounter}`;
  }

  private _isExpired(entry: MemoryEntry): boolean {
    if (entry.ttlSeconds <= 0) return false;
    return Date.now() > entry.updatedAt + entry.ttlSeconds * 1000;
  }

  async get(
    scope: MemoryScope,
    namespace: string,
    key: string,
  ): Promise<MemoryEntry | undefined> {
    const compositeKey = this._key(scope, namespace, key);
    const entry = this._entries.get(compositeKey);
    if (!entry) return undefined;
    if (this._isExpired(entry)) {
      this._entries.delete(compositeKey);
      return undefined;
    }
    return { ...entry };
  }

  async set(
    input: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">,
  ): Promise<MemoryEntry> {
    const compositeKey = this._key(input.scope, input.namespace, input.key);
    const existing = this._entries.get(compositeKey);
    const now = Date.now();

    const entry: MemoryEntry = {
      ...input,
      id: existing?.id ?? this._nextId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this._entries.set(compositeKey, entry);
    return { ...entry };
  }

  async delete(
    scope: MemoryScope,
    namespace: string,
    key: string,
  ): Promise<boolean> {
    return this._entries.delete(this._key(scope, namespace, key));
  }

  async list(scope: MemoryScope, namespace?: string): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];
    for (const [, entry] of this._entries) {
      if (entry.scope !== scope) continue;
      if (namespace !== undefined && entry.namespace !== namespace) continue;
      if (this._isExpired(entry)) continue;
      results.push({ ...entry });
    }
    return results;
  }

  async search(
    scope: MemoryScope,
    query: string,
    limit = 20,
  ): Promise<MemoryEntry[]> {
    const lower = query.toLowerCase();
    const results: MemoryEntry[] = [];

    for (const [, entry] of this._entries) {
      if (entry.scope !== scope) continue;
      if (this._isExpired(entry)) continue;

      // Search in key, namespace, and string values
      const haystack = [
        entry.key,
        entry.namespace,
        typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value),
      ]
        .join(" ")
        .toLowerCase();

      if (haystack.includes(lower)) {
        results.push({ ...entry });
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  async clear(scope: MemoryScope): Promise<void> {
    for (const [key, entry] of this._entries) {
      if (entry.scope === scope) {
        this._entries.delete(key);
      }
    }
  }

  /** Total entries across all scopes (for testing). */
  get size(): number {
    return this._entries.size;
  }
}
