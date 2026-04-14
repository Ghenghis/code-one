import type {
  ILogger,
  ILoggerFactory,
  LogEntry,
  LogLevel,
  LogOutput,
} from "@code-one/shared-types";

// Re-import the constant for runtime use
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Structured logger implementation.
 *
 * Named loggers per module, configurable log level, pluggable outputs.
 * Default output is console; additional outputs (file, IPC to renderer)
 * can be added via the LoggerFactory.
 */
class Logger implements ILogger {
  constructor(
    public readonly name: string,
    private factory: LoggerFactory,
  ) {}

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  error(
    message: string,
    error?: unknown,
    data?: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: "error",
      logger: this.name,
      message,
      data,
    };
    if (error instanceof Error) {
      entry.error = { message: error.message, stack: error.stack };
    } else if (error !== undefined) {
      entry.error = { message: String(error) };
    }
    this.factory.write(entry);
  }

  child(name: string): ILogger {
    return new Logger(`${this.name}:${name}`, this.factory);
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    this.factory.write({
      timestamp: Date.now(),
      level,
      logger: this.name,
      message,
      data,
    });
  }
}

/**
 * Console output target — the default.
 */
class ConsoleOutput implements LogOutput {
  write(entry: LogEntry): void {
    const prefix = `[${entry.level.toUpperCase()}] [${entry.logger}]`;
    const msg = `${prefix} ${entry.message}`;
    switch (entry.level) {
      case "debug":
        console.debug(msg, entry.data ?? "");
        break;
      case "info":
        console.info(msg, entry.data ?? "");
        break;
      case "warn":
        console.warn(msg, entry.data ?? "");
        break;
      case "error":
        console.error(msg, entry.error ?? "", entry.data ?? "");
        break;
    }
  }
}

/**
 * Logger factory. Creates named loggers and routes entries to outputs.
 */
export class LoggerFactory implements ILoggerFactory {
  private level: LogLevel = "info";
  private outputs: LogOutput[] = [new ConsoleOutput()];
  private entries: LogEntry[] = [];
  private maxEntries = 10_000;

  createLogger(name: string): ILogger {
    return new Logger(name, this);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  addOutput(output: LogOutput): void {
    this.outputs.push(output);
  }

  getEntries(count?: number): ReadonlyArray<LogEntry> {
    if (count === undefined) return [...this.entries];
    return this.entries.slice(-count);
  }

  /** Called internally by Logger instances */
  write(entry: LogEntry): void {
    if (LEVEL_PRIORITY[entry.level] < LEVEL_PRIORITY[this.level]) {
      return;
    }

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    for (const output of this.outputs) {
      try {
        output.write(entry);
      } catch {
        // Output failures must not crash the logger.
      }
    }
  }

  /** Remove all outputs (useful for testing) */
  clearOutputs(): void {
    this.outputs = [];
  }

  /** Reset to default console output */
  resetOutputs(): void {
    this.outputs = [new ConsoleOutput()];
  }
}
