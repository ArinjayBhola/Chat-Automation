/**
 * Catalogue of selectable models across providers.
 *
 * A model is "available" when its provider's credentials are present in the
 * environment. The UI shows availability so users can pick a model the server
 * can actually run; if none is configured the chat route asks the user to add
 * a provider key.
 *
 * Open-source / open-weight models are served through OpenAI-COMPATIBLE cloud
 * gateways (OpenRouter, Groq, or a custom gateway) — never local/Ollama, since
 * this app is built to be deployed to the cloud.
 */

export type ProviderId =
  | "anthropic"
  | "openai"
  | "google"
  | "openrouter"
  | "groq"
  | "opensource";

export type ModelInfo = {
  id: string; // stable id used across the app + persisted with messages
  label: string; // human label for the picker
  provider: ProviderId;
  /** Provider-native model id passed to the SDK (may differ from `id`). */
  modelName: string;
  description?: string;
};

const STATIC_MODELS: ModelInfo[] = [
  // ---- Anthropic (Claude) --------------------------------------------------
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    provider: "anthropic",
    modelName: "claude-opus-4-8",
    description: "Most capable; best for complex multi-step orchestration.",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    modelName: "claude-sonnet-4-6",
    description: "Strong balance of speed and capability.",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    modelName: "claude-haiku-4-5-20251001",
    description: "Fast and economical for simpler tasks.",
  },
  // ---- OpenAI --------------------------------------------------------------
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    modelName: "gpt-4o",
    description: "OpenAI flagship multimodal model.",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "openai",
    modelName: "gpt-4o-mini",
    description: "Fast, low-cost OpenAI model.",
  },
  // ---- Google Gemini -------------------------------------------------------
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "google",
    modelName: "gemini-2.0-flash",
    description: "Fast Google model with strong tool use.",
  },
  {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    provider: "google",
    modelName: "gemini-1.5-pro",
    description: "Large-context Google model.",
  },
  // ---- OpenRouter (open models, OpenAI-compatible) -------------------------
  {
    id: "or/hermes-3-405b",
    label: "Hermes 3 405B",
    provider: "openrouter",
    modelName: "nousresearch/hermes-3-llama-3.1-405b",
    description: "Nous Research Hermes 3 — strong agentic/instruction model.",
  },
  {
    id: "or/hermes-3-70b",
    label: "Hermes 3 70B",
    provider: "openrouter",
    modelName: "nousresearch/hermes-3-llama-3.1-70b",
    description: "Lighter Hermes 3 for faster agent runs.",
  },
  {
    id: "or/llama-3.3-70b",
    label: "Llama 3.3 70B",
    provider: "openrouter",
    modelName: "meta-llama/llama-3.3-70b-instruct",
    description: "Meta Llama 3.3 70B Instruct.",
  },
  {
    id: "or/qwen-2.5-72b",
    label: "Qwen 2.5 72B",
    provider: "openrouter",
    modelName: "qwen/qwen-2.5-72b-instruct",
    description: "Alibaba Qwen 2.5 72B — strong tool use.",
  },
  {
    id: "or/deepseek-v3",
    label: "DeepSeek V3",
    provider: "openrouter",
    modelName: "deepseek/deepseek-chat",
    description: "DeepSeek V3 chat model.",
  },
  {
    id: "or/mistral-large",
    label: "Mistral Large",
    provider: "openrouter",
    modelName: "mistralai/mistral-large",
    description: "Mistral's flagship open-weight model.",
  },
  // ---- Groq (ultra-fast inference, OpenAI-compatible) ----------------------
  {
    id: "groq/llama-3.3-70b",
    label: "Llama 3.3 70B · Groq",
    provider: "groq",
    modelName: "llama-3.3-70b-versatile",
    description: "Llama 3.3 70B on Groq — very low latency.",
  },
  {
    id: "groq/llama-3.1-8b",
    label: "Llama 3.1 8B · Groq",
    provider: "groq",
    modelName: "llama-3.1-8b-instant",
    description: "Fast, cheap 8B model on Groq.",
  },
  {
    id: "groq/deepseek-r1-70b",
    label: "DeepSeek R1 Distill 70B · Groq",
    provider: "groq",
    modelName: "deepseek-r1-distill-llama-70b",
    description: "Reasoning-distilled Llama 70B on Groq.",
  },
  {
    id: "groq/gemma2-9b",
    label: "Gemma2 9B · Groq",
    provider: "groq",
    modelName: "gemma2-9b-it",
    description: "Google Gemma2 9B on Groq.",
  },
];

