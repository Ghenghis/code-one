/**
 * Logging type contracts.
 *
 * Structured logging with named loggers, log levels, and pluggable outputs.
 */

// ---------------------------------------------------------------------------
// Log levels
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ---------------------------------------------------------------------------
// Log entry
// ---------------------------------------------------------------------------

export interface LogEntry {
  /** Timestamp (Unix epoch ms) */
  timestamp: number;
  /** Log level */
  level: LogLevel;
  /** Logger name (typically module ID) */
  logger: string;
  /** Log message */
  message: string;
  /** Structured data */
  data?: Record<string, unknown>;
  /** Error if applicable */
  error?: { message: string; stack?: string };
}

// ---------------------------------------------------------------------------
// Logger interface
// ---------------------------------------------------------------------------

export interface ILogger {
  /** Logger name */
  readonly name: string;
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: unknown, data?: Record<string, unknown>): void;
  /** Create a child logger with a sub-name */
  child(name: string): ILogger;
}

// ---------------------------------------------------------------------------
// Log output target
// ---------------------------------------------------------------------------

export interface LogOutput {
  /** Write a log entry to this output */
  write(entry: LogEntry): void;
}

// ---------------------------------------------------------------------------
// LoggerFactory interface
// ---------------------------------------------------------------------------

export interface ILoggerFactory {
  /** Create a named logger */
  createLogger(name: string): ILogger;
  /** Set the minimum log level */
  setLevel(level: LogLevel): void;
  /** Get the current log level */
  getLevel(): LogLevel;
  /** Add an output target */
  addOutput(output: LogOutput): void;
  /** Get recent log entries */
  getEntries(count?: number): ReadonlyArray<LogEntry>;
}
