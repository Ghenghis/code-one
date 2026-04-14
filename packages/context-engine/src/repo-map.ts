import type {
  RepositoryMap,
  RepoFileEntry,
  RepoSymbol,
  RepoDependency,
} from "@code-one/shared-types";
import { SymbolIndex } from "./symbol-index.js";
import { computePageRank } from "./pagerank.js";

/**
 * Builds and maintains a RepositoryMap — a graph of files, symbols,
 * and dependencies with PageRank-based importance scoring.
 *
 * Usage:
 * 1. addFile() for each file with metadata
 * 2. addSymbols() for parsed symbols per file
 * 3. addDependency() for import/export edges
 * 4. build() to compute PageRank and produce the final RepositoryMap
 */
export class RepoMapBuilder {
  private _rootPath: string;
  private _files = new Map<string, Omit<RepoFileEntry, "pageRank">>();
  private _symbolIndex = new SymbolIndex();
  private _dependencies: RepoDependency[] = [];
  /** Track recently-active files for priority boosting */
  private _activeFiles = new Map<string, number>(); // path → timestamp

  constructor(rootPath: string) {
    this._rootPath = rootPath;
  }

  get symbolIndex(): SymbolIndex {
    return this._symbolIndex;
  }

  /** Register a file in the map. */
  addFile(entry: Omit<RepoFileEntry, "pageRank">): void {
    this._files.set(entry.path, entry);
  }

  /** Register multiple files. */
  addFiles(entries: Array<Omit<RepoFileEntry, "pageRank">>): void {
    for (const e of entries) {
      this.addFile(e);
    }
  }

  /** Add parsed symbols for a file. Replaces any existing symbols for that file. */
  addSymbols(filePath: string, symbols: RepoSymbol[]): void {
    this._symbolIndex.removeFile(filePath);
    this._symbolIndex.addBatch(symbols);
  }

  /** Add a dependency edge between files. */
  addDependency(dep: RepoDependency): void {
    this._dependencies.push(dep);
  }

  /** Add multiple dependency edges. */
  addDependencies(deps: RepoDependency[]): void {
    for (const d of deps) {
      this.addDependency(d);
    }
  }

  /** Mark a file as recently active (open, edited). Used for priority boosting. */
  markActive(filePath: string, timestamp = Date.now()): void {
    this._activeFiles.set(filePath, timestamp);
  }

  /** Remove a file and its symbols/dependencies. */
  removeFile(filePath: string): void {
    this._files.delete(filePath);
    this._symbolIndex.removeFile(filePath);
    this._dependencies = this._dependencies.filter(
      (d) => d.from !== filePath && d.to !== filePath,
    );
    this._activeFiles.delete(filePath);
  }

  /**
   * Build the final RepositoryMap with PageRank scores.
   *
   * @param activeBoostFactor - Multiplier for recently-active files (default 2.0)
   * @param activeWindowMs - How far back "recently active" reaches (default 30 min)
   */
  build(activeBoostFactor = 2.0, activeWindowMs = 30 * 60 * 1000): RepositoryMap {
    const filePaths = [...this._files.keys()];

    // Build edges for PageRank: dependency from → to
    const edges: Array<[string, string]> = this._dependencies
      .filter((d) => this._files.has(d.from) && this._files.has(d.to))
      .map((d) => [d.from, d.to]);

    // Compute base PageRank
    const ranks = computePageRank(filePaths, edges);

    // Apply active-file boost
    const now = Date.now();
    const boosted = new Map<string, number>();
    for (const [path, rank] of ranks) {
      const activeAt = this._activeFiles.get(path);
      if (activeAt && now - activeAt < activeWindowMs) {
        boosted.set(path, rank * activeBoostFactor);
      } else {
        boosted.set(path, rank);
      }
    }

    // Normalize scores to sum to 1
    const total = [...boosted.values()].reduce((a, b) => a + b, 0);
    const files: RepoFileEntry[] = filePaths.map((path) => ({
      ...this._files.get(path)!,
      pageRank: total > 0 ? (boosted.get(path) ?? 0) / total : 0,
    }));

    // Sort by pageRank descending
    files.sort((a, b) => b.pageRank - a.pageRank);

    return {
      rootPath: this._rootPath,
      files,
      symbols: [...this._symbolIndex.getExported()],
      dependencies: [...this._dependencies],
      builtAt: now,
    };
  }

  /** Get top-N files by importance after building. */
  getTopFiles(n: number): RepoFileEntry[] {
    const map = this.build();
    return map.files.slice(0, n);
  }

  /** Number of tracked files. */
  get fileCount(): number {
    return this._files.size;
  }

  /** Number of dependency edges. */
  get dependencyCount(): number {
    return this._dependencies.length;
  }

  /** Clear everything. */
  clear(): void {
    this._files.clear();
    this._symbolIndex.clear();
    this._dependencies = [];
    this._activeFiles.clear();
  }
}
