import type { ProviderId } from "./models";

/**
 * Canonical model pricing and the exact-cost math built on it.
 *
 * Prices are USD per 1,000,000 tokens, split by kind:
 *  - `in`       - fresh (uncached) prompt input tokens
 *  - `cachedIn` - prompt tokens served from the provider's prompt cache (cheaper)
 *  - `out`      - generated output tokens (reasoning tokens bill as output)
 *
 * Token COUNTS are exact (real AI SDK usage); the dollar figure is exact given
 * these list prices. Override any of it with the `MODEL_PRICING` env var (JSON
 * of `{ [modelId]: { in, out, cachedIn? } }`).
 *
 * Client-safe (no server-only imports) so usage bars can render the cost
 * without a round trip beyond the initial /api/usage fetch.
 */

export type ModelPrice = {
  /** USD per 1M fresh input tokens. */
  in: number;
  /** USD per 1M output tokens. */
  out: number;
  /** USD per 1M cached input tokens (defaults to `in` when unknown). */
  cachedIn: number;
};

/**
 * Published list prices (USD / 1M tokens). Cached-input prices follow each
 * provider's cache-read discount where known (Anthropic ~0.1x, OpenAI ~0.5x);
 * open models without a documented cache read fall back to the input price.
 */
const DEFAULT_PRICING: Record<string, ModelPrice> = {
  // Anthropic - cache read is 0.1x input
  "claude-opus-4-8": { in: 15, out: 75, cachedIn: 1.5 },
  "claude-sonnet-4-6": { in: 3, out: 15, cachedIn: 0.3 },
  "claude-haiku-4-5": { in: 0.8, out: 4, cachedIn: 0.08 },
  // OpenAI - cache read is 0.5x input
  "gpt-4o": { in: 2.5, out: 10, cachedIn: 1.25 },
  "gpt-4o-mini": { in: 0.15, out: 0.6, cachedIn: 0.075 },
  // Google - cache read is 0.25x input
  "gemini-2.0-flash": { in: 0.1, out: 0.4, cachedIn: 0.025 },
  "gemini-1.5-pro": { in: 1.25, out: 5, cachedIn: 0.3125 },
  // OpenRouter / Groq open models (no separate cache-read price)
  "or/hermes-3-405b": { in: 0.9, out: 0.9, cachedIn: 0.9 },
  "or/hermes-3-70b": { in: 0.3, out: 0.3, cachedIn: 0.3 },
  "or/llama-3.3-70b": { in: 0.12, out: 0.3, cachedIn: 0.12 },
  "or/qwen-2.5-72b": { in: 0.3, out: 0.3, cachedIn: 0.3 },
  "or/deepseek-v3": { in: 0.3, out: 0.9, cachedIn: 0.3 },
  "or/mistral-large": { in: 2, out: 6, cachedIn: 2 },
  "groq/llama-3.3-70b": { in: 0.59, out: 0.79, cachedIn: 0.59 },
  "groq/llama-3.1-8b": { in: 0.05, out: 0.08, cachedIn: 0.05 },
  "groq/deepseek-r1-70b": { in: 0.75, out: 0.99, cachedIn: 0.75 },
  "groq/gemma2-9b": { in: 0.2, out: 0.2, cachedIn: 0.2 },
};

/** Parse the optional JSON env override once. */
let pricingOverrides:
  | Record<string, Partial<ModelPrice>>
  | null
  | undefined;
function overrides(): Record<string, Partial<ModelPrice>> {
  if (pricingOverrides !== undefined) return pricingOverrides ?? {};
  try {
    pricingOverrides = process.env.MODEL_PRICING
      ? (JSON.parse(process.env.MODEL_PRICING) as Record<
          string,
          Partial<ModelPrice>
        >)
      : null;
  } catch {
    pricingOverrides = null;
  }
  return pricingOverrides ?? {};
}

/** The price for a model. Env override is merged over the default. Unknown
 * models price at 0 (accounting never throws; extend the table as needed). */
