import { describe, expect, it } from "vitest";
import { modelCostUsd, modelPrice } from "@/lib/ai/pricing";
import { toModelUsage } from "@/lib/ai/limits";

describe("modelCostUsd - exact USD from real token counts", () => {
  it("bills fresh input, cached input, and output at their own rates", () => {
    // Opus: in $15, cachedIn $1.5, out $75 per 1M.
    // 1M input of which 600k cached -> 400k fresh @15 + 600k cached @1.5 = 6 + 0.9
    // 200k output @75 = 15. Total = 21.9
    const cost = modelCostUsd("claude-opus-4-8", {
      inputTokens: 1_000_000,
      cachedInputTokens: 600_000,
      outputTokens: 200_000,
    });
    expect(cost).toBeCloseTo(21.9, 6);
  });

  it("treats cached as a subset of input (never over-counts)", () => {
    const p = modelPrice("gpt-4o-mini");
    // cached clamped to input; all-cached input costs the cached rate only.
    const cost = modelCostUsd("gpt-4o-mini", {
      inputTokens: 1_000_000,
      cachedInputTokens: 5_000_000, // absurd, must clamp to 1M
      outputTokens: 0,
    });
    expect(cost).toBeCloseTo(p.cachedIn, 6);
  });

  it("unknown model prices at 0 rather than throwing", () => {
    expect(modelCostUsd("does-not-exist", { inputTokens: 9, outputTokens: 9 })).toBe(0);
  });
});

describe("toModelUsage - exact cost + budget fields", () => {
  it("derives costUsd and dollar remaining from usage", () => {
    const u = toModelUsage({
      modelId: "claude-opus-4-8",
      label: "Claude Opus 4.8",
      provider: "anthropic",
      inputTokens: 1_000_000,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningTokens: 0,
      requests: 1,
    });
    expect(u.costUsd).toBeCloseTo(15, 6); // 1M fresh input @ $15
    expect(u.costLimit).toBeGreaterThan(0);
    expect(u.costRemaining).toBeCloseTo(u.costLimit - u.costUsd, 6);
    expect(u.cachedInputTokens).toBe(0);
  });
});
