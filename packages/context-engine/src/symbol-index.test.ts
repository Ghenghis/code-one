import { describe, it, expect } from "vitest";
import { SymbolIndex } from "./symbol-index.js";
import type { RepoSymbol } from "@code-one/shared-types";

function sym(overrides?: Partial<RepoSymbol>): RepoSymbol {
  return {
    name: "myFunction",
    kind: "function",
    filePath: "src/index.ts",
    line: 1,
    column: 0,
    exported: true,
    ...overrides,
  };
}

describe("SymbolIndex", () => {
  it("starts empty", () => {
    const idx = new SymbolIndex();
    expect(idx.size).toBe(0);
    expect(idx.fileCount).toBe(0);
  });

  describe("add/addBatch", () => {
    it("adds a single symbol", () => {
      const idx = new SymbolIndex();
      idx.add(sym());
      expect(idx.size).toBe(1);
      expect(idx.fileCount).toBe(1);
    });

    it("adds a batch of symbols", () => {
      const idx = new SymbolIndex();
      idx.addBatch([
        sym({ name: "a", filePath: "a.ts" }),
        sym({ name: "b", filePath: "a.ts" }),
        sym({ name: "c", filePath: "b.ts" }),
      ]);
      expect(idx.size).toBe(3);
      expect(idx.fileCount).toBe(2);
    });
  });

  describe("getByName", () => {
    it("finds symbols by exact name", () => {
      const idx = new SymbolIndex();
      idx.addBatch([
        sym({ name: "foo", filePath: "a.ts" }),
        sym({ name: "foo", filePath: "b.ts" }),
        sym({ name: "bar", filePath: "a.ts" }),
      ]);

      const results = idx.getByName("foo");
      expect(results).toHaveLength(2);
      expect(results.every((s) => s.name === "foo")).toBe(true);
    });

    it("returns empty for unknown name", () => {
      const idx = new SymbolIndex();
      expect(idx.getByName("nonexistent")).toHaveLength(0);
    });
  });

  describe("getByFile", () => {
    it("returns all symbols in a file", () => {
      const idx = new SymbolIndex();
      idx.addBatch([
        sym({ name: "a", filePath: "src/util.ts", line: 1 }),
        sym({ name: "b", filePath: "src/util.ts", line: 10 }),
        sym({ name: "c", filePath: "src/other.ts", line: 1 }),
      ]);

      expect(idx.getByFile("src/util.ts")).toHaveLength(2);
      expect(idx.getByFile("src/other.ts")).toHaveLength(1);
    });

    it("returns empty for unknown file", () => {
      const idx = new SymbolIndex();
      expect(idx.getByFile("nope.ts")).toHaveLength(0);
    });
  });

  describe("getByKind", () => {
    it("filters by symbol kind", () => {
      const idx = new SymbolIndex();
      idx.addBatch([
        sym({ name: "MyClass", kind: "class" }),
        sym({ name: "myFunc", kind: "function" }),
        sym({ name: "IFace", kind: "interface" }),
        sym({ name: "myFunc2", kind: "function" }),
      ]);

      expect(idx.getByKind("function")).toHaveLength(2);
      expect(idx.getByKind("class")).toHaveLength(1);
      expect(idx.getByKind("interface")).toHaveLength(1);
      expect(idx.getByKind("variable")).toHaveLength(0);
    });
  });

  describe("searchByPrefix", () => {
    it("finds symbols starting with prefix (case-insensitive)", () => {
      const idx = new SymbolIndex();
      idx.addBatch([
        sym({ name: "createUser" }),
        sym({ name: "createPost" }),
        sym({ name: "deleteUser" }),
        sym({ name: "CreateSession" }),
      ]);

      const results = idx.searchByPrefix("create");
      expect(results).toHaveLength(3);
    });

    it("respects limit", () => {
      const idx = new SymbolIndex();
      for (let i = 0; i < 100; i++) {
        idx.add(sym({ name: `item${i}`, filePath: `f${i}.ts` }));
      }
      expect(idx.searchByPrefix("item", 5)).toHaveLength(5);
    });
  });

  describe("search", () => {
    it("finds symbols containing substring", () => {
      const idx = new SymbolIndex();
      idx.addBatch([
        sym({ name: "getUserById" }),
        sym({ name: "createUser" }),
        sym({ name: "deletePost" }),
      ]);

      const results = idx.search("user");
      expect(results).toHaveLength(2);
    });
  });

  describe("getExported", () => {
    it("returns only exported symbols", () => {
      const idx = new SymbolIndex();
      idx.addBatch([
        sym({ name: "pub", exported: true }),
        sym({ name: "priv", exported: false }),
        sym({ name: "pub2", exported: true }),
      ]);

      expect(idx.getExported()).toHaveLength(2);
    });
  });

  describe("removeFile", () => {
    it("removes all symbols for a file", () => {
      const idx = new SymbolIndex();
      idx.addBatch([
        sym({ name: "a", filePath: "src/a.ts" }),
        sym({ name: "b", filePath: "src/a.ts" }),
        sym({ name: "c", filePath: "src/b.ts" }),
      ]);

      const removed = idx.removeFile("src/a.ts");
      expect(removed).toBe(2);
      expect(idx.size).toBe(1);
      expect(idx.fileCount).toBe(1);
      expect(idx.getByFile("src/a.ts")).toHaveLength(0);
    });

    it("cleans up name index on removal", () => {
      const idx = new SymbolIndex();
      idx.addBatch([
        sym({ name: "foo", filePath: "a.ts" }),
        sym({ name: "foo", filePath: "b.ts" }),
      ]);

      idx.removeFile("a.ts");
      expect(idx.getByName("foo")).toHaveLength(1);
      expect(idx.getByName("foo")[0].filePath).toBe("b.ts");
    });

    it("returns 0 for unknown file", () => {
      const idx = new SymbolIndex();
      expect(idx.removeFile("nope.ts")).toBe(0);
    });
  });

  describe("getFiles", () => {
    it("lists all indexed files", () => {
      const idx = new SymbolIndex();
      idx.addBatch([
        sym({ filePath: "a.ts" }),
        sym({ filePath: "b.ts" }),
        sym({ filePath: "a.ts", name: "other" }),
      ]);

      const files = idx.getFiles();
      expect(files).toHaveLength(2);
      expect(files).toContain("a.ts");
      expect(files).toContain("b.ts");
    });
  });

  describe("clear", () => {
    it("removes everything", () => {
      const idx = new SymbolIndex();
      idx.addBatch([sym(), sym({ name: "other" })]);
      idx.clear();

      expect(idx.size).toBe(0);
      expect(idx.fileCount).toBe(0);
      expect(idx.getByName("myFunction")).toHaveLength(0);
    });
  });
});
