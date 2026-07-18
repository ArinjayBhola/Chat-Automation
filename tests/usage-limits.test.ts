import { afterEach, describe, expect, it, vi } from "vitest";
import { toModelUsage, toProviderUsage } from "@/lib/ai/limits";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("toModelUsage", () => {
  it("computes total, remaining, and percent against the budget", () => {
    const u = toModelUsage({
      modelId: "claude-opus-4-8", // default budget 1,000,000
      label: "Claude Opus 4.8",
      provider: "anthropic",
      inputTokens: 300_000,
      outputTokens: 100_000,
      requests: 5,
    });
    expect(u.totalTokens).toBe(400_000);
    expect(u.limit).toBe(1_000_000);
    expect(u.remaining).toBe(600_000);
    expect(u.percentUsed).toBe(40);
    expect(u.requests).toBe(5);
  });

  it("clamps percent at 100 and remaining at 0 when over budget", () => {
    const u = toModelUsage({
      modelId: "gpt-4o", // budget 1,000,000
      label: "GPT-4o",
      provider: "openai",
      inputTokens: 900_000,
      outputTokens: 400_000,
      requests: 2,
    });
    expect(u.totalTokens).toBe(1_300_000);
    expect(u.remaining).toBe(0);
    expect(u.percentUsed).toBe(100);
  });

  it("uses the fallback budget for unknown models", () => {
    const u = toModelUsage({
      modelId: "some/unknown-model",
      label: "Unknown",
      provider: "openrouter",
      inputTokens: 0,
      outputTokens: 0,
      requests: 0,
    });
    expect(u.limit).toBe(1_000_000); // FALLBACK_LIMIT default
    expect(u.percentUsed).toBe(0);
  });
});

describe("toProviderUsage", () => {
  it("sums a provider's models and measures against the provider budget", () => {
    const models = [
      toModelUsage({
        modelId: "groq/llama-3.3-70b",
        label: "Llama 3.3 70B",
        provider: "groq",
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        requests: 3,
      }),
      toModelUsage({
        modelId: "groq/llama-3.1-8b",
        label: "Llama 3.1 8B",
        provider: "groq",
        inputTokens: 400_000,
        outputTokens: 100_000,
        requests: 2,
      }),
    ];
    const p = toProviderUsage("groq", models);
    expect(p.totalTokens).toBe(2_000_000); // 1.5M + 0.5M
    expect(p.requests).toBe(5);
    expect(p.limit).toBe(20_000_000); // default groq budget
    expect(p.percentUsed).toBe(10);
    expect(p.remaining).toBe(18_000_000);
    expect(p.models).toHaveLength(2);
  });
});

describe("modelLimit env override", () => {
  it("honors MODEL_TOKEN_LIMITS JSON for a specific model", async () => {
    vi.stubEnv("MODEL_TOKEN_LIMITS", JSON.stringify({ "gpt-4o": 250_000 }));
    // Re-import so the module reads the stubbed env fresh.
    const { modelLimit } = await import("@/lib/ai/limits");
    expect(modelLimit("gpt-4o")).toBe(250_000);
  });
});
