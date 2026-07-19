import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";
import type { ProviderId } from "../../ai/models";
import { estimateStepCost } from "./cost";
import type {
  CheckpointSnapshot,
  CompletedStep,
  FailureClass,
  FailureRecord,
  ProviderAttempt,
  TokenUsage,
} from "./types";

/**
 * Relay-owned working memory for one agent run. The LLM is stateless; THIS is
 * the durable execution state that any provider inherits.
 *
 * `messages` (getter) = the original input plus every completed step's response
 * messages, in order. Because a step only commits after its tools have run, the
 * accumulated list is always tool-call/result balanced, so a fresh provider can
 * resume from it without redoing finished work or seeing a dangling tool call.
 */
export class ExecutionState {
  readonly runId: string;
  readonly userId: string;
  readonly chatId?: string;

  private readonly baseInput: ModelMessage[];
  private stepMessages: ModelMessage[] = [];
  private completedSteps: CompletedStep[] = [];

  /** Text from committed steps only (excludes in-flight, uncommitted text). */
  committedText = "";
  status: CheckpointSnapshot["status"] = "running";
  activeProvider: ProviderId | null = null;
  activeModelId: string | null = null;
  retryCount = 0;

  readonly providerHistory: ProviderAttempt[] = [];
  readonly failureHistory: FailureRecord[] = [];
  readonly tokenUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  costUsd = 0;

  /**
   * Per-model token + request accounting for this run. A single run can span
   * multiple models (failover), so usage is split by model to feed the accurate
   * per-model usage tracker (model_usage table).
   */
  private readonly usageByModel = new Map<
    string,
    {
      provider: ProviderId;
      inputTokens: number;
      outputTokens: number;
      cachedInputTokens: number;
      reasoningTokens: number;
      requests: number;
    }
  >();

  constructor(opts: {
    userId: string;
    input: ModelMessage[];
    chatId?: string;
    runId?: string;
  }) {
    this.runId = opts.runId ?? randomUUID();
    this.userId = opts.userId;
    this.chatId = opts.chatId;
    this.baseInput = opts.input;
  }

  /** Messages to send to the next model call: input + all completed steps. */
  get messages(): ModelMessage[] {
    return [...this.baseInput, ...this.stepMessages];
  }

  get stepCount(): number {
    return this.completedSteps.length;
  }

  /** Record that a provider is now the active one for the run. */
  markProviderActive(provider: ProviderId, modelId: string): void {
    this.activeProvider = provider;
    this.activeModelId = modelId;
    this.providerHistory.push({
      provider,
      modelId,
      at: new Date().toISOString(),
    });
    // Each activation is one request against that model's quota (it hit the API
    // even if it later fails before producing tokens).
    const entry = this.modelEntry(modelId, provider);
    entry.requests += 1;
  }

  private modelEntry(modelId: string, provider: ProviderId) {
    let entry = this.usageByModel.get(modelId);
    if (!entry) {
      entry = {
        provider,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        reasoningTokens: 0,
        requests: 0,
      };
      this.usageByModel.set(modelId, entry);
    }
    return entry;
  }

  /** Per-model usage deltas for this run, for the usage tracker. */
  get modelUsageDeltas(): Array<{
    modelId: string;
    provider: ProviderId;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    reasoningTokens: number;
    requests: number;
  }> {
    return [...this.usageByModel.entries()].map(([modelId, u]) => ({
      modelId,
      provider: u.provider,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      cachedInputTokens: u.cachedInputTokens,
      reasoningTokens: u.reasoningTokens,
      requests: u.requests,
    }));
  }

  /**
   * Commit one completed step into working memory. `messages` are the step's
   * response messages (assistant + tool results). Idempotent per step is not
   * required because the engine only calls this on genuine step completion.
   */
  commitStep(step: {
    provider: ProviderId;
    modelId: string;
    text: string;
    toolNames: string[];
    messages: ModelMessage[];
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
    reasoningTokens?: number;
  }): void {
    this.stepMessages.push(...step.messages);
    if (step.text) this.committedText += step.text;
    this.completedSteps.push({
      index: this.completedSteps.length,
      provider: step.provider,
      modelId: step.modelId,
      text: step.text,
      toolNames: step.toolNames,
      finishedAt: new Date().toISOString(),
    });
    this.addUsage(
      step.modelId,
      step.inputTokens,
      step.outputTokens,
      step.cachedInputTokens ?? 0,
      step.reasoningTokens ?? 0,
    );
  }

  private addUsage(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    cachedInputTokens = 0,
    reasoningTokens = 0,
  ) {
    this.tokenUsage.inputTokens += inputTokens || 0;
    this.tokenUsage.outputTokens += outputTokens || 0;
    this.tokenUsage.totalTokens =
      this.tokenUsage.inputTokens + this.tokenUsage.outputTokens;
    this.costUsd += estimateStepCost(
      modelId,
      inputTokens || 0,
      outputTokens || 0,
      cachedInputTokens || 0,
    );

    const entry = this.usageByModel.get(modelId);
    if (entry) {
      entry.inputTokens += inputTokens || 0;
      entry.outputTokens += outputTokens || 0;
      entry.cachedInputTokens += cachedInputTokens || 0;
      entry.reasoningTokens += reasoningTokens || 0;
    }
  }

  recordFailure(
    provider: ProviderId,
    modelId: string,
    cls: FailureClass,
    message: string,
  ): void {
    this.failureHistory.push({
      provider,
      modelId,
      class: cls,
      message: message.slice(0, 500),
      at: new Date().toISOString(),
    });
    this.retryCount += 1;
    this.status = "switched";
  }

  toSnapshot(): CheckpointSnapshot {
    return {
      runId: this.runId,
      userId: this.userId,
      chatId: this.chatId,
      status: this.status,
      currentStep: this.stepCount,
      activeProvider: this.activeProvider,
      activeModelId: this.activeModelId,
      workingMemory: this.stepMessages,
      completedSteps: this.completedSteps,
      committedText: this.committedText,
      providerHistory: this.providerHistory,
      failureHistory: this.failureHistory,
      retryCount: this.retryCount,
      tokenUsage: this.tokenUsage,
      costUsd: this.costUsd,
    };
  }

  /** Reconstruct state from a persisted snapshot (durable resume path). */
  static fromSnapshot(
    snap: CheckpointSnapshot,
    baseInput: ModelMessage[],
  ): ExecutionState {
    const s = new ExecutionState({
      userId: snap.userId,
      input: baseInput,
      chatId: snap.chatId,
      runId: snap.runId,
    });
    s.stepMessages = [...snap.workingMemory];
    s.completedSteps = [...snap.completedSteps];
    s.committedText = snap.committedText;
    s.status = snap.status;
    s.activeProvider = snap.activeProvider;
    s.activeModelId = snap.activeModelId;
    s.retryCount = snap.retryCount;
    s.providerHistory.push(...snap.providerHistory);
    s.failureHistory.push(...snap.failureHistory);
    s.tokenUsage.inputTokens = snap.tokenUsage.inputTokens;
    s.tokenUsage.outputTokens = snap.tokenUsage.outputTokens;
    s.tokenUsage.totalTokens = snap.tokenUsage.totalTokens;
    s.costUsd = snap.costUsd;
    return s;
  }
}
