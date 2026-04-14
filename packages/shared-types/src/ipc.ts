/**
 * IPC type contracts.
 *
 * Typed messages between Electron main process and renderer process.
 * All IPC channels are explicitly registered — no dynamic channel creation.
 */

// ---------------------------------------------------------------------------
// IPC message shapes
// ---------------------------------------------------------------------------

export interface IPCRequest<T = unknown> {
  /** Channel name in format "{module}:{action}" */
  channel: string;
  /** Correlation ID for request/response matching */
  id: string;
  /** Payload data */
  payload: T;
}

export interface IPCResponse<T = unknown> {
  /** Channel name matching the request */
  channel: string;
  /** Matches request ID */
  id: string;
  /** Response payload (present on success) */
  payload?: T;
  /** Error details (present on failure) */
  error?: IPCError;
}

export interface IPCEvent<T = unknown> {
  /** Channel name */
  channel: string;
  /** Event payload */
  payload: T;
}

export interface IPCError {
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// IPC channel registry
// ---------------------------------------------------------------------------

export interface IPCChannelDescriptor {
  /** Channel name */
  channel: string;
  /** Direction of communication */
  direction: "main-to-renderer" | "renderer-to-main" | "bidirectional";
  /** Human-readable description */
  description: string;
  /** Module that owns this channel */
  module: string;
}

// ---------------------------------------------------------------------------
// IPC handler types
// ---------------------------------------------------------------------------

export type IPCHandler<TReq = unknown, TRes = unknown> = (
  request: IPCRequest<TReq>,
) => Promise<TRes> | TRes;

export type IPCEventHandler<T = unknown> = (event: IPCEvent<T>) => void;
