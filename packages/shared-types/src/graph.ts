/**
 * Task graph and agent state type contracts (Tier 4).
 *
 * Based on LangGraph patterns:
 * - Graph-based task orchestration with typed nodes
 * - Checkpoint/restore for interrupt and resume
 * - Reducer-based state management
 */

// ---------------------------------------------------------------------------
// Graph structure
// ---------------------------------------------------------------------------

export type NodeId = string;
export type EdgeId = string;

export type NodeKind =
  | "planner"
  | "executor"
  | "reviewer"
  | "validator"
  | "human-gate"
  | "router"
  | "subgraph"
  | "custom";

export interface GraphNode {
  id: NodeId;
  kind: NodeKind;
  /** Human-readable label */
  label: string;
  /** Function or handler reference */
  handler: string;
  /** Static config for this node */
  config: Record<string, unknown>;
  /** Retry policy */
  retry: RetryPolicy;
}

export interface GraphEdge {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  /** Condition that must be true for this edge to activate */
  condition?: EdgeCondition;
}

export type EdgeCondition =
  | { type: "always" }
  | { type: "state-match"; path: string; value: unknown }
  | { type: "custom"; handler: string };

export interface TaskGraph {
  id: string;
  /** Human-readable name */
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Entry node ID */
  entryNode: NodeId;
  /** Terminal node IDs (reaching any = graph complete) */
  terminalNodes: NodeId[];
}

// ---------------------------------------------------------------------------
// Graph state (reducer pattern)
// ---------------------------------------------------------------------------

export interface GraphState {
  /** Current state data (reducer-managed) */
  data: Record<string, unknown>;
  /** Currently active node(s) */
  activeNodes: NodeId[];
  /** Nodes that have completed */
  completedNodes: NodeId[];
  /** Nodes that have failed */
  failedNodes: NodeId[];
  /** Whether the graph is paused at a human gate */
  interrupted: boolean;
  /** History of state transitions */
  transitions: StateTransition[];
}

export interface StateTransition {
  fromNode: NodeId;
  toNode: NodeId;
  timestamp: number;
  /** State snapshot before transition */
  stateBefore: Record<string, unknown>;
  /** Reducer that produced this transition */
  reducer: string;
}

export type StateReducer = (
  current: Record<string, unknown>,
  update: Record<string, unknown>,
) => Record<string, unknown>;

// ---------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------

export interface Checkpoint {
  id: string;
  graphId: string;
  /** Full graph state at checkpoint time */
  state: GraphState;
  /** Timestamp */
  createdAt: number;
  /** Human-readable label */
  label?: string;
  /** Whether this was auto-created or user-requested */
  trigger: "auto" | "user" | "interrupt";
}

// ---------------------------------------------------------------------------
// Retry and failure
// ---------------------------------------------------------------------------

export interface RetryPolicy {
  maxRetries: number;
  /** Base delay in ms (exponential backoff) */
  baseDelayMs: number;
  /** Max delay in ms */
  maxDelayMs: number;
  /** Which errors are retryable */
  retryOn: "all" | "transient" | "none";
}

// ---------------------------------------------------------------------------
// Repository map (Tier 3 — co-located for cross-tier use)
// ---------------------------------------------------------------------------

export interface RepositoryMap {
  /** Root path of the repository */
  rootPath: string;
  /** File entries with metadata */
  files: RepoFileEntry[];
  /** Symbol index (functions, classes, exports) */
  symbols: RepoSymbol[];
  /** Dependency edges between files */
  dependencies: RepoDependency[];
  /** When this map was last built */
  builtAt: number;
}

export interface RepoFileEntry {
  /** Relative path from repo root */
  path: string;
  /** Language identifier */
  language: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Number of lines */
  lineCount: number;
  /** PageRank score (importance in the codebase graph) */
  pageRank: number;
  /** Last modified timestamp */
  modifiedAt: number;
}

export interface RepoSymbol {
  /** Symbol name */
  name: string;
  /** Kind: function, class, interface, type, variable, export */
  kind: "function" | "class" | "interface" | "type" | "variable" | "export";
  /** File containing this symbol */
  filePath: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** Exported from module? */
  exported: boolean;
}

export interface RepoDependency {
  /** Importing file */
  from: string;
  /** Imported file */
  to: string;
  /** Import kind */
  kind: "static" | "dynamic" | "type-only" | "re-export";
}

// ---------------------------------------------------------------------------
// Memory store (Tier 3)
// ---------------------------------------------------------------------------

// MemoryScope is defined in events.ts: "turn" | "session" | "project" | "user"
// Re-use that type rather than redefining it here.
import type { MemoryScope } from "./events.js";

export interface MemoryEntry {
  id: string;
  scope: MemoryScope;
  /** Namespace for grouping (e.g. "decisions", "context", "preferences") */
  namespace: string;
  key: string;
  value: unknown;
  /** Embedding vector for semantic search (optional) */
  embedding?: number[];
  createdAt: number;
  updatedAt: number;
  /** Who created this entry */
  source: "user" | "agent" | "system";
  /** TTL in seconds (0 = permanent) */
  ttlSeconds: number;
}

export interface MemoryStore {
  get(scope: MemoryScope, namespace: string, key: string): Promise<MemoryEntry | undefined>;
  set(entry: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">): Promise<MemoryEntry>;
  delete(scope: MemoryScope, namespace: string, key: string): Promise<boolean>;
  list(scope: MemoryScope, namespace?: string): Promise<MemoryEntry[]>;
  search(scope: MemoryScope, query: string, limit?: number): Promise<MemoryEntry[]>;
  clear(scope: MemoryScope): Promise<void>;
}
