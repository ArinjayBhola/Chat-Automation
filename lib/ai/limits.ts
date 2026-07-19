import { allModels, PROVIDER_LABEL, type ProviderId } from "./models";
import { modelCostUsd, modelCostLimit, providerCostLimit } from "./pricing";

/**
 * Per-model usage limits (monthly token budgets) and the shared usage shape.
 *
 * Provider free/paid quotas are not queryable through a single uniform API, so
 * Relay assigns each model a configurable monthly TOKEN budget and tracks
 * actual consumption against it. Real token counts come straight from the AI
 * SDK usage reported per step, so the "used" figure is exact; "limit" is the
 * budget below (override with env, see `modelLimit`).
 *
 * Client-safe (no server-only imports) so the composer + dropdown can render
 * usage bars without a round trip beyond the initial /api/usage fetch.
 */

/** Default monthly token budgets, keyed by model id. */
const DEFAULT_LIMITS: Record<string, number> = {
  // Anthropic
  "claude-opus-4-8": 1_000_000,
  "claude-sonnet-4-6": 2_000_000,
  "claude-haiku-4-5": 5_000_000,
  // OpenAI
  "gpt-4o": 1_000_000,
  "gpt-4o-mini": 5_000_000,
  // Google
  "gemini-2.0-flash": 5_000_000,
  "gemini-1.5-pro": 2_000_000,
  // OpenRouter (open models)
  "or/hermes-3-405b": 1_000_000,
  "or/hermes-3-70b": 3_000_000,
  "or/llama-3.3-70b": 3_000_000,
  "or/qwen-2.5-72b": 3_000_000,
  "or/deepseek-v3": 3_000_000,
  "or/mistral-large": 1_000_000,
  // Groq
  "groq/llama-3.3-70b": 5_000_000,
  "groq/llama-3.1-8b": 10_000_000,
  "groq/deepseek-r1-70b": 3_000_000,
  "groq/gemma2-9b": 10_000_000,
};

const FALLBACK_LIMIT = Number(
  process.env.MODEL_TOKEN_LIMIT_DEFAULT ?? 1_000_000,
);

/** Parse the optional JSON env override once. */
let envOverrides: Record<string, number> | null | undefined;
function overrides(): Record<string, number> {
  if (envOverrides !== undefined) return envOverrides ?? {};
  try {
    envOverrides = process.env.MODEL_TOKEN_LIMITS
      ? (JSON.parse(process.env.MODEL_TOKEN_LIMITS) as Record<string, number>)
      : null;
  } catch {
    envOverrides = null;
  }
  return envOverrides ?? {};
}

/** The monthly token budget for a model. Env override wins over defaults. */
export function modelLimit(modelId: string): number {
  const o = overrides();
  if (typeof o[modelId] === "number") return o[modelId];
  return DEFAULT_LIMITS[modelId] ?? FALLBACK_LIMIT;
}

/** Per-model usage returned by /api/usage and rendered as progress bars. */
export type ModelUsage = {
  modelId: string;
  label: string;
  provider: ProviderId;
  inputTokens: number;
  outputTokens: number;
  /** Subset of inputTokens served from the provider prompt cache. */
  cachedInputTokens: number;
  /** Subset of outputTokens spent on reasoning. */
  reasoningTokens: number;
  totalTokens: number;
  requests: number;
  /** Token budget. */
  limit: number;
  remaining: number;
  /** 0-100, clamped (token budget). */
  percentUsed: number;
  /** Exact USD spent on this model this window. */
  costUsd: number;
  /** USD spend budget. */
  costLimit: number;
  costRemaining: number;
  /** 0-100, clamped (dollar budget). */
  costPercentUsed: number;
};

