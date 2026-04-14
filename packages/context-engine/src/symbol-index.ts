import type { RepoSymbol } from "@code-one/shared-types";

/**
 * In-memory symbol index.
 *
 * Stores parsed symbols (functions, classes, interfaces, etc.) with
 * file location and kind. Supports efficient lookups by name, file,
 * kind, and prefix search for autocomplete-style queries.
 */
export class SymbolIndex {
  private _symbols: RepoSymbol[] = [];
  /** file → symbols for fast per-file lookup */
  private _byFile = new Map<string, RepoSymbol[]>();
  /** name → symbols for fast name lookup */
  private _byName = new Map<string, RepoSymbol[]>();

  /** Add a symbol to the index. */
  add(symbol: RepoSymbol): void {
    this._symbols.push(symbol);

    const byFile = this._byFile.get(symbol.filePath);
    if (byFile) {
      byFile.push(symbol);
    } else {
      this._byFile.set(symbol.filePath, [symbol]);
    }

    const byName = this._byName.get(symbol.name);
    if (byName) {
      byName.push(symbol);
    } else {
      this._byName.set(symbol.name, [symbol]);
    }
  }

  /** Add multiple symbols at once. */
  addBatch(symbols: RepoSymbol[]): void {
    for (const s of symbols) {
      this.add(s);
    }
  }

  /** Remove all symbols for a given file (e.g., on re-parse). */
  removeFile(filePath: string): number {
    const fileSymbols = this._byFile.get(filePath);
    if (!fileSymbols) return 0;

    const removed = fileSymbols.length;

    // Remove from name index
    for (const sym of fileSymbols) {
      const nameList = this._byName.get(sym.name);
      if (nameList) {
        const filtered = nameList.filter((s) => s.filePath !== filePath);
        if (filtered.length === 0) {
          this._byName.delete(sym.name);
        } else {
          this._byName.set(sym.name, filtered);
        }
      }
    }

    // Remove from flat list
    this._symbols = this._symbols.filter((s) => s.filePath !== filePath);

    // Remove from file index
    this._byFile.delete(filePath);

    return removed;
  }

  /** Look up symbols by exact name. */
  getByName(name: string): ReadonlyArray<RepoSymbol> {
    return this._byName.get(name) ?? [];
  }

  /** Look up all symbols in a file. */
  getByFile(filePath: string): ReadonlyArray<RepoSymbol> {
    return this._byFile.get(filePath) ?? [];
  }

  /** Look up symbols by kind. */
  getByKind(kind: RepoSymbol["kind"]): ReadonlyArray<RepoSymbol> {
    return this._symbols.filter((s) => s.kind === kind);
  }

  /** Prefix search for symbol names (case-insensitive). */
  searchByPrefix(prefix: string, limit = 50): ReadonlyArray<RepoSymbol> {
    const lower = prefix.toLowerCase();
    const results: RepoSymbol[] = [];
    for (const sym of this._symbols) {
      if (sym.name.toLowerCase().startsWith(lower)) {
        results.push(sym);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  /** Fuzzy search matching any substring (case-insensitive). */
  search(query: string, limit = 50): ReadonlyArray<RepoSymbol> {
    const lower = query.toLowerCase();
    const results: RepoSymbol[] = [];
    for (const sym of this._symbols) {
      if (sym.name.toLowerCase().includes(lower)) {
        results.push(sym);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  /** Get all exported symbols. */
  getExported(): ReadonlyArray<RepoSymbol> {
    return this._symbols.filter((s) => s.exported);
  }

  /** List all indexed files. */
  getFiles(): ReadonlyArray<string> {
    return [...this._byFile.keys()];
  }

  /** Total number of symbols. */
  get size(): number {
    return this._symbols.length;
  }

  /** Number of indexed files. */
  get fileCount(): number {
    return this._byFile.size;
  }

  /** Clear the entire index. */
  clear(): void {
    this._symbols = [];
    this._byFile.clear();
    this._byName.clear();
  }
}
