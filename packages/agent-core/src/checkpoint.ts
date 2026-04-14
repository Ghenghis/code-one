/**
 * Checkpoint manager for agent state snapshot/restore.
 *
 * Checkpoints capture the full agent state at a point in time,
 * enabling rollback, interrupt/resume, and session replay.
 */
export interface CheckpointData {
  id: string;
  sessionId: string;
  /** Step/event count at checkpoint time */
  stepNumber: number;
  /** Serializable state snapshot */
  state: Record<string, unknown>;
  /** Human-readable label */
  label?: string;
  /** What triggered this checkpoint */
  trigger: "auto" | "user" | "interrupt";
  createdAt: number;
}

export class CheckpointManager {
  private _checkpoints: CheckpointData[] = [];
  private _idCounter = 0;

  /**
   * Create a checkpoint of the current state.
   */
  create(
    sessionId: string,
    stepNumber: number,
    state: Record<string, unknown>,
    trigger: CheckpointData["trigger"] = "auto",
    label?: string,
  ): CheckpointData {
    const checkpoint: CheckpointData = {
      id: `ckpt_${++this._idCounter}`,
      sessionId,
      stepNumber,
      state: structuredClone(state),
      trigger,
      label,
      createdAt: Date.now(),
    };
    this._checkpoints.push(checkpoint);
    return checkpoint;
  }

  /** Get a checkpoint by ID. */
  get(checkpointId: string): CheckpointData | undefined {
    return this._checkpoints.find((c) => c.id === checkpointId);
  }

  /** Get the latest checkpoint for a session. */
  getLatest(sessionId: string): CheckpointData | undefined {
    const sessionCheckpoints = this._checkpoints.filter(
      (c) => c.sessionId === sessionId,
    );
    return sessionCheckpoints[sessionCheckpoints.length - 1];
  }

  /** List all checkpoints for a session. */
  listForSession(sessionId: string): CheckpointData[] {
    return this._checkpoints.filter((c) => c.sessionId === sessionId);
  }

  /**
   * Restore to a checkpoint. Returns the state snapshot.
   * The caller is responsible for applying the state.
   */
  restore(checkpointId: string): Record<string, unknown> | undefined {
    const checkpoint = this.get(checkpointId);
    if (!checkpoint) return undefined;
    return structuredClone(checkpoint.state);
  }

  /**
   * Restore to the latest checkpoint for a session.
   */
  restoreLatest(sessionId: string): { checkpoint: CheckpointData; state: Record<string, unknown> } | undefined {
    const latest = this.getLatest(sessionId);
    if (!latest) return undefined;
    return {
      checkpoint: latest,
      state: structuredClone(latest.state),
    };
  }

  /** Delete checkpoints older than a given checkpoint (prune). */
  pruneOlderThan(checkpointId: string): number {
    const idx = this._checkpoints.findIndex((c) => c.id === checkpointId);
    if (idx <= 0) return 0;
    const removed = this._checkpoints.splice(0, idx);
    return removed.length;
  }

  /** Total number of checkpoints. */
  get size(): number {
    return this._checkpoints.length;
  }

  /** Clear all checkpoints. */
  clear(): void {
    this._checkpoints = [];
  }
}
