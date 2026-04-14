import { describe, it, expect, vi } from "vitest";
import { LoggerFactory } from "./logger.js";
import type { LogOutput } from "@code-one/shared-types";

describe("LoggerFactory", () => {
  it("creates named loggers", () => {
    const factory = new LoggerFactory();
    const logger = factory.createLogger("test");
    expect(logger.name).toBe("test");
  });

  it("creates child loggers with composite names", () => {
    const factory = new LoggerFactory();
    const parent = factory.createLogger("module");
    const child = parent.child("sub");
    expect(child.name).toBe("module:sub");
  });

  it("filters by log level", () => {
    const factory = new LoggerFactory();
    factory.clearOutputs();

    const output: LogOutput = { write: vi.fn() };
    factory.addOutput(output);
    factory.setLevel("warn");

    const logger = factory.createLogger("test");
    logger.debug("ignored");
    logger.info("ignored");
    logger.warn("shown");
    logger.error("shown");

    expect(output.write).toHaveBeenCalledTimes(2);
  });

  it("retains log entries", () => {
    const factory = new LoggerFactory();
    factory.clearOutputs();

    const logger = factory.createLogger("test");
    logger.info("one");
    logger.info("two");
    logger.info("three");

    expect(factory.getEntries()).toHaveLength(3);
    expect(factory.getEntries(2)).toHaveLength(2);
    expect(factory.getEntries(2)[0].message).toBe("two");
  });

  it("routes entries to all outputs", () => {
    const factory = new LoggerFactory();
    factory.clearOutputs();

    const out1: LogOutput = { write: vi.fn() };
    const out2: LogOutput = { write: vi.fn() };
    factory.addOutput(out1);
    factory.addOutput(out2);

    const logger = factory.createLogger("test");
    logger.info("hello");

    expect(out1.write).toHaveBeenCalledTimes(1);
    expect(out2.write).toHaveBeenCalledTimes(1);
  });

  it("captures error details", () => {
    const factory = new LoggerFactory();
    factory.clearOutputs();

    const output: LogOutput = { write: vi.fn() };
    factory.addOutput(output);

    const logger = factory.createLogger("test");
    logger.error("failed", new Error("boom"), { context: "test" });

    const entry = (output.write as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(entry.error?.message).toBe("boom");
    expect(entry.error?.stack).toBeDefined();
    expect(entry.data?.context).toBe("test");
  });

  it("handles non-Error error values", () => {
    const factory = new LoggerFactory();
    factory.clearOutputs();

    const output: LogOutput = { write: vi.fn() };
    factory.addOutput(output);

    const logger = factory.createLogger("test");
    logger.error("failed", "string error");

    const entry = (output.write as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(entry.error?.message).toBe("string error");
  });

  it("getLevel returns current level", () => {
    const factory = new LoggerFactory();
    expect(factory.getLevel()).toBe("info");

    factory.setLevel("debug");
    expect(factory.getLevel()).toBe("debug");
  });

  it("output errors do not crash the logger", () => {
    const factory = new LoggerFactory();
    factory.clearOutputs();

    const badOutput: LogOutput = {
      write: () => {
        throw new Error("output crash");
      },
    };
    const goodOutput: LogOutput = { write: vi.fn() };
    factory.addOutput(badOutput);
    factory.addOutput(goodOutput);

    const logger = factory.createLogger("test");
    logger.info("should not crash");

    expect(goodOutput.write).toHaveBeenCalledTimes(1);
  });

  it("resetOutputs restores console output", () => {
    const factory = new LoggerFactory();
    factory.clearOutputs();
    factory.resetOutputs();

    // Just verify it doesn't crash when logging
    const logger = factory.createLogger("test");
    logger.info("after reset");
  });
});
