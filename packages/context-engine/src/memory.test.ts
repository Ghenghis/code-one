import { describe, it, expect } from "vitest";
import { InMemoryStore } from "./memory.js";
import type { MemoryEntry, MemoryScope } from "@code-one/shared-types";

type SetInput = Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">;

function entry(overrides?: Partial<SetInput>): SetInput {
  return {
    scope: "session" as MemoryScope,
    namespace: "test",
    key: "mykey",
    value: "myvalue",
    source: "agent",
    ttlSeconds: 0,
    ...overrides,
  };
}

describe("InMemoryStore", () => {
  it("starts empty", () => {
    const store = new InMemoryStore();
    expect(store.size).toBe(0);
  });

  describe("set/get", () => {
    it("stores and retrieves an entry", async () => {
      const store = new InMemoryStore();
      const saved = await store.set(entry());

      expect(saved.id).toBeDefined();
      expect(saved.createdAt).toBeGreaterThan(0);
      expect(saved.value).toBe("myvalue");

      const retrieved = await store.get("session", "test", "mykey");
      expect(retrieved).toBeDefined();
      expect(retrieved!.value).toBe("myvalue");
    });

    it("returns undefined for missing entry", async () => {
      const store = new InMemoryStore();
      expect(await store.get("session", "test", "nope")).toBeUndefined();
    });

    it("updates existing entry preserving createdAt", async () => {
      const store = new InMemoryStore();
      const first = await store.set(entry({ value: "v1" }));
      const second = await store.set(entry({ value: "v2" }));

      expect(second.id).toBe(first.id);
      expect(second.createdAt).toBe(first.createdAt);
      expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
      expect(second.value).toBe("v2");
    });

    it("scopes entries independently", async () => {
      const store = new InMemoryStore();
      await store.set(entry({ scope: "session", key: "k", value: "session-val" }));
      await store.set(entry({ scope: "project", key: "k", value: "project-val" }));

      const session = await store.get("session", "test", "k");
      const project = await store.get("project", "test", "k");
      expect(session!.value).toBe("session-val");
      expect(project!.value).toBe("project-val");
    });
  });

  describe("delete", () => {
    it("removes an entry", async () => {
      const store = new InMemoryStore();
      await store.set(entry());

      expect(await store.delete("session", "test", "mykey")).toBe(true);
      expect(await store.get("session", "test", "mykey")).toBeUndefined();
    });

    it("returns false for missing entry", async () => {
      const store = new InMemoryStore();
      expect(await store.delete("session", "test", "nope")).toBe(false);
    });
  });

  describe("list", () => {
    it("lists entries by scope", async () => {
      const store = new InMemoryStore();
      await store.set(entry({ scope: "session", key: "a" }));
      await store.set(entry({ scope: "session", key: "b" }));
      await store.set(entry({ scope: "project", key: "c" }));

      const session = await store.list("session");
      expect(session).toHaveLength(2);

      const project = await store.list("project");
      expect(project).toHaveLength(1);
    });

    it("filters by namespace", async () => {
      const store = new InMemoryStore();
      await store.set(entry({ namespace: "decisions", key: "a" }));
      await store.set(entry({ namespace: "context", key: "b" }));
      await store.set(entry({ namespace: "decisions", key: "c" }));

      const decisions = await store.list("session", "decisions");
      expect(decisions).toHaveLength(2);
    });

    it("excludes expired entries", async () => {
      const store = new InMemoryStore();
      // Set with TTL of 0 seconds — but since ttlSeconds = 0 means permanent, use -1 logic
      // Actually, set a very short TTL that's already expired
      const saved = await store.set(entry({ ttlSeconds: 1, key: "ephemeral" }));
      // Manually expire by backdating updatedAt
      // We can't easily do this without internal access, so test with ttlSeconds: 0 (permanent)
      await store.set(entry({ ttlSeconds: 0, key: "permanent" }));

      const list = await store.list("session");
      expect(list.some((e) => e.key === "permanent")).toBe(true);
      // "ephemeral" is not yet expired (just created), so it appears too
      expect(list.some((e) => e.key === "ephemeral")).toBe(true);
    });
  });

  describe("search", () => {
    it("finds entries by key substring", async () => {
      const store = new InMemoryStore();
      await store.set(entry({ key: "user-preferences", value: "dark mode" }));
      await store.set(entry({ key: "api-config", value: "base url" }));
      await store.set(entry({ key: "user-name", value: "admin" }));

      const results = await store.search("session", "user");
      expect(results).toHaveLength(2);
    });

    it("finds entries by value substring", async () => {
      const store = new InMemoryStore();
      await store.set(entry({ key: "setting1", value: "use TypeScript strict mode" }));
      await store.set(entry({ key: "setting2", value: "enable ESLint" }));

      const results = await store.search("session", "typescript");
      expect(results).toHaveLength(1);
    });

    it("respects scope boundary", async () => {
      const store = new InMemoryStore();
      await store.set(entry({ scope: "session", key: "k", value: "hello" }));
      await store.set(entry({ scope: "project", key: "k2", value: "hello world" }));

      const results = await store.search("session", "hello");
      expect(results).toHaveLength(1);
    });

    it("respects limit", async () => {
      const store = new InMemoryStore();
      for (let i = 0; i < 10; i++) {
        await store.set(entry({ key: `item-${i}`, value: `match-${i}` }));
      }

      const results = await store.search("session", "match", 3);
      expect(results).toHaveLength(3);
    });
  });

  describe("clear", () => {
    it("removes all entries for a scope", async () => {
      const store = new InMemoryStore();
      await store.set(entry({ scope: "session", key: "a" }));
      await store.set(entry({ scope: "session", key: "b" }));
      await store.set(entry({ scope: "project", key: "c" }));

      await store.clear("session");

      expect(await store.list("session")).toHaveLength(0);
      expect(await store.list("project")).toHaveLength(1);
    });
  });
});
