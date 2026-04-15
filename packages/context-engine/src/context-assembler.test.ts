import { describe, it, expect } from "vitest";
import { ContextAssembler, estimateTokens, type ContextItem } from "./context-assembler.js";
import type { RepositoryMap, MemoryEntry } from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function item(overrides?: Partial<ContextItem>): ContextItem {
  const content = overrides?.content ?? "test content here";
  return {
    kind: "file",
    source: "src/test.ts",
    content,
    relevance: 0.5,
    tokenEstimate: estimateTokens(content),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("estimateTokens", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("hello world")).toBe(3); // 11 chars → ceil(11/4) = 3
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a")).toBe(1);
  });
});

describe("ContextAssembler", () => {
  describe("assemble()", () => {
    it("includes items within budget", () => {
      const assembler = new ContextAssembler({ budgetTokens: 1000, reservedTokens: 0 });
      const items = [
        item({ content: "short", relevance: 0.9 }),
        item({ content: "also short", relevance: 0.8, source: "src/b.ts" }),
      ];

      const result = assembler.assemble(items);
      expect(result.items).toHaveLength(2);
      expect(result.droppedCount).toBe(0);
    });

    it("orders by relevance descending", () => {
      const assembler = new ContextAssembler({ budgetTokens: 1000, reservedTokens: 0 });
      const items = [
        item({ relevance: 0.3, source: "low" }),
        item({ relevance: 0.9, source: "high" }),
        item({ relevance: 0.6, source: "mid" }),
      ];

      const result = assembler.assemble(items);
      expect(result.items[0].source).toBe("high");
      expect(result.items[1].source).toBe("mid");
      expect(result.items[2].source).toBe("low");
    });

    it("drops items that exceed budget", () => {
      // Very tight budget: ~10 tokens = ~40 chars
      const assembler = new ContextAssembler({ budgetTokens: 10, reservedTokens: 0 });
      const items = [
        item({ content: "a".repeat(20), relevance: 0.9 }), // ~5 tokens, fits
        item({ content: "b".repeat(200), relevance: 0.8 }), // ~50 tokens, won't fit
      ];

      const result = assembler.assemble(items);
      // First fits, second might get truncated or dropped
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.totalTokens).toBeLessThanOrEqual(10);
    });

    it("truncates last item to fit remaining budget", () => {
      const assembler = new ContextAssembler({ budgetTokens: 100, reservedTokens: 0 });
      const items = [
        item({ content: "a".repeat(200), relevance: 0.9 }), // ~50 tokens
        item({ content: "b".repeat(400), relevance: 0.8, source: "big.ts" }), // ~100 tokens, won't fully fit
      ];

      const result = assembler.assemble(items);
      const bigItem = result.items.find((i) => i.source === "big.ts");
      if (bigItem) {
        expect(bigItem.metadata?.truncated).toBe(true);
      }
      expect(result.totalTokens).toBeLessThanOrEqual(100);
    });

    it("enforces maxFiles limit", () => {
      const assembler = new ContextAssembler({
        budgetTokens: 10000,
        reservedTokens: 0,
        maxFiles: 2,
      });
      const items = [
        item({ kind: "file", source: "a.ts", relevance: 0.9 }),
        item({ kind: "file", source: "b.ts", relevance: 0.8 }),
        item({ kind: "file", source: "c.ts", relevance: 0.7 }),
      ];

      const result = assembler.assemble(items);
      const files = result.items.filter((i) => i.kind === "file");
      expect(files).toHaveLength(2);
      expect(result.droppedCount).toBe(1);
    });

    it("enforces maxMemory limit", () => {
      const assembler = new ContextAssembler({
        budgetTokens: 10000,
        reservedTokens: 0,
        maxMemory: 1,
      });
      const items = [
        item({ kind: "memory", source: "mem/a", relevance: 0.9 }),
        item({ kind: "memory", source: "mem/b", relevance: 0.8 }),
      ];

      const result = assembler.assemble(items);
      const mems = result.items.filter((i) => i.kind === "memory");
      expect(mems).toHaveLength(1);
    });

    it("reserves tokens correctly", () => {
      const assembler = new ContextAssembler({ budgetTokens: 100, reservedTokens: 90 });
      // Only 10 tokens available for content
      const items = [
        item({ content: "a".repeat(80), relevance: 0.9 }), // ~20 tokens, won't fully fit
      ];

      const result = assembler.assemble(items);
      expect(result.totalTokens).toBeLessThanOrEqual(10);
    });
  });

  describe("contextFromRepoMap()", () => {
    it("creates items from repo map with file content", () => {
      const assembler = new ContextAssembler({ budgetTokens: 5000 });
      const repoMap: RepositoryMap = {
        rootPath: "/repo",
        files: [
          {
            path: "src/a.ts",
            language: "typescript",
            sizeBytes: 100,
            lineCount: 10,
            pageRank: 0.6,
            modifiedAt: Date.now(),
          },
          {
            path: "src/b.ts",
            language: "typescript",
            sizeBytes: 200,
            lineCount: 20,
            pageRank: 0.4,
            modifiedAt: Date.now(),
          },
        ],
        symbols: [
          {
            name: "foo",
            kind: "function",
            filePath: "src/a.ts",
            line: 1,
            column: 0,
            exported: true,
          },
        ],
        dependencies: [],
        builtAt: Date.now(),
      };

      const contents = new Map([["src/a.ts", "export function foo() { return 1; }"]]);

      const items = assembler.contextFromRepoMap(repoMap, contents);

      expect(items).toHaveLength(2);
      // a.ts has full content
      const aItem = items.find((i) => i.source === "src/a.ts")!;
      expect(aItem.content).toContain("export function");
      expect(aItem.relevance).toBe(0.6);
      // b.ts has summary only (no content provided)
      const bItem = items.find((i) => i.source === "src/b.ts")!;
      expect(bItem.content).toContain("20 lines");
      expect(bItem.relevance).toBe(0.4 * 0.5); // summary discount
    });

    it("creates summary items when no content provided", () => {
      const assembler = new ContextAssembler({ budgetTokens: 5000 });
      const repoMap: RepositoryMap = {
        rootPath: "/repo",
        files: [
          {
            path: "src/index.ts",
            language: "typescript",
            sizeBytes: 500,
            lineCount: 30,
            pageRank: 0.8,
            modifiedAt: Date.now(),
          },
        ],
        symbols: [
          {
            name: "main",
            kind: "function",
            filePath: "src/index.ts",
            line: 1,
            column: 0,
            exported: true,
          },
          {
            name: "helper",
            kind: "function",
            filePath: "src/index.ts",
            line: 10,
            column: 0,
            exported: true,
          },
        ],
        dependencies: [],
        builtAt: Date.now(),
      };

      const items = assembler.contextFromRepoMap(repoMap);
      expect(items[0].content).toContain("function main");
      expect(items[0].content).toContain("function helper");
    });
  });

  describe("contextFromMemory()", () => {
    it("creates context items from memory entries", () => {
      const assembler = new ContextAssembler({ budgetTokens: 5000 });
      const entries: MemoryEntry[] = [
        {
          id: "1",
          scope: "session",
          namespace: "decisions",
          key: "framework",
          value: "Use React 19",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: "user",
          ttlSeconds: 0,
        },
      ];

      const items = assembler.contextFromMemory(entries);
      expect(items).toHaveLength(1);
      expect(items[0].kind).toBe("memory");
      expect(items[0].content).toContain("framework");
      expect(items[0].content).toContain("React 19");
      expect(items[0].relevance).toBeGreaterThan(0.5);
    });

    it("gives higher relevance to recent entries", () => {
      const assembler = new ContextAssembler({ budgetTokens: 5000 });
      const now = Date.now();
      const entries: MemoryEntry[] = [
        {
          id: "old",
          scope: "session",
          namespace: "test",
          key: "old",
          value: "old data",
          createdAt: now - 48 * 60 * 60 * 1000, // 48h ago
          updatedAt: now - 48 * 60 * 60 * 1000,
          source: "agent",
          ttlSeconds: 0,
        },
        {
          id: "new",
          scope: "session",
          namespace: "test",
          key: "new",
          value: "new data",
          createdAt: now,
          updatedAt: now,
          source: "agent",
          ttlSeconds: 0,
        },
      ];

      const items = assembler.contextFromMemory(entries);
      const oldItem = items.find((i) => i.source.includes("old"))!;
      const newItem = items.find((i) => i.source.includes("new"))!;
      expect(newItem.relevance).toBeGreaterThan(oldItem.relevance);
    });
  });

  describe("contextFromDiagnostics()", () => {
    it("creates a single high-relevance item from diagnostics", () => {
      const assembler = new ContextAssembler({ budgetTokens: 5000 });
      const diags = [
        {
          file: "src/app.ts",
          line: 42,
          message: "Type error: x is not a number",
          severity: "error",
        },
        { file: "src/utils.ts", line: 10, message: "Unused import", severity: "warning" },
      ];

      const items = assembler.contextFromDiagnostics(diags);
      expect(items).toHaveLength(1);
      expect(items[0].kind).toBe("diagnostic");
      expect(items[0].relevance).toBe(0.9);
      expect(items[0].content).toContain("src/app.ts:42");
      expect(items[0].content).toContain("Type error");
    });

    it("returns empty for no diagnostics", () => {
      const assembler = new ContextAssembler({ budgetTokens: 5000 });
      expect(assembler.contextFromDiagnostics([])).toHaveLength(0);
    });
  });
});
