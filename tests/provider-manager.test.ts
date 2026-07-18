import { describe, expect, it } from "vitest";
import { ProviderManager } from "@/lib/agent/failover/provider-manager";
import { ProviderHealthMonitor } from "@/lib/agent/failover/health-monitor";
import type { ModelInfo, ProviderId } from "@/lib/ai/models";

function mgr(configured: ProviderId[]) {
  const set = new Set(configured);
  return new ProviderManager({
    health: new ProviderHealthMonitor(),
    configured: (p) => set.has(p),
    priority: () => ["groq", "openrouter", "openai", "anthropic", "google"],
    failoverModelId: (p) =>
      ({
        groq: "groq/llama-3.3-70b",
        openrouter: "or/llama-3.3-70b",
        openai: "gpt-4o",
        anthropic: "claude-sonnet-4-6",
        google: "gemini-2.0-flash",
        opensource: null,
      })[p],
    getModelInfo: (id) => {
      const map: Record<string, ProviderId> = {
        "claude-opus-4-8": "anthropic",
        "groq/llama-3.3-70b": "groq",
        "gpt-4o": "openai",
      };
      const provider = map[id];
      if (!provider) return undefined;
      return { id, label: id, provider, modelName: id } as ModelInfo;
    },
  });
}

describe("ProviderManager.buildChain", () => {
  it("leads with the requested model, then other configured providers by priority", () => {
    const chain = mgr(["groq", "openai", "anthropic"]).buildChain(
      "groq/llama-3.3-70b",
    );
    expect(chain.map((c) => c.provider)).toEqual(["groq", "openai", "anthropic"]);
    // requested model id preserved as the first candidate
    expect(chain[0].modelId).toBe("groq/llama-3.3-70b");
  });

  it("skips unconfigured providers", () => {
    const chain = mgr(["groq", "anthropic"]).buildChain("groq/llama-3.3-70b");
    expect(chain.map((c) => c.provider)).toEqual(["groq", "anthropic"]);
  });

  it("dedupes the requested provider from the priority tail", () => {
    const chain = mgr(["openai", "groq"]).buildChain("gpt-4o");
    // openai leads (requested); groq follows; openai not repeated
    expect(chain.map((c) => c.provider)).toEqual(["openai", "groq"]);
  });

  it("falls back to priority order when the requested provider is unconfigured", () => {
    // requested anthropic model, but anthropic not configured
    const chain = mgr(["groq", "openai"]).buildChain("claude-opus-4-8");
    expect(chain.map((c) => c.provider)).toEqual(["groq", "openai"]);
  });

  it("returns an empty chain when nothing is configured", () => {
    expect(mgr([]).buildChain("groq/llama-3.3-70b")).toEqual([]);
  });
});
