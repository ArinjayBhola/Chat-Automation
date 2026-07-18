import "server-only";
import {
  stepCountIs,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";
import type { ProviderId } from "../../ai/models";
import { ExecutionState } from "./execution-state";
import { FailoverController } from "./failover-controller";
import { getHealthMonitor, type ProviderHealthMonitor } from "./health-monitor";
import { ProviderManager } from "./provider-manager";
import { classifyFailure } from "./retry-policy";
import { isRetryable, type EngineEvent, type FailureClass } from "./types";

const DEFAULT_MAX_STEPS = 8;

/** Data the engine needs from one completed model step to commit it. */
export type StepFinish = {
  provider: ProviderId;
  modelId: string;
  text: string;
  toolNames: string[];
  messages: ModelMessage[];
  inputTokens: number;
  outputTokens: number;
};

export type StreamAttempt = {
  fullStream: AsyncIterable<Record<string, unknown>>;
};

/**
 * Injectable streaming primitive. The default wraps AI SDK `streamText`; tests
 * inject a fake so the failover loop can be exercised deterministically without
 * a live provider. Keeping this the ONLY place that touches `streamText` is what
 * keeps the engine provider-agnostic.
 */
export type StreamFn = (opts: {
  model: LanguageModel;
  system: string;
  messages: ModelMessage[];
  tools: ToolSet;
  maxSteps: number;
  provider: ProviderId;
  modelId: string;
  onStepFinish: (step: StepFinish) => void;
}) => StreamAttempt;

const defaultStreamFn: StreamFn = (o) => {
  const result = streamText({
    model: o.model,
    system: o.system,
    messages: o.messages,
    tools: o.tools,
    stopWhen: stepCountIs(o.maxSteps),
    onStepFinish: (step) => {
      o.onStepFinish({
        provider: o.provider,
        modelId: o.modelId,
        text: step.text ?? "",
        toolNames: (step.toolCalls ?? []).map((c) => c.toolName),
        messages: (step.response?.messages ?? []) as ModelMessage[],
        inputTokens: step.usage?.inputTokens ?? 0,
        outputTokens: step.usage?.outputTokens ?? 0,
      });
    },
  });
  return { fullStream: result.fullStream as AsyncIterable<Record<string, unknown>> };
};

export type CheckpointSink = (state: ExecutionState) => void;

export type ExecutionEngineOpts = {
  state: ExecutionState;
  requestedModelId: string;
  system: string;
  tools: ToolSet;
  providerManager?: ProviderManager;
  health?: ProviderHealthMonitor;
  streamFn?: StreamFn;
  checkpoint?: CheckpointSink;
  maxSteps?: number;
};

/**
 * The failover-aware, checkpoint-based execution loop. Runs the agent over the
 * provider chain: streams a provider's output live, commits each completed step
 * into Relay-owned working memory, and on a recoverable provider failure hands
 * the SAME working memory to the next provider so the run continues from the
 * point of failure instead of restarting.
 */
export class ExecutionEngine {
  private readonly state: ExecutionState;
  private readonly requestedModelId: string;
  private readonly system: string;
  private readonly tools: ToolSet;
  private readonly providerManager: ProviderManager;
  private readonly health: ProviderHealthMonitor;
  private readonly streamFn: StreamFn;
  private readonly checkpoint: CheckpointSink;
  private readonly maxSteps: number;

  constructor(opts: ExecutionEngineOpts) {
    this.state = opts.state;
    this.requestedModelId = opts.requestedModelId;
    this.system = opts.system;
    this.tools = opts.tools;
    this.health = opts.health ?? getHealthMonitor();
    this.providerManager =
      opts.providerManager ?? new ProviderManager({ health: this.health });
    this.streamFn = opts.streamFn ?? defaultStreamFn;
    this.checkpoint = opts.checkpoint ?? (() => {});
    this.maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  }

  private persist(): void {
    try {
      this.checkpoint(this.state);
    } catch {
      /* checkpointing must never break the run */
    }
  }

  async *run(): AsyncGenerator<EngineEvent> {
    const chain = this.providerManager.buildChain(this.requestedModelId);
    if (chain.length === 0) {
      this.state.status = "failed";
      yield {
        kind: "error",
        message:
          "No AI provider is configured on this server. Add a provider API key to run the agent.",
      };
      return;
    }

    const controller = new FailoverController(chain, this.health);
    let candidate = controller.next();
    let lastFailure: { cls: FailureClass; msg: string; label: string } | null =
      null;

    while (candidate) {
      const remaining = this.maxSteps - this.state.stepCount;
      if (remaining <= 0) {
        this.state.status = "completed";
        this.persist();
        yield {
          kind: "usage",
          usage: this.state.tokenUsage,
          costUsd: this.state.costUsd,
        };
        return;
      }

      const resolved = await this.providerManager.resolve(candidate);
      if (!resolved) {
        // Key or SDK package missing at resolve time - treat as unavailable and
        // move on without emitting an active-provider event.
        const msg = `${this.providerManager.label(candidate.provider)} is not available.`;
        this.providerManager.recordFailure(candidate.provider, "auth", msg);
        this.state.recordFailure(candidate.provider, candidate.modelId, "auth", msg);
        if (!controller.hasNext()) {
          this.state.status = "failed";
          this.persist();
          yield { kind: "error", message: "No usable AI provider is available." };
          return;
        }
        lastFailure = {
          cls: "auth",
          msg,
          label: this.providerManager.label(candidate.provider),
        };
        candidate = controller.next();
        continue;
      }

      this.state.markProviderActive(resolved.provider, resolved.modelId);
      yield {
        kind: "provider",
        status: lastFailure ? "switched" : "active",
        provider: resolved.provider,
        modelId: resolved.modelId,
        label: resolved.label,
        reason: lastFailure?.msg,
        failureClass: lastFailure?.cls,
      };
      this.persist();

      let pendingText = "";
      let failure: unknown = null;
      const startedAt = Date.now();

      const attempt = this.streamFn({
        model: resolved.model,
        system: this.system,
        messages: this.state.messages,
        tools: this.tools,
        maxSteps: remaining,
        provider: resolved.provider,
        modelId: resolved.modelId,
        onStepFinish: (step) => {
          this.state.commitStep(step);
          pendingText = "";
          this.persist();
        },
      });

      try {
        for await (const part of attempt.fullStream) {
          const type = part.type as string;
          if (type === "error") {
            failure = (part as { error?: unknown }).error ?? new Error("stream error");
            break;
          }
          if (type === "text-delta" || type === "text") {
            const v = (part.text ?? part.textDelta ?? part.delta) as
              | string
              | undefined;
            if (typeof v === "string") pendingText += v;
          }
          yield { kind: "sdk", part };
        }
      } catch (e) {
        failure = e;
      }

      if (!failure) {
        this.providerManager.recordSuccess(
          resolved.provider,
          Date.now() - startedAt,
        );
        this.state.status = "completed";
        this.persist();
        yield {
          kind: "usage",
          usage: this.state.tokenUsage,
          costUsd: this.state.costUsd,
        };
        return;
      }

      const cls = classifyFailure(failure);
      const msg = failure instanceof Error ? failure.message : String(failure);
      this.providerManager.recordFailure(resolved.provider, cls, msg);
      this.state.recordFailure(resolved.provider, resolved.modelId, cls, msg);

      if (!isRetryable(cls) || !controller.hasNext()) {
        this.state.status = "failed";
        this.persist();
        yield {
          kind: "error",
          message: userFacingFailure(cls, resolved.label),
        };
        return;
      }

      // Drop the dead provider's streamed-but-uncommitted text so the client
      // doesn't show a half-sentence that the next provider will redo.
      if (pendingText) {
        yield { kind: "reset", committedText: this.state.committedText };
      }
      lastFailure = { cls, msg, label: resolved.label };
      candidate = controller.next();
    }

    this.state.status = "failed";
    this.persist();
    yield {
      kind: "error",
      message: "All configured AI providers are currently unavailable.",
    };
  }
}

function userFacingFailure(cls: FailureClass, label: string): string {
  switch (cls) {
    case "rate_limit":
      return `${label} hit a rate limit and no fallback provider is available. Please try again shortly.`;
    case "auth":
      return `${label} rejected the request (authentication). Check the provider API key.`;
    case "fatal":
      return `The request failed and cannot be retried on another provider.`;
    default:
      return `${label} is temporarily unavailable and no fallback provider is available. Please try again.`;
  }
}
