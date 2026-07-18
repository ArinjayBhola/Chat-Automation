import { describe, expect, it } from "vitest";
import type { LanguageModel, ModelMessage } from "ai";
import { ExecutionEngine, type StreamFn } from "@/lib/agent/failover/execution-engine";
import { ExecutionState } from "@/lib/agent/failover/execution-state";
import { ProviderHealthMonitor } from "@/lib/agent/failover/health-monitor";
import { ProviderManager } from "@/lib/agent/failover/provider-manager";
import type { EngineEvent } from "@/lib/agent/failover/types";
import type { ModelInfo, ProviderId } from "@/lib/ai/models";

const providerOf = (id: string): ProviderId =>
  id.startsWith("groq/") ? "groq" : "openai";

function makeManager(health: ProviderHealthMonitor) {
  return new ProviderManager({
    health,
    configured: () => true,
    priority: () => ["groq", "openai"],
    failoverModelId: (p) => (p === "openai" ? "gpt-4o" : "groq/llama-3.3-70b"),
    getModelInfo: (id) => {
      if (id !== "groq/llama-3.3-70b") return undefined;
      return { id, label: id, provider: "groq", modelName: id } as ModelInfo;
    },
    resolveModel: async (id: string = "groq/llama-3.3-70b") => ({
      model: { modelId: id } as unknown as LanguageModel,
      info: { id, label: id, provider: providerOf(id), modelName: id } as ModelInfo,
    }),
  });
}

async function collect(gen: AsyncGenerator<EngineEvent>): Promise<EngineEvent[]> {
  const out: EngineEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("ExecutionEngine provider failover", () => {
  it("resumes on the next provider from accumulated work after a rate limit", async () => {
    const health = new ProviderHealthMonitor();
    const state = new ExecutionState({
      userId: "u1",
      input: [{ role: "user", content: "do the thing" }],
    });

    // Capture the messages each provider is asked to continue from.
    const seenMessages: Record<string, ModelMessage[]> = {};

    const streamFn: StreamFn = (o) => {
      seenMessages[o.provider] = o.messages;

      if (o.provider === "groq") {
        // Completes one tool step, streams a partial answer, then dies (429).
        async function* g(): AsyncIterable<Record<string, unknown>> {
          o.onStepFinish({
            provider: "groq",
            modelId: o.modelId,
            text: "",
            toolNames: ["gmail_search_emails"],
            messages: [
              { role: "assistant", content: "search" } as ModelMessage,
              { role: "tool", content: "results" } as unknown as ModelMessage,
            ],
            inputTokens: 100,
            outputTokens: 20,
          });
          yield { type: "tool-call", toolCallId: "c1", toolName: "gmail_search_emails", input: {} };
          yield { type: "tool-result", toolCallId: "c1", output: { ok: true } };
          yield { type: "text-delta", text: "Here is the half-fin" };
          yield { type: "error", error: new Error("HTTP 429 rate limit exceeded") };
        }
        return { fullStream: g() };
      }

      // openai takeover: finishes cleanly.
      async function* g2(): AsyncIterable<Record<string, unknown>> {
        o.onStepFinish({
          provider: "openai",
          modelId: o.modelId,
          text: "Final answer.",
          toolNames: [],
          messages: [{ role: "assistant", content: "Final answer." } as ModelMessage],
          inputTokens: 200,
          outputTokens: 50,
        });
        yield { type: "text-delta", text: "Final answer." };
      }
      return { fullStream: g2() };
    };

    const engine = new ExecutionEngine({
      state,
      requestedModelId: "groq/llama-3.3-70b",
      system: "sys",
      tools: {},
      providerManager: makeManager(health),
      health,
      streamFn,
    });

    const events = await collect(engine.run());

    // 1. Both providers announced; the switch is reported.
    const providerEvents = events.filter((e) => e.kind === "provider");
    expect(providerEvents.map((e) => (e.kind === "provider" ? e.provider : ""))).toEqual([
      "groq",
      "openai",
    ]);
    expect(providerEvents[0].kind === "provider" && providerEvents[0].status).toBe("active");
    expect(providerEvents[1].kind === "provider" && providerEvents[1].status).toBe("switched");

    // 2. The dead provider's uncommitted text was reset.
    expect(events.some((e) => e.kind === "reset")).toBe(true);

    // 3. No error surfaced; the run completed with a usage event.
    expect(events.some((e) => e.kind === "error")).toBe(false);
    expect(events.some((e) => e.kind === "usage")).toBe(true);

    // 4. openai continued FROM groq's completed work (no restart): its input
    //    already contained the base message + groq's 2 committed step messages.
    expect(seenMessages.groq).toHaveLength(1);
    expect(seenMessages.openai).toHaveLength(3);

    // 5. Final state: both steps committed, correct text, tokens summed, one failure.
    expect(state.stepCount).toBe(2);
    expect(state.committedText).toBe("Final answer.");
    expect(state.tokenUsage.totalTokens).toBe(370);
    expect(state.failureHistory).toHaveLength(1);
    expect(state.failureHistory[0].class).toBe("rate_limit");
    expect(state.status).toBe("completed");

    // groq's circuit opened on the rate limit; openai stayed healthy.
    expect(health.isHealthy("groq")).toBe(false);
    expect(health.isHealthy("openai")).toBe(true);
  });

  it("surfaces a fatal (non-retryable) error without switching providers", async () => {
    const health = new ProviderHealthMonitor();
    const state = new ExecutionState({
      userId: "u1",
      input: [{ role: "user", content: "x" }],
    });
    const attempted: string[] = [];
    const streamFn: StreamFn = (o) => {
      attempted.push(o.provider);
      async function* g(): AsyncIterable<Record<string, unknown>> {
        yield { type: "error", error: new Error("400 invalid tool schema") };
      }
      return { fullStream: g() };
    };

    const engine = new ExecutionEngine({
      state,
      requestedModelId: "groq/llama-3.3-70b",
      system: "sys",
      tools: {},
      providerManager: makeManager(health),
      health,
      streamFn,
    });

    const events = await collect(engine.run());
    expect(events.some((e) => e.kind === "error")).toBe(true);
    // fatal error must not trigger a failover attempt on openai
    expect(attempted).toEqual(["groq"]);
    expect(state.status).toBe("failed");
  });

  it("emits a clear error when no provider is configured", async () => {
    const health = new ProviderHealthMonitor();
    const manager = new ProviderManager({
      health,
      configured: () => false,
      priority: () => ["groq", "openai"],
      failoverModelId: () => null,
      getModelInfo: () => undefined,
    });
    const state = new ExecutionState({
      userId: "u1",
      input: [{ role: "user", content: "x" }],
    });
    const engine = new ExecutionEngine({
      state,
      requestedModelId: "groq/llama-3.3-70b",
      system: "sys",
      tools: {},
      providerManager: manager,
      health,
      streamFn: () => ({ fullStream: (async function* () {})() }),
    });
    const events = await collect(engine.run());
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("error");
  });
});
