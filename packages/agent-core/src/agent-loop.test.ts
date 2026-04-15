import { describe, it, expect, vi } from "vitest";
import { AgentLoop, type AgentHandlers, type AgentState } from "./agent-loop.js";
import { EventStream } from "./event-stream.js";
import { CheckpointManager } from "./checkpoint.js";

function makeHandlers(overrides?: Partial<AgentHandlers>): AgentHandlers {
  let callCount = 0;
  return {
    plan: vi.fn(async () => {
      callCount++;
      if (callCount > 3) return null; // stop after 3 steps
      return { action: `action_${callCount}`, args: { step: callCount } };
    }),
    act: vi.fn(async (_state, _action, _args) => ({
      result: "ok",
      success: true,
    })),
    observe: vi.fn(async () => {}),
    decide: vi.fn(async () => "continue" as const),
    ...overrides,
  };
}

describe("AgentLoop", () => {
  describe("initialization", () => {
    it("starts in idle phase", () => {
      const loop = new AgentLoop({ sessionId: "s1", modeId: "code" }, makeHandlers());
      expect(loop.state.phase).toBe("idle");
      expect(loop.state.stepCount).toBe(0);
      expect(loop.state.modeId).toBe("code");
    });
  });

  describe("run()", () => {
    it("completes after plan returns null", async () => {
      const handlers = makeHandlers({
        plan: vi.fn(async () => null),
      });

      const loop = new AgentLoop({ sessionId: "s1", modeId: "code" }, handlers);

      const result = await loop.run();
      expect(result.phase).toBe("completed");
      expect(result.stepCount).toBe(0);
    });

    it("runs plan-act-observe-decide cycle", async () => {
      const handlers = makeHandlers();
      const loop = new AgentLoop({ sessionId: "s1", modeId: "code" }, handlers);

      const result = await loop.run();

      expect(result.phase).toBe("completed");
      expect(result.stepCount).toBe(3);
      expect(handlers.plan).toHaveBeenCalledTimes(4); // 3 actions + 1 null return
      expect(handlers.act).toHaveBeenCalledTimes(3);
      expect(handlers.observe).toHaveBeenCalledTimes(3);
      expect(handlers.decide).toHaveBeenCalledTimes(3);
    });

    it("stops on 'complete' decision", async () => {
      let stepCount = 0;
      const handlers = makeHandlers({
        plan: vi.fn(async () => ({ action: "test", args: {} })),
        decide: vi.fn(async () => {
          stepCount++;
          return stepCount >= 2 ? "complete" : "continue";
        }),
      });

      const loop = new AgentLoop({ sessionId: "s1", modeId: "code" }, handlers);

      const result = await loop.run();
      expect(result.phase).toBe("completed");
      expect(result.stepCount).toBe(2);
    });

    it("stops on 'fail' decision", async () => {
      const handlers = makeHandlers({
        plan: vi.fn(async () => ({ action: "test", args: {} })),
        decide: vi.fn(async () => "fail" as const),
      });

      const loop = new AgentLoop({ sessionId: "s1", modeId: "code" }, handlers);

      const result = await loop.run();
      expect(result.phase).toBe("failed");
    });

    it("pauses on 'pause' decision", async () => {
      const handlers = makeHandlers({
        plan: vi.fn(async () => ({ action: "test", args: {} })),
        decide: vi.fn(async () => "pause" as const),
      });

      const loop = new AgentLoop({ sessionId: "s1", modeId: "code" }, handlers);

      const result = await loop.run();
      expect(result.phase).toBe("paused");
    });

    it("fails on max steps exceeded", async () => {
      const handlers = makeHandlers({
        plan: vi.fn(async () => ({ action: "test", args: {} })),
        decide: vi.fn(async () => "continue" as const),
      });

      const loop = new AgentLoop({ sessionId: "s1", modeId: "code", maxSteps: 3 }, handlers);

      const result = await loop.run();
      expect(result.phase).toBe("failed");
      expect(result.stepCount).toBe(3);
    });

    it("records events during execution", async () => {
      const events = new EventStream();
      const handlers = makeHandlers();
      const loop = new AgentLoop({ sessionId: "s1", modeId: "code" }, handlers, events);

      await loop.run();

      const toolCalls = events.getEvents("tool:call");
      expect(toolCalls.length).toBe(3);
    });
  });

  describe("pause/resume", () => {
    it("can resume from paused state", async () => {
      let step = 0;
      const handlers = makeHandlers({
        plan: vi.fn(async () => {
          step++;
          return step > 2 ? null : { action: "test", args: {} };
        }),
        decide: vi.fn(async (state: AgentState) => {
          return state.stepCount === 1 ? "pause" : "continue";
        }),
      });

      const loop = new AgentLoop({ sessionId: "s1", modeId: "code" }, handlers);

      // First run — pauses after step 1
      const paused = await loop.run();
      expect(paused.phase).toBe("paused");
      expect(paused.stepCount).toBe(1);

      // Resume — completes after step 2
      const completed = await loop.resume();
      expect(completed.phase).toBe("completed");
      expect(completed.stepCount).toBe(2);
    });

    it("throws when resuming from non-paused state", async () => {
      const loop = new AgentLoop({ sessionId: "s1", modeId: "code" }, makeHandlers());

      await expect(loop.resume()).rejects.toThrow("Cannot resume");
    });
  });

  describe("checkpoints", () => {
    it("auto-checkpoints every 5 steps", async () => {
      let step = 0;
      const handlers = makeHandlers({
        plan: vi.fn(async () => {
          step++;
          return step > 6 ? null : { action: "test", args: {} };
        }),
        decide: vi.fn(async () => "continue" as const),
      });

      const checkpoints = new CheckpointManager();
      const loop = new AgentLoop(
        { sessionId: "s1", modeId: "code" },
        handlers,
        undefined,
        checkpoints,
      );

      await loop.run();

      // Step 5 triggers auto-checkpoint
      const ckpts = checkpoints.listForSession("s1");
      expect(ckpts.length).toBeGreaterThanOrEqual(1);
      expect(ckpts[0].trigger).toBe("auto");
    });

    it("creates interrupt checkpoint on pause", async () => {
      const handlers = makeHandlers({
        plan: vi.fn(async () => ({ action: "test", args: {} })),
        decide: vi.fn(async () => "pause" as const),
      });

      const checkpoints = new CheckpointManager();
      const loop = new AgentLoop(
        { sessionId: "s1", modeId: "code" },
        handlers,
        undefined,
        checkpoints,
      );

      await loop.run();

      const ckpts = checkpoints.listForSession("s1");
      expect(ckpts.some((c) => c.trigger === "interrupt")).toBe(true);
    });

    it("restores from checkpoint", async () => {
      const checkpoints = new CheckpointManager();
      const loop = new AgentLoop(
        { sessionId: "s1", modeId: "code" },
        makeHandlers(),
        undefined,
        checkpoints,
      );

      const ckpt = loop.checkpoint("user", "before change");
      expect(ckpt.state.stepCount).toBe(0);

      // Simulate some state change would happen during run
      const restored = loop.restoreFromCheckpoint(ckpt.id);
      expect(restored).toBe(true);
      expect(loop.state.stepCount).toBe(0);
    });
  });

  describe("switchMode", () => {
    it("changes mode and emits event", () => {
      const events = new EventStream();
      const loop = new AgentLoop({ sessionId: "s1", modeId: "code" }, makeHandlers(), events);

      loop.switchMode("debug");

      expect(loop.state.modeId).toBe("debug");
      const modeEvents = events.getEvents("agent:mode-change");
      expect(modeEvents).toHaveLength(1);
    });
  });
});
