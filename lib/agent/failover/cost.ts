import type { TokenUsage } from "./types";

/**
 * Rough USD cost estimation per model, in dollars per 1M tokens
 * (input, output). Used only for the cost-tracking metric shown alongside a
 * run - approximate by design. Unknown models contribute 0 so the accounting
 * never throws; extend the table as needed.
 */
const PRICING: Record<string, { in: number; out: number }> = {
  // Anthropic
  "claude-opus-4-8": { in: 15, out: 75 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 0.8, out: 4 },
  // OpenAI
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  // Google
  "gemini-2.0-flash": { in: 0.1, out: 0.4 },
  "gemini-1.5-pro": { in: 1.25, out: 5 },
  // OpenRouter / Groq open models (approximate)
  "or/hermes-3-405b": { in: 0.9, out: 0.9 },
  "or/hermes-3-70b": { in: 0.3, out: 0.3 },
  "or/llama-3.3-70b": { in: 0.12, out: 0.3 },
  "or/qwen-2.5-72b": { in: 0.3, out: 0.3 },
  "or/deepseek-v3": { in: 0.3, out: 0.9 },
  "or/mistral-large": { in: 2, out: 6 },
  "groq/llama-3.3-70b": { in: 0.59, out: 0.79 },
  "groq/llama-3.1-8b": { in: 0.05, out: 0.08 },
  "groq/deepseek-r1-70b": { in: 0.75, out: 0.99 },
  "groq/gemma2-9b": { in: 0.2, out: 0.2 },
};

/** Incremental cost in USD for one step's usage on a given model. */
export function estimateStepCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[modelId];
  if (!p) return 0;
  return (inputTokens / 1_000_000) * p.in + (outputTokens / 1_000_000) * p.out;
}

export function estimateUsageCost(modelId: string, usage: TokenUsage): number {
  return estimateStepCost(modelId, usage.inputTokens, usage.outputTokens);
}
