import type { TokenUsage } from "./types";
import { modelCostUsd } from "../../ai/pricing";

/**
 * USD cost accounting for a run. Prices live in the canonical `lib/ai/pricing`
 * table (shared with the usage bars); this module is the failover-side adapter.
 * Counts are exact; the dollar figure is exact given the list prices there.
 */

/** Incremental cost in USD for one step's usage on a given model. */
export function estimateStepCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0,
): number {
  return modelCostUsd(modelId, { inputTokens, outputTokens, cachedInputTokens });
}

export function estimateUsageCost(modelId: string, usage: TokenUsage): number {
  return estimateStepCost(modelId, usage.inputTokens, usage.outputTokens);
}