/** Build a ModelUsage row from raw counters (pure; used server + client). */
export function toModelUsage(input: {
  modelId: string;
  label: string;
  provider: ProviderId;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  requests: number;
}): ModelUsage {
  const cachedInputTokens = input.cachedInputTokens ?? 0;
  const reasoningTokens = input.reasoningTokens ?? 0;
  const totalTokens = input.inputTokens + input.outputTokens;
  const limit = modelLimit(input.modelId);
  const remaining = Math.max(limit - totalTokens, 0);
  const percentUsed =
    limit > 0 ? Math.min(100, Math.round((totalTokens / limit) * 100)) : 0;

  const costUsd = modelCostUsd(input.modelId, {
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cachedInputTokens,
  });
  const costLimit = modelCostLimit(input.modelId);
  const costRemaining = Math.max(costLimit - costUsd, 0);
  const costPercentUsed =
    costLimit > 0 ? Math.min(100, Math.round((costUsd / costLimit) * 100)) : 0;

  return {
    modelId: input.modelId,
    label: input.label,
    provider: input.provider,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cachedInputTokens,
    reasoningTokens,
    totalTokens,
    requests: input.requests,
    limit,
    remaining,
    percentUsed,
    costUsd,
    costLimit,
    costRemaining,
    costPercentUsed,
  };
}

/** Human label for a model id, falling back to the id itself. */
export function modelLabel(modelId: string): string {
  return allModels().find((m) => m.id === modelId)?.label ?? modelId;
}

// ---- provider-level budgets -----------------------------------------------

/** Default monthly token budget a provider "offers", keyed by provider id. */
const DEFAULT_PROVIDER_LIMITS: Record<ProviderId, number> = {
  groq: 20_000_000,
  openrouter: 15_000_000,
  openai: 3_000_000,
  anthropic: 5_000_000,
  google: 10_000_000,
  opensource: 10_000_000,
};

const FALLBACK_PROVIDER_LIMIT = Number(
  process.env.PROVIDER_TOKEN_LIMIT_DEFAULT ?? 10_000_000,
);

let providerEnvOverrides: Record<string, number> | null | undefined;
function providerOverrides(): Record<string, number> {
  if (providerEnvOverrides !== undefined) return providerEnvOverrides ?? {};
  try {
    providerEnvOverrides = process.env.PROVIDER_TOKEN_LIMITS
      ? (JSON.parse(process.env.PROVIDER_TOKEN_LIMITS) as Record<string, number>)
      : null;
  } catch {
    providerEnvOverrides = null;
  }
  return providerEnvOverrides ?? {};
}

/** The monthly token budget a provider offers. Env override wins. */
export function providerLimit(provider: ProviderId): number {
  const o = providerOverrides();
  if (typeof o[provider] === "number") return o[provider];
  return DEFAULT_PROVIDER_LIMITS[provider] ?? FALLBACK_PROVIDER_LIMIT;
}

/** A provider's aggregate usage plus the per-model breakdown under it. */
export type ProviderUsage = {
  provider: ProviderId;
  label: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  requests: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  costUsd: number;
  costLimit: number;
  costRemaining: number;
  costPercentUsed: number;
  models: ModelUsage[];
};

/** Aggregate a provider's model rows into a ProviderUsage (pure). */
export function toProviderUsage(
  provider: ProviderId,
  models: ModelUsage[],
): ProviderUsage {
  const inputTokens = models.reduce((s, m) => s + m.inputTokens, 0);
  const outputTokens = models.reduce((s, m) => s + m.outputTokens, 0);
  const cachedInputTokens = models.reduce((s, m) => s + m.cachedInputTokens, 0);
  const reasoningTokens = models.reduce((s, m) => s + m.reasoningTokens, 0);
  const requests = models.reduce((s, m) => s + m.requests, 0);
  const totalTokens = inputTokens + outputTokens;
  const limit = providerLimit(provider);
  const remaining = Math.max(limit - totalTokens, 0);
  const percentUsed =
    limit > 0 ? Math.min(100, Math.round((totalTokens / limit) * 100)) : 0;

  // Sum exact per-model cost (each model prices its own tokens).
  const costUsd = models.reduce((s, m) => s + m.costUsd, 0);
  const costLimit = providerCostLimit(provider);
  const costRemaining = Math.max(costLimit - costUsd, 0);
  const costPercentUsed =
    costLimit > 0 ? Math.min(100, Math.round((costUsd / costLimit) * 100)) : 0;

  return {
    provider,
    label: PROVIDER_LABEL[provider] ?? provider,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    reasoningTokens,
    totalTokens,
    requests,
    limit,
    remaining,
    percentUsed,
    costUsd,
    costLimit,
    costRemaining,
    costPercentUsed,
    models,
  };
}