export function modelPrice(modelId: string): ModelPrice {
  const base = DEFAULT_PRICING[modelId] ?? { in: 0, out: 0, cachedIn: 0 };
  const o = overrides()[modelId];
  if (!o) return base;
  const merged = {
    in: typeof o.in === "number" ? o.in : base.in,
    out: typeof o.out === "number" ? o.out : base.out,
    cachedIn: typeof o.cachedIn === "number" ? o.cachedIn : base.cachedIn,
  };
  return merged;
}

/** Token counts for one usage sample. `cachedInputTokens` is the subset of
 * `inputTokens` served from cache; `reasoningTokens` is a subset of output. */
export type CostTokens = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
};

/**
 * Exact USD cost for a usage sample on a given model. Cached input is billed at
 * the cache-read rate and the remaining (fresh) input at the full rate; output
 * (which already includes any reasoning tokens) bills at the output rate.
 */
export function modelCostUsd(modelId: string, t: CostTokens): number {
  const p = modelPrice(modelId);
  const input = Math.max(0, t.inputTokens || 0);
  const cached = Math.min(Math.max(0, t.cachedInputTokens || 0), input);
  const fresh = input - cached;
  const output = Math.max(0, t.outputTokens || 0);
  return (
    (fresh / 1_000_000) * p.in +
    (cached / 1_000_000) * p.cachedIn +
    (output / 1_000_000) * p.out
  );
}

// ---- dollar budgets --------------------------------------------------------

/**
 * Default monthly SPEND budget (USD) per model. This is the "real" budget the
 * "left" figure is measured against, unlike an invented token cap. Override
 * per-model with `MODEL_COST_LIMITS` (JSON `{ [modelId]: usd }`) or globally
 * with `MODEL_COST_LIMIT_DEFAULT`.
 */
const DEFAULT_COST_LIMITS: Record<string, number> = {
  "claude-opus-4-8": 50,
  "claude-sonnet-4-6": 30,
  "claude-haiku-4-5": 20,
  "gpt-4o": 30,
  "gpt-4o-mini": 15,
  "gemini-2.0-flash": 15,
  "gemini-1.5-pro": 20,
};

const FALLBACK_COST_LIMIT = Number(
  process.env.MODEL_COST_LIMIT_DEFAULT ?? 10,
);

let costOverrides: Record<string, number> | null | undefined;
function modelCostOverrides(): Record<string, number> {
  if (costOverrides !== undefined) return costOverrides ?? {};
  try {
    costOverrides = process.env.MODEL_COST_LIMITS
      ? (JSON.parse(process.env.MODEL_COST_LIMITS) as Record<string, number>)
      : null;
  } catch {
    costOverrides = null;
  }
  return costOverrides ?? {};
}

/** The monthly USD spend budget for a model. Env override wins. */
export function modelCostLimit(modelId: string): number {
  const o = modelCostOverrides();
  if (typeof o[modelId] === "number") return o[modelId];
  return DEFAULT_COST_LIMITS[modelId] ?? FALLBACK_COST_LIMIT;
}

/** Default monthly SPEND budget (USD) per provider. */
const DEFAULT_PROVIDER_COST_LIMITS: Record<ProviderId, number> = {
  anthropic: 100,
  openai: 60,
  google: 40,
  openrouter: 30,
  groq: 20,
  opensource: 20,
};

const FALLBACK_PROVIDER_COST_LIMIT = Number(
  process.env.PROVIDER_COST_LIMIT_DEFAULT ?? 50,
);

let providerCostOverrides: Record<string, number> | null | undefined;
function providerCostOverridesFn(): Record<string, number> {
  if (providerCostOverrides !== undefined) return providerCostOverrides ?? {};
  try {
    providerCostOverrides = process.env.PROVIDER_COST_LIMITS
      ? (JSON.parse(process.env.PROVIDER_COST_LIMITS) as Record<string, number>)
      : null;
  } catch {
    providerCostOverrides = null;
  }
  return providerCostOverrides ?? {};
}

/** The monthly USD spend budget for a provider. Env override wins. */
export function providerCostLimit(provider: ProviderId): number {
  const o = providerCostOverridesFn();
  if (typeof o[provider] === "number") return o[provider];
  return DEFAULT_PROVIDER_COST_LIMITS[provider] ?? FALLBACK_PROVIDER_COST_LIMIT;
}
