import { describe, it, expect } from "vitest";
import { RepoMapBuilder } from "./repo-map.js";
import type { RepoFileEntry, RepoSymbol, RepoDependency } from "@code-one/shared-types";

function fileEntry(
  path: string,
  overrides?: Partial<Omit<RepoFileEntry, "pageRank">>,
): Omit<RepoFileEntry, "pageRank"> {
  return {
    path,
    language: "typescript",
    sizeBytes: 1000,
    lineCount: 50,
    modifiedAt: Date.now(),
    ...overrides,
  };
}

function symbol(name: string, filePath: string, overrides?: Partial<RepoSymbol>): RepoSymbol {
  return {
    name,
    kind: "function",
    filePath,
    line: 1,
    column: 0,
    exported: true,
    ...overrides,
  };
}

describe("RepoMapBuilder", () => {
  it("starts empty", () => {
    const builder = new RepoMapBuilder("/repo");
    expect(builder.fileCount).toBe(0);
    expect(builder.dependencyCount).toBe(0);
  });

  describe("file management", () => {
    it("adds and counts files", () => {
      const builder = new RepoMapBuilder("/repo");
      builder.addFiles([fileEntry("src/a.ts"), fileEntry("src/b.ts")]);
      expect(builder.fileCount).toBe(2);
    });

    it("removes a file and its symbols/deps", () => {
      const builder = new RepoMapBuilder("/repo");
      builder.addFile(fileEntry("src/a.ts"));
      builder.addFile(fileEntry("src/b.ts"));
      builder.addSymbols("src/a.ts", [symbol("foo", "src/a.ts")]);
      builder.addDependency({ from: "src/a.ts", to: "src/b.ts", kind: "static" });

      builder.removeFile("src/a.ts");

      expect(builder.fileCount).toBe(1);
      expect(builder.dependencyCount).toBe(0);
      expect(builder.symbolIndex.getByFile("src/a.ts")).toHaveLength(0);
    });
  });

  describe("symbols", () => {
    it("adds symbols to the index", () => {
      const builder = new RepoMapBuilder("/repo");
      builder.addFile(fileEntry("src/a.ts"));
      builder.addSymbols("src/a.ts", [symbol("foo", "src/a.ts"), symbol("bar", "src/a.ts")]);

      expect(builder.symbolIndex.size).toBe(2);
    });

    it("replaces symbols on re-parse", () => {
      const builder = new RepoMapBuilder("/repo");
      builder.addFile(fileEntry("src/a.ts"));
      builder.addSymbols("src/a.ts", [symbol("foo", "src/a.ts")]);
      builder.addSymbols("src/a.ts", [symbol("bar", "src/a.ts"), symbol("baz", "src/a.ts")]);

      expect(builder.symbolIndex.size).toBe(2);
      expect(builder.symbolIndex.getByName("foo")).toHaveLength(0);
    });
  });

  describe("build()", () => {
    it("produces a RepositoryMap with correct structure", () => {
      const builder = new RepoMapBuilder("/repo");
      builder.addFiles([fileEntry("src/a.ts"), fileEntry("src/b.ts")]);
      builder.addSymbols("src/a.ts", [symbol("foo", "src/a.ts")]);
      builder.addDependency({ from: "src/a.ts", to: "src/b.ts", kind: "static" });

      const map = builder.build();

      expect(map.rootPath).toBe("/repo");
      expect(map.files).toHaveLength(2);
      expect(map.symbols).toHaveLength(1);
      expect(map.dependencies).toHaveLength(1);
      expect(map.builtAt).toBeGreaterThan(0);
    });

    it("computes pageRank scores that sum to ~1.0", () => {
      const builder = new RepoMapBuilder("/repo");
      builder.addFiles([fileEntry("a.ts"), fileEntry("b.ts"), fileEntry("c.ts")]);
      builder.addDependencies([
        { from: "a.ts", to: "b.ts", kind: "static" },
        { from: "c.ts", to: "b.ts", kind: "static" },
      ]);

      const map = builder.build();
      const totalRank = map.files.reduce((sum, f) => sum + f.pageRank, 0);
      expect(totalRank).toBeCloseTo(1.0, 2);
    });

    it("sorts files by pageRank descending", () => {
      const builder = new RepoMapBuilder("/repo");
      builder.addFiles([fileEntry("a.ts"), fileEntry("b.ts"), fileEntry("c.ts")]);
      // b.ts is imported by both a and c → highest rank
      builder.addDependencies([
        { from: "a.ts", to: "b.ts", kind: "static" },
        { from: "c.ts", to: "b.ts", kind: "static" },
      ]);

      const map = builder.build();
      expect(map.files[0].path).toBe("b.ts");
    });

    it("boosts recently-active files", () => {
      const builder = new RepoMapBuilder("/repo");
      builder.addFiles([fileEntry("a.ts"), fileEntry("b.ts")]);
      // No deps, so base scores are equal
      builder.markActive("a.ts");

      const map = builder.build();
      const aFile = map.files.find((f) => f.path === "a.ts")!;
      const bFile = map.files.find((f) => f.path === "b.ts")!;
      expect(aFile.pageRank).toBeGreaterThan(bFile.pageRank);
    });

    it("does not boost stale active files outside window", () => {
      const builder = new RepoMapBuilder("/repo");
      builder.addFiles([fileEntry("a.ts"), fileEntry("b.ts")]);

      // Mark active far in the past (beyond the 30min default window)
      builder.markActive("a.ts", Date.now() - 60 * 60 * 1000);

      const map = builder.build();
      const aFile = map.files.find((f) => f.path === "a.ts")!;
      const bFile = map.files.find((f) => f.path === "b.ts")!;
      expect(aFile.pageRank).toBeCloseTo(bFile.pageRank, 4);
    });

    it("only includes exported symbols in map output", () => {
      const builder = new RepoMapBuilder("/repo");
      builder.addFile(fileEntry("a.ts"));
      builder.addSymbols("a.ts", [
        symbol("pub", "a.ts", { exported: true }),
        symbol("priv", "a.ts", { exported: false }),
      ]);

      const map = builder.build();
      expect(map.symbols).toHaveLength(1);
      expect(map.symbols[0].name).toBe("pub");
    });
  });

  describe("getTopFiles", () => {
    it("returns top N files by importance", () => {
      const builder = new RepoMapBuilder("/repo");
      builder.addFiles([fileEntry("a.ts"), fileEntry("b.ts"), fileEntry("c.ts")]);
      builder.addDependencies([
        { from: "a.ts", to: "b.ts", kind: "static" },
        { from: "c.ts", to: "b.ts", kind: "static" },
      ]);

      const top = builder.getTopFiles(1);
      expect(top).toHaveLength(1);
      expect(top[0].path).toBe("b.ts");
    });
  });

  describe("clear", () => {
    it("resets everything", () => {
      const builder = new RepoMapBuilder("/repo");
      builder.addFile(fileEntry("a.ts"));
      builder.addSymbols("a.ts", [symbol("foo", "a.ts")]);
      builder.addDependency({ from: "a.ts", to: "b.ts", kind: "static" });
      builder.markActive("a.ts");

      builder.clear();

      expect(builder.fileCount).toBe(0);
      expect(builder.dependencyCount).toBe(0);
      expect(builder.symbolIndex.size).toBe(0);
    });
  });
});
