import { describe, it, expect } from "vitest";
import { CheckpointManager } from "./checkpoint.js";

describe("CheckpointManager", () => {
  it("starts empty", () => {
    const mgr = new CheckpointManager();
    expect(mgr.size).toBe(0);
  });

  describe("create", () => {
    it("creates a checkpoint with deep-cloned state", () => {
      const mgr = new CheckpointManager();
      const state = { count: 1, items: ["a"] };
      const ckpt = mgr.create("s1", 1, state);

      expect(ckpt.id).toMatch(/^ckpt_/);
      expect(ckpt.sessionId).toBe("s1");
      expect(ckpt.stepNumber).toBe(1);
      expect(ckpt.state).toEqual(state);
      expect(ckpt.trigger).toBe("auto");

      // Verify deep clone — mutating original doesn't affect checkpoint
      state.count = 999;
      (state.items as string[]).push("b");
      expect(ckpt.state).toEqual({ count: 1, items: ["a"] });
    });

    it("assigns unique IDs", () => {
      const mgr = new CheckpointManager();
      const c1 = mgr.create("s1", 1, {});
      const c2 = mgr.create("s1", 2, {});
      expect(c1.id).not.toBe(c2.id);
    });

    it("stores label and trigger", () => {
      const mgr = new CheckpointManager();
      const ckpt = mgr.create("s1", 5, {}, "user", "before refactor");
      expect(ckpt.trigger).toBe("user");
      expect(ckpt.label).toBe("before refactor");
    });
  });

  describe("get", () => {
    it("retrieves a checkpoint by ID", () => {
      const mgr = new CheckpointManager();
      const ckpt = mgr.create("s1", 1, { v: 1 });
      expect(mgr.get(ckpt.id)).toEqual(ckpt);
    });

    it("returns undefined for unknown ID", () => {
      const mgr = new CheckpointManager();
      expect(mgr.get("nope")).toBeUndefined();
    });
  });

  describe("getLatest", () => {
    it("returns the most recent checkpoint for a session", () => {
      const mgr = new CheckpointManager();
      mgr.create("s1", 1, { v: 1 });
      mgr.create("s1", 2, { v: 2 });
      mgr.create("s2", 1, { v: 10 });

      const latest = mgr.getLatest("s1");
      expect(latest).toBeDefined();
      expect(latest!.stepNumber).toBe(2);
      expect(latest!.state).toEqual({ v: 2 });
    });

    it("returns undefined when no checkpoints exist", () => {
      const mgr = new CheckpointManager();
      expect(mgr.getLatest("s1")).toBeUndefined();
    });
  });

  describe("listForSession", () => {
    it("lists all checkpoints for a session", () => {
      const mgr = new CheckpointManager();
      mgr.create("s1", 1, {});
      mgr.create("s1", 2, {});
      mgr.create("s2", 1, {});

      expect(mgr.listForSession("s1")).toHaveLength(2);
      expect(mgr.listForSession("s2")).toHaveLength(1);
      expect(mgr.listForSession("s3")).toHaveLength(0);
    });
  });

  describe("restore", () => {
    it("returns a deep clone of checkpoint state", () => {
      const mgr = new CheckpointManager();
      const ckpt = mgr.create("s1", 1, { count: 42, list: [1, 2, 3] });

      const restored = mgr.restore(ckpt.id);
      expect(restored).toEqual({ count: 42, list: [1, 2, 3] });

      // Verify it's a clone — mutating restored doesn't affect checkpoint
      restored!.count = 999;
      expect(mgr.get(ckpt.id)!.state.count).toBe(42);
    });

    it("returns undefined for unknown checkpoint", () => {
      const mgr = new CheckpointManager();
      expect(mgr.restore("nope")).toBeUndefined();
    });
  });

  describe("restoreLatest", () => {
    it("returns latest checkpoint and cloned state", () => {
      const mgr = new CheckpointManager();
      mgr.create("s1", 1, { v: 1 });
      mgr.create("s1", 2, { v: 2 });

      const result = mgr.restoreLatest("s1");
      expect(result).toBeDefined();
      expect(result!.checkpoint.stepNumber).toBe(2);
      expect(result!.state).toEqual({ v: 2 });
    });

    it("returns undefined when no checkpoints", () => {
      const mgr = new CheckpointManager();
      expect(mgr.restoreLatest("s1")).toBeUndefined();
    });
  });

  describe("pruneOlderThan", () => {
    it("removes checkpoints older than the given one", () => {
      const mgr = new CheckpointManager();
      mgr.create("s1", 1, {});
      mgr.create("s1", 2, {});
      const c3 = mgr.create("s1", 3, {});
      mgr.create("s1", 4, {});

      const pruned = mgr.pruneOlderThan(c3.id);
      expect(pruned).toBe(2);
      expect(mgr.size).toBe(2); // c3 and c4 remain
    });

    it("returns 0 when checkpoint not found", () => {
      const mgr = new CheckpointManager();
      expect(mgr.pruneOlderThan("nope")).toBe(0);
    });
  });

  describe("clear", () => {
    it("removes all checkpoints", () => {
      const mgr = new CheckpointManager();
      mgr.create("s1", 1, {});
      mgr.create("s1", 2, {});
      mgr.clear();
      expect(mgr.size).toBe(0);
    });
  });
});
