import type { AgentEvent, ModeId } from "@code-one/shared-types";
import { EventStream, createEvent } from "./event-stream.js";
import { CheckpointManager } from "./checkpoint.js";
import type { CheckpointData } from "./checkpoint.js";

// ---------------------------------------------------------------------------
// Agent loop types
// ---------------------------------------------------------------------------

export type AgentPhase = "idle" | "planning" | "acting" | "observing" | "deciding" | "paused" | "completed" | "failed";

export interface AgentState {
  sessionId: string;
  phase: AgentPhase;
  modeId: ModeId;
  stepCount: number;
  maxSteps: number;
  /** Accumulated context/working memory for this run */
  workingMemory: Record<string, unknown>;
  /** Whether the agent is waiting for user approval */
  awaitingApproval: boolean;
}

export interface AgentLoopConfig {
  sessionId: string;
  modeId: ModeId;
  maxSteps?: number;
}

/** Handler called at each phase of the loop. Return false to stop. */
export interface AgentHandlers {
  /** Plan the next action(s) given current state. */
  plan(state: AgentState): Promise<{ action: string; args: Record<string, unknown> } | null>;
  /** Execute the planned action. */
  act(state: AgentState, action: string, args: Record<string, unknown>): Promise<{ result: unknown; success: boolean }>;
  /** Process the action result, update working memory. */
  observe(state: AgentState, result: unknown, success: boolean): Promise<void>;
  /** Decide whether to continue, stop, or change strategy. */
  decide(state: AgentState): Promise<"continue" | "complete" | "fail" | "pause">;
}

// ---------------------------------------------------------------------------
// Agent loop
// ---------------------------------------------------------------------------

/**
 * Core agent execution loop: Plan → Act → Observe → Decide.
 *
 * The loop is driven by pluggable handlers so the same engine
 * works for different modes (code, debug, architect, etc.).
 */
export class AgentLoop {
  private _state: AgentState;
  private _events: EventStream;
  private _checkpoints: CheckpointManager;
  private _handlers: AgentHandlers;

  constructor(
    config: AgentLoopConfig,
    handlers: AgentHandlers,
    events?: EventStream,
    checkpoints?: CheckpointManager,
  ) {
    this._state = {
      sessionId: config.sessionId,
      phase: "idle",
      modeId: config.modeId,
      stepCount: 0,
      maxSteps: config.maxSteps ?? 50,
      workingMemory: {},
      awaitingApproval: false,
    };
    this._handlers = handlers;
    this._events = events ?? new EventStream();
    this._checkpoints = checkpoints ?? new CheckpointManager();
  }

  get state(): Readonly<AgentState> {
    return { ...this._state };
  }

  get events(): EventStream {
    return this._events;
  }

  get checkpoints(): CheckpointManager {
    return this._checkpoints;
  }

  /**
   * Run the agent loop until completion, failure, pause, or max steps.
   */
  async run(): Promise<AgentState> {
    this._state.phase = "planning";

    while (this._state.stepCount < this._state.maxSteps) {
      // Phase 1: Plan
      this._state.phase = "planning";
      const plan = await this._handlers.plan(this._state);

      if (!plan) {
        this._state.phase = "completed";
        break;
      }

      // Phase 2: Act
      this._state.phase = "acting";
      this._state.stepCount++;

      this._events.append(
        createEvent("tool:call", this._state.sessionId, "agent", {
          toolName: plan.action,
          args: plan.args,
          trustLevel: "guarded",
        }),
      );

      const { result, success } = await this._handlers.act(
        this._state,
        plan.action,
        plan.args,
      );

      // Phase 3: Observe
      this._state.phase = "observing";
      await this._handlers.observe(this._state, result, success);

      // Auto-checkpoint every 5 steps
      if (this._state.stepCount % 5 === 0) {
        this.checkpoint("auto");
      }

      // Phase 4: Decide
      this._state.phase = "deciding";
      const decision = await this._handlers.decide(this._state);

      switch (decision) {
        case "continue":
          this._state.phase = "planning";
          continue;
        case "complete":
          this._state.phase = "completed";
          return this.state;
        case "fail":
          this._state.phase = "failed";
          return this.state;
        case "pause":
          this._state.phase = "paused";
          this.checkpoint("interrupt");
          return this.state;
      }
    }

    // Max steps reached
    if (this._state.phase !== "completed") {
      this._state.phase = "failed";
    }

    return this.state;
  }

  /** Pause the loop (sets phase to paused). */
  pause(): void {
    if (this._state.phase !== "idle" && this._state.phase !== "completed" && this._state.phase !== "failed") {
      this._state.phase = "paused";
      this.checkpoint("interrupt");
    }
  }

  /** Resume from paused state. */
  async resume(): Promise<AgentState> {
    if (this._state.phase !== "paused") {
      throw new Error(`Cannot resume from phase "${this._state.phase}"`);
    }
    return this.run();
  }

  /** Create a checkpoint of current state. */
  checkpoint(trigger: CheckpointData["trigger"] = "auto", label?: string): CheckpointData {
    return this._checkpoints.create(
      this._state.sessionId,
      this._state.stepCount,
      {
        phase: this._state.phase,
        modeId: this._state.modeId,
        stepCount: this._state.stepCount,
        workingMemory: this._state.workingMemory,
      },
      trigger,
      label,
    );
  }

  /** Restore state from a checkpoint. */
  restoreFromCheckpoint(checkpointId: string): boolean {
    const restored = this._checkpoints.restore(checkpointId);
    if (!restored) return false;

    this._state.phase = (restored.phase as AgentPhase) ?? "paused";
    this._state.modeId = (restored.modeId as ModeId) ?? this._state.modeId;
    this._state.stepCount = (restored.stepCount as number) ?? 0;
    this._state.workingMemory = (restored.workingMemory as Record<string, unknown>) ?? {};

    return true;
  }

  /** Switch the agent's mode. */
  switchMode(modeId: ModeId): void {
    const oldMode = this._state.modeId;
    this._state.modeId = modeId;
    this._events.append(
      createEvent("agent:mode-change", this._state.sessionId, "system", {
        from: oldMode,
        to: modeId,
      }),
    );
  }
}
