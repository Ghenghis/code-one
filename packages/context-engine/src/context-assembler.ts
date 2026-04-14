import type {
  RepositoryMap,
  RepoFileEntry,
  MemoryEntry,
} from "@code-one/shared-types";

// ---------------------------------------------------------------------------
// Context item types
// ---------------------------------------------------------------------------

export type ContextItemKind =
  | "file"          // Full or partial file content
  | "symbol"        // Symbol definition
  | "memory"        // Memory entry
  | "diagnostic"    // LSP diagnostic
  | "user-message"  // User's chat message
  | "system";       // System instruction

export interface ContextItem {
  kind: ContextItemKind;
  /** Source identifier (file path, memory key, etc.) */
  source: string;
  /** The text content */
  content: string;
  /** Relevance score 0-1 (higher = more relevant) */
  relevance: number;
  /** Estimated token count */
  tokenEstimate: number;
  /** Metadata for downstream consumers */
  metadata?: Record<string, unknown>;
}

export interface AssembledContext {
  /** Ordered context items, most relevant first */
  items: ContextItem[];
  /** Total estimated tokens */
  totalTokens: number;
  /** Token budget that was targeted */
  budgetTokens: number;
  /** Number of items that were dropped to fit budget */
  droppedCount: number;
  /** Assembly timestamp */
  assembledAt: number;
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Rough token estimate: ~4 characters per token for English text.
 * Good enough for budget decisions; exact counting needs a tokenizer.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Context assembler
// ---------------------------------------------------------------------------

export interface AssemblerOptions {
  /** Maximum tokens for the assembled context. */
  budgetTokens: number;
  /** Reserved tokens for system prompt + user message. Default 500. */
  reservedTokens?: number;
  /** Maximum number of file context items. Default 20. */
  maxFiles?: number;
  /** Maximum number of memory items. Default 10. */
  maxMemory?: number;
}

/**
 * Assembles context from multiple sources within a token budget.
 *
 * Priority order:
 * 1. System instructions (always included)
 * 2. User message (always included)
 * 3. Diagnostics (errors relevant to current work)
 * 4. Active/open file contents
 * 5. Memory entries
 * 6. Repo map files by PageRank
 *
 * Each category is scored and items are ranked. The assembler fills the
 * budget greedily from highest-scored items, then truncates the last
 * item if it exceeds the remaining budget.
 */
export class ContextAssembler {
  private _options: Required<AssemblerOptions>;

  constructor(options: AssemblerOptions) {
    this._options = {
      reservedTokens: 500,
      maxFiles: 20,
      maxMemory: 10,
      ...options,
    };
  }

  /**
   * Assemble context from provided items.
   *
   * Items should be pre-scored with relevance. The assembler sorts by
   * relevance, then fills the budget greedily.
   */
  assemble(items: ContextItem[]): AssembledContext {
    const budget = this._options.budgetTokens - this._options.reservedTokens;

    // Sort by relevance descending
    const sorted = [...items].sort((a, b) => b.relevance - a.relevance);

    const included: ContextItem[] = [];
    let totalTokens = 0;
    let droppedCount = 0;

    // Count limits per kind
    let fileCount = 0;
    let memoryCount = 0;

    for (const item of sorted) {
      // Enforce per-kind limits
      if (item.kind === "file" && fileCount >= this._options.maxFiles) {
        droppedCount++;
        continue;
      }
      if (item.kind === "memory" && memoryCount >= this._options.maxMemory) {
        droppedCount++;
        continue;
      }

      if (totalTokens + item.tokenEstimate <= budget) {
        included.push(item);
        totalTokens += item.tokenEstimate;
        if (item.kind === "file") fileCount++;
        if (item.kind === "memory") memoryCount++;
      } else {
        // Try to fit a truncated version
        const remaining = budget - totalTokens;
        if (remaining > 50 && item.content.length > 0) {
          const truncatedContent = this._truncate(item.content, remaining);
          const truncatedTokens = estimateTokens(truncatedContent);
          included.push({
            ...item,
            content: truncatedContent,
            tokenEstimate: truncatedTokens,
            metadata: { ...item.metadata, truncated: true },
          });
          totalTokens += truncatedTokens;
          if (item.kind === "file") fileCount++;
          if (item.kind === "memory") memoryCount++;
        } else {
          droppedCount++;
        }
      }
    }

    return {
      items: included,
      totalTokens,
      budgetTokens: this._options.budgetTokens,
      droppedCount,
      assembledAt: Date.now(),
    };
  }

  /**
   * Build context items from a RepositoryMap.
   *
   * Uses PageRank scores as relevance. Generates a summary string for
   * each file (path, line count, top symbols).
   */
  contextFromRepoMap(
    repoMap: RepositoryMap,
    fileContents?: Map<string, string>,
  ): ContextItem[] {
    const items: ContextItem[] = [];

    for (const file of repoMap.files) {
      const content = fileContents?.get(file.path);
      if (content) {
        items.push({
          kind: "file",
          source: file.path,
          content,
          relevance: file.pageRank,
          tokenEstimate: estimateTokens(content),
        });
      } else {
        // File summary without content
        const symbols = repoMap.symbols
          .filter((s) => s.filePath === file.path)
          .map((s) => `${s.kind} ${s.name}`)
          .join(", ");

        const summary = `${file.path} (${file.language}, ${file.lineCount} lines)${symbols ? `: ${symbols}` : ""}`;
        items.push({
          kind: "file",
          source: file.path,
          content: summary,
          relevance: file.pageRank * 0.5, // summaries are less relevant than full content
          tokenEstimate: estimateTokens(summary),
        });
      }
    }

    return items;
  }

  /**
   * Build context items from memory entries.
   */
  contextFromMemory(entries: MemoryEntry[]): ContextItem[] {
    return entries.map((e) => {
      const content = typeof e.value === "string"
        ? e.value
        : JSON.stringify(e.value);

      // Recency boost: newer entries score higher
      const ageMs = Date.now() - e.updatedAt;
      const recencyScore = Math.max(0, 1 - ageMs / (24 * 60 * 60 * 1000)); // decays over 24h

      return {
        kind: "memory" as const,
        source: `${e.scope}/${e.namespace}/${e.key}`,
        content: `[${e.namespace}] ${e.key}: ${content}`,
        relevance: 0.5 + recencyScore * 0.3, // 0.5-0.8 range
        tokenEstimate: estimateTokens(content),
        metadata: { scope: e.scope, namespace: e.namespace },
      };
    });
  }

  /**
   * Build a diagnostic context item.
   */
  contextFromDiagnostics(
    diagnostics: Array<{ file: string; line: number; message: string; severity: string }>,
  ): ContextItem[] {
    if (diagnostics.length === 0) return [];

    const content = diagnostics
      .map((d) => `${d.file}:${d.line} [${d.severity}] ${d.message}`)
      .join("\n");

    return [{
      kind: "diagnostic",
      source: "diagnostics",
      content,
      relevance: 0.9, // diagnostics are high priority
      tokenEstimate: estimateTokens(content),
    }];
  }

  // -- private ---------------------------------------------------------------

  private _truncate(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 12) + "\n... truncated";
  }
}
