import type { ModelMessage } from "ai";
import type { ProviderId } from "../../ai/models";

/**
 * Shared types for the provider-failover / checkpoint-resume subsystem.
 *
 * The design goal: the LLM is stateless. Relay owns the execution state
 * (accumulated messages, completed steps, token/cost accounting, provider +
 * failure history). When a provider fails mid-run the same state is handed to
 * the next provider, which continues from the exact point of failure instead of
 * restarting.
 */

/** How a provider failure is classified, which drives the recovery decision. */
export type FailureClass =
  | "rate_limit" // 429, quota exceeded, free tier exhausted
  | "server" // 5xx, overloaded, provider unavailable
  | "timeout" // request timed out
  | "network" // DNS / connection reset / fetch failed
  | "auth" // 401/403 - provider creds bad; skip provider, try next
  | "fatal"; // 400 / validation / tool schema - fails everywhere, do not fail over

/** Whether a failure class should trigger a switch to the next provider. */
export function isRetryable(cls: FailureClass): boolean {
  return cls !== "fatal";
}

/** One record of a provider taking over (or being tried) during a run. */
export type ProviderAttempt = {
  provider: ProviderId;
  modelId: string;
  at: string; // ISO timestamp
};

/** One record of a provider failure during a run. */
export type FailureRecord = {
  provider: ProviderId;
  modelId: string;
  class: FailureClass;
  message: string;
  at: string; // ISO timestamp
};

/** A single completed execution step (one model round + its tool results). */
export type CompletedStep = {
  index: number;
  provider: ProviderId;
  modelId: string;
  text: string;
  toolNames: string[];
  finishedAt: string;
};

/** Token usage accumulated across the whole run (all providers). */
export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

/**
 * A serializable snapshot of an execution. Persisted to `agent_checkpoints`
 * and used to reconstruct working memory. `workingMemory` is the ordered list
 * of ModelMessages for every completed step - this is what a fresh provider
 * inherits so it never redoes finished work.
 */
export type CheckpointSnapshot = {
  runId: string;
  userId: string;
  chatId?: string;
  status: "running" | "switched" | "completed" | "failed";
  currentStep: number;
  activeProvider: ProviderId | null;
  activeModelId: string | null;
  workingMemory: ModelMessage[];
  completedSteps: CompletedStep[];
  committedText: string;
  providerHistory: ProviderAttempt[];
  failureHistory: FailureRecord[];
  retryCount: number;
  tokenUsage: TokenUsage;
  costUsd: number;
};

/**
 * Events emitted by the ExecutionEngine generator. `sdk` parts are passed
 * through from the AI SDK fullStream unchanged (text/tool-call/tool-result/
 * tool-error) so the existing route mapping keeps working; the rest are
 * failover control events.
 */
export type EngineEvent =
  | { kind: "sdk"; part: Record<string, unknown> }
  | {
      kind: "provider";
      status: "active" | "switched" | "exhausted";
      provider: ProviderId;
      modelId: string;
      label: string;
      reason?: string;
      failureClass?: FailureClass;
    }
  /** Discard streamed-but-uncommitted text after a failover; reset to baseline. */
  | { kind: "reset"; committedText: string }
  | { kind: "usage"; usage: TokenUsage; costUsd: number }
  | { kind: "error"; message: string };
