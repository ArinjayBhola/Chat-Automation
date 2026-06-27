/**
 * Catalogue of selectable models across providers.
 *
 * A model is "available" when its provider's credentials are present in the
 * environment. The UI shows availability so users can pick a model the server
 * can actually run; unavailable picks fall back to demo (mock) responses.
 *
 * Open-source models are served through an OpenAI-COMPATIBLE cloud gateway
 * (OpenRouter / Groq / Together / Fireworks, etc.) — never local/Ollama, since
 * this app is meant to be deployed to the cloud.
 */

export type ProviderId = "anthropic" | "openai" | "google" | "opensource";

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
];

/** Models exposed by the configured open-source gateway, from env. */
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
      description: "Open-source model via cloud gateway.",
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

/** Whether any provider has credentials; if false the agent runs in mock mode. */
export function anyProviderConfigured(): boolean {
  return (
    providerConfigured("anthropic") ||
    providerConfigured("openai") ||
    providerConfigured("google") ||
    providerConfigured("opensource")
  );
}
