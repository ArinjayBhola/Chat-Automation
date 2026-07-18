import "server-only";
import type { LanguageModel } from "ai";
import {
  DEFAULT_MODEL_ID,
  failoverModelId as defaultFailoverModelId,
  getModelInfo as defaultGetModelInfo,
  providerConfigured as defaultProviderConfigured,
  providerPriority as defaultProviderPriority,
  PROVIDER_LABEL,
  type ModelInfo,
  type ProviderId,
} from "../../ai/models";
import { resolveModel as defaultResolveModel } from "../../ai/provider";
import { getHealthMonitor, ProviderHealthMonitor } from "./health-monitor";
import type { FailureClass } from "./types";

export type Candidate = { provider: ProviderId; modelId: string };

export type ResolvedCandidate = Candidate & {
  model: LanguageModel;
  info: ModelInfo;
  label: string;
};

/**
 * Owns provider selection and health. Builds the ordered candidate chain for a
 * run (requested model first, then each other configured provider by priority)
 * and resolves candidates to real SDK models lazily. Provider-specific wiring
 * stays entirely inside `resolveModel`; nothing here or downstream branches on
 * a particular provider, keeping providers interchangeable.
 */
export class ProviderManager {
  private readonly health: ProviderHealthMonitor;
  private readonly configured: (p: ProviderId) => boolean;
  private readonly priority: () => ProviderId[];
  private readonly failoverModelId: (p: ProviderId) => string | null;
  private readonly getModelInfo: (id: string) => ModelInfo | undefined;
  private readonly resolveModel: typeof defaultResolveModel;

  constructor(
    deps: {
      health?: ProviderHealthMonitor;
      configured?: (p: ProviderId) => boolean;
      priority?: () => ProviderId[];
      failoverModelId?: (p: ProviderId) => string | null;
      getModelInfo?: (id: string) => ModelInfo | undefined;
      resolveModel?: typeof defaultResolveModel;
    } = {},
  ) {
    this.health = deps.health ?? getHealthMonitor();
    this.configured = deps.configured ?? defaultProviderConfigured;
    this.priority = deps.priority ?? defaultProviderPriority;
    this.failoverModelId = deps.failoverModelId ?? defaultFailoverModelId;
    this.getModelInfo = deps.getModelInfo ?? defaultGetModelInfo;
    this.resolveModel = deps.resolveModel ?? defaultResolveModel;
  }

  /**
   * Ordered failover chain: the requested model's provider first (the user's
   * choice always leads), then every other configured provider in priority
   * order using that provider's representative model. Deduped by provider.
   */
  buildChain(requestedModelId: string): Candidate[] {
    const info =
      this.getModelInfo(requestedModelId) ?? this.getModelInfo(DEFAULT_MODEL_ID);
    const chain: Candidate[] = [];
    const seen = new Set<ProviderId>();

    if (info && this.configured(info.provider)) {
      chain.push({ provider: info.provider, modelId: info.id });
      seen.add(info.provider);
    }

    for (const p of this.priority()) {
      if (seen.has(p) || !this.configured(p)) continue;
      const modelId = this.failoverModelId(p);
      if (!modelId) continue;
      chain.push({ provider: p, modelId });
      seen.add(p);
    }

    return chain;
  }

  label(provider: ProviderId): string {
    return PROVIDER_LABEL[provider] ?? provider;
  }

  isHealthy(provider: ProviderId): boolean {
    return this.health.isHealthy(provider);
  }

  async resolve(candidate: Candidate): Promise<ResolvedCandidate | null> {
    const resolved = await this.resolveModel(candidate.modelId);
    if (!resolved) return null;
    return {
      ...candidate,
      model: resolved.model,
      info: resolved.info,
      label: this.label(candidate.provider),
    };
  }

  recordSuccess(provider: ProviderId, latencyMs?: number): void {
    this.health.recordSuccess(provider, latencyMs);
  }

  recordFailure(
    provider: ProviderId,
    cls: FailureClass,
    message: string,
  ): void {
    this.health.recordFailure(provider, cls, message);
  }

  metrics() {
    return this.health.snapshot();
  }
}
