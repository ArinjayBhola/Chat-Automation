import "server-only";
import type { ModelMessage } from "ai";
import {
  getLatestCheckpoint,
  upsertCheckpoint,
  type CheckpointRecord,
} from "../../db-queries";
import type { ExecutionState } from "./execution-state";
import type {
  CheckpointSnapshot,
  CompletedStep,
  FailureRecord,
  ProviderAttempt,
} from "./types";
import type { ProviderId } from "../../ai/models";

/**
 * Persists execution state to Postgres so a run survives restarts and can be
 * inspected or resumed. Every method is null-safe: with no database configured
 * the writes no-op, so the live in-request failover path is unaffected.
 *
 * Saving is fire-and-forget from the engine's perspective (it never awaits),
 * keeping streaming latency low; durability is best-effort per step.
 */
export class CheckpointManager {
  /** Persist a snapshot for the run (upsert on runId). Never throws to caller. */
  save(state: ExecutionState): void {
    const snap = state.toSnapshot();
    void this.persist(snap).catch((e) => {
      console.error("[checkpoint] save failed:", e);
    });
  }

  /** Await-able persist, mainly for tests / explicit flush points. */
  async persist(snap: CheckpointSnapshot): Promise<void> {
    const rec: CheckpointRecord = {
      runId: snap.runId,
      userId: snap.userId,
      chatId: snap.chatId ?? null,
      status: snap.status,
      currentStep: snap.currentStep,
      activeProvider: snap.activeProvider,
      activeModelId: snap.activeModelId,
      workingMemory: snap.workingMemory,
      completedSteps: snap.completedSteps,
      committedText: snap.committedText,
      providerHistory: snap.providerHistory,
      failureHistory: snap.failureHistory,
      retryCount: snap.retryCount,
      tokenUsage: snap.tokenUsage,
      costUsd: snap.costUsd,
    };
    await upsertCheckpoint(rec);
  }

  /** Load the latest snapshot for a run, or null when absent / no DB. */
  async load(
    runId: string,
    userId: string,
  ): Promise<CheckpointSnapshot | null> {
    const row = await getLatestCheckpoint(runId, userId);
    if (!row) return null;
    return {
      runId: row.runId,
      userId: row.userId,
      chatId: row.chatId ?? undefined,
      status: row.status,
      currentStep: row.currentStep,
      activeProvider: (row.activeProvider as ProviderId | null) ?? null,
      activeModelId: row.activeModelId ?? null,
      workingMemory: (row.workingMemory as ModelMessage[]) ?? [],
      completedSteps: (row.completedSteps as CompletedStep[]) ?? [],
      committedText: row.committedText ?? "",
      providerHistory: (row.providerHistory as ProviderAttempt[]) ?? [],
      failureHistory: (row.failureHistory as FailureRecord[]) ?? [],
      retryCount: row.retryCount ?? 0,
      tokenUsage: row.tokenUsage ?? {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      costUsd: Number(row.costUsd ?? "0"),
    };
  }
}