/** Extra models exposed by a custom OpenAI-compatible gateway, from env. */
function opensourceModels(): ModelInfo[] {
  const raw = process.env.OPENSOURCE_MODELS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((modelName) => ({
      id: `oss:${modelName}`,
      label: modelName.split("/").pop() ?? modelName,
      provider: "opensource" as const,
      modelName,
      description: "Custom open-source model via your gateway.",
    }));
}

export function providerConfigured(provider: ProviderId): boolean {
  switch (provider) {
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY);
    case "google":
      return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    case "openrouter":
      return Boolean(process.env.OPENROUTER_API_KEY);
    case "groq":
      return Boolean(process.env.GROQ_API_KEY);
    case "opensource":
      return Boolean(
        process.env.OPENSOURCE_BASE_URL && process.env.OPENSOURCE_API_KEY,
      );
  }
}

export function allModels(): ModelInfo[] {
  return [...STATIC_MODELS, ...opensourceModels()];
}

export type ModelChoice = ModelInfo & { available: boolean };

export function listModels(): ModelChoice[] {
  return allModels().map((m) => ({
    ...m,
    available: providerConfigured(m.provider),
  }));
}

export function getModelInfo(id: string): ModelInfo | undefined {
  return allModels().find((m) => m.id === id);
}

export const DEFAULT_MODEL_ID = process.env.DEFAULT_MODEL || "claude-opus-4-8";

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  google: "Gemini",
  openrouter: "OpenRouter",
  groq: "Groq",
  opensource: "Custom gateway",
};

/** Whether any provider has credentials; if false the agent can't run. */
export function anyProviderConfigured(): boolean {
  return ALL_PROVIDERS.some(providerConfigured);
}

export const ALL_PROVIDERS: ProviderId[] = [
  "anthropic",
  "openai",
  "google",
  "openrouter",
  "groq",
  "opensource",
];

/**
 * Default order in which providers are tried during failover, highest
 * priority first. Overridable with `PROVIDER_FAILOVER_ORDER` (comma-separated
 * provider ids). Unknown ids are ignored; providers omitted from the env value
 * are appended in their default order so nothing configured is ever unreachable.
 */
export function providerPriority(): ProviderId[] {
  const raw = process.env.PROVIDER_FAILOVER_ORDER;
  const fallbackDefault: ProviderId[] = [
    "groq",
    "openrouter",
    "openai",
    "anthropic",
    "google",
    "opensource",
  ];
  if (!raw) return fallbackDefault;
  const wanted = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ProviderId => ALL_PROVIDERS.includes(s as ProviderId));
  const seen = new Set(wanted);
  return [...wanted, ...fallbackDefault.filter((p) => !seen.has(p))];
}

/**
 * The representative model id to use when failing over TO a given provider (we
 * cannot reuse the requested model id because it is provider-specific). Picks a
 * strong, agent-capable default per provider. `opensource` is resolved at
 * runtime from the gateway's configured model list.
 */
export function failoverModelId(provider: ProviderId): string | null {
  switch (provider) {
    case "anthropic":
      return "claude-sonnet-4-6";
    case "openai":
      return "gpt-4o";
    case "google":
      return "gemini-2.0-flash";
    case "openrouter":
      return "or/llama-3.3-70b";
    case "groq":
      return "groq/llama-3.3-70b";
    case "opensource": {
      const oss = opensourceModels()[0];
      return oss?.id ?? null;
    }
  }
}
