import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import { ExecutionState } from "@/lib/agent/failover/execution-state";

function baseInput(): ModelMessage[] {
  return [{ role: "user", content: "research task" }];
}

describe("ExecutionState working memory", () => {
  it("accumulates completed step messages so a new provider inherits them", () => {
    const s = new ExecutionState({ userId: "u1", input: baseInput() });
    expect(s.messages).toHaveLength(1);

    s.markProviderActive("groq", "groq/llama-3.3-70b");
    s.commitStep({
      provider: "groq",
      modelId: "groq/llama-3.3-70b",
      text: "",
      toolNames: ["gmail_search_emails"],
      messages: [
        { role: "assistant", content: "calling tool" },
        { role: "tool", content: "tool result" } as unknown as ModelMessage,
      ],
      inputTokens: 100,
      outputTokens: 20,
    });

    // input + 2 step messages; this is exactly what the next provider receives.
    expect(s.messages).toHaveLength(3);
    expect(s.stepCount).toBe(1);
    expect(s.tokenUsage.totalTokens).toBe(120);
  });

  it("commits text only from finished steps and tracks provider history", () => {
    const s = new ExecutionState({ userId: "u1", input: baseInput() });
    s.markProviderActive("groq", "groq/llama-3.3-70b");
    s.commitStep({
      provider: "groq",
      modelId: "groq/llama-3.3-70b",
      text: "Answer part.",
      toolNames: [],
      messages: [{ role: "assistant", content: "Answer part." }],
      inputTokens: 10,
      outputTokens: 5,
    });
    expect(s.committedText).toBe("Answer part.");
    expect(s.providerHistory).toHaveLength(1);
  });

  it("records failures with class and message and bumps retry count", () => {
    const s = new ExecutionState({ userId: "u1", input: baseInput() });
    s.recordFailure("groq", "groq/llama-3.3-70b", "rate_limit", "429");
    expect(s.failureHistory).toHaveLength(1);
    expect(s.failureHistory[0].class).toBe("rate_limit");
    expect(s.retryCount).toBe(1);
    expect(s.status).toBe("switched");
  });

  it("splits token + request usage by model across a failover run", () => {
    const s = new ExecutionState({ userId: "u1", input: baseInput() });

    // groq runs one step, then fails over to openai which runs one step.
    s.markProviderActive("groq", "groq/llama-3.3-70b");
    s.commitStep({
      provider: "groq",
      modelId: "groq/llama-3.3-70b",
      text: "",
      toolNames: [],
      messages: [{ role: "assistant", content: "a" }],
      inputTokens: 100,
      outputTokens: 20,
    });
    s.markProviderActive("openai", "gpt-4o");
    s.commitStep({
      provider: "openai",
      modelId: "gpt-4o",
      text: "done",
      toolNames: [],
      messages: [{ role: "assistant", content: "done" }],
      inputTokens: 200,
      outputTokens: 50,
    });

    const deltas = s.modelUsageDeltas;
    const groq = deltas.find((d) => d.modelId === "groq/llama-3.3-70b");
    const openai = deltas.find((d) => d.modelId === "gpt-4o");

    expect(groq).toMatchObject({
      provider: "groq",
      inputTokens: 100,
      outputTokens: 20,
      requests: 1,
    });
    expect(openai).toMatchObject({
      provider: "openai",
      inputTokens: 200,
      outputTokens: 50,
      requests: 1,
    });
    // total usage still aggregated correctly
    expect(s.tokenUsage.totalTokens).toBe(370);
  });

  it("round-trips through a checkpoint snapshot without losing state", () => {
    const s = new ExecutionState({ userId: "u1", input: baseInput() });
    s.markProviderActive("groq", "groq/llama-3.3-70b");
    s.commitStep({
      provider: "groq",
      modelId: "groq/llama-3.3-70b",
      text: "Hello.",
      toolNames: [],
      messages: [{ role: "assistant", content: "Hello." }],
      inputTokens: 30,
      outputTokens: 10,
    });
    s.recordFailure("groq", "groq/llama-3.3-70b", "rate_limit", "429");

    const snap = s.toSnapshot();
    const restored = ExecutionState.fromSnapshot(snap, baseInput());

    expect(restored.messages).toHaveLength(2); // input + 1 step message
    expect(restored.committedText).toBe("Hello.");
    expect(restored.stepCount).toBe(1);
    expect(restored.tokenUsage.totalTokens).toBe(40);
    expect(restored.failureHistory).toHaveLength(1);
    expect(restored.runId).toBe(s.runId);
  });
});
