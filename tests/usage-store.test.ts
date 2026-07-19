import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getModelUsage, incrementModelUsage } from "@/lib/db-queries";

// No DATABASE_URL in the test env, so these exercise the in-memory fallback -
// the path that makes usage visible in dev before a DB is provisioned.
describe("model usage in-memory fallback (no DB)", () => {
  it("records and accumulates per-model usage for the current window", async () => {
    const userId = randomUUID();
    await incrementModelUsage(userId, [
      {
        modelId: "groq/llama-3.3-70b",
        provider: "groq",
        inputTokens: 100,
        outputTokens: 20,
        requests: 1,
      },
    ]);

    let rows = await getModelUsage(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      modelId: "groq/llama-3.3-70b",
      provider: "groq",
      totalTokens: 120,
      requestCount: 1,
    });

    // A second run for the same model accumulates rather than replacing.
    await incrementModelUsage(userId, [
      {
        modelId: "groq/llama-3.3-70b",
        provider: "groq",
        inputTokens: 200,
        outputTokens: 30,
        requests: 1,
      },
    ]);
    rows = await getModelUsage(userId);
    expect(rows[0].totalTokens).toBe(350);
    expect(rows[0].requestCount).toBe(2);
  });

  it("keeps distinct models separate and isolates users", async () => {
    const userId = randomUUID();
    await incrementModelUsage(userId, [
      { modelId: "groq/llama-3.1-8b", provider: "groq", inputTokens: 10, outputTokens: 5, requests: 1 },
      { modelId: "gpt-4o", provider: "openai", inputTokens: 40, outputTokens: 10, requests: 1 },
    ]);
    const rows = await getModelUsage(userId);
    expect(rows).toHaveLength(2);

    // A different user sees nothing from the above.
    expect(await getModelUsage(randomUUID())).toEqual([]);
  });

  it("accumulates cached-input and reasoning token subsets exactly", async () => {
    const userId = randomUUID();
    await incrementModelUsage(userId, [
      {
        modelId: "claude-opus-4-8",
        provider: "anthropic",
        inputTokens: 1000,
        outputTokens: 400,
        cachedInputTokens: 600,
        reasoningTokens: 100,
        requests: 1,
      },
    ]);
    await incrementModelUsage(userId, [
      {
        modelId: "claude-opus-4-8",
        provider: "anthropic",
        inputTokens: 500,
        outputTokens: 200,
        cachedInputTokens: 400,
        reasoningTokens: 50,
        requests: 1,
      },
    ]);
    const [row] = await getModelUsage(userId);
    expect(row).toMatchObject({
      inputTokens: 1500,
      outputTokens: 600,
      cachedInputTokens: 1000,
      reasoningTokens: 150,
      totalTokens: 2100,
      requestCount: 2,
    });
  });
});
