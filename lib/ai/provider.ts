import "server-only";
import type { LanguageModel } from "ai";
import {
  DEFAULT_MODEL_ID,
  getModelInfo,
  providerConfigured,
  type ModelInfo,
} from "./models";

/**
 * Resolves a model id to a Vercel AI SDK LanguageModel from the right provider.
 *
 * Providers are imported lazily so the app builds/runs even if a given
 * provider package or its credentials are absent. Returns `null` when the
 * requested model's provider isn't configured — the chat route then tells the
 * user to configure a provider key.
 */
export async function resolveModel(
  modelId: string = DEFAULT_MODEL_ID,
): Promise<{ model: LanguageModel; info: ModelInfo } | null> {
  const info = getModelInfo(modelId) ?? getModelInfo(DEFAULT_MODEL_ID);
  if (!info) return null;
  if (!providerConfigured(info.provider)) return null;

  switch (info.provider) {
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      return { model: anthropic(info.modelName), info };
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      return { model: openai(info.modelName), info };
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return { model: google(info.modelName), info };
    }
    case "openrouter": {
      const { createOpenAICompatible } = await import(
        "@ai-sdk/openai-compatible"
      );
      const openrouter = createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        headers: {
          "HTTP-Referer": process.env.NEXTAUTH_URL ?? "https://relay.app",
          "X-Title": "Relay",
        },
      });
      return { model: openrouter(info.modelName), info };
    }
    case "groq": {
      const { createOpenAICompatible } = await import(
        "@ai-sdk/openai-compatible"
      );
      const groq = createOpenAICompatible({
        name: "groq",
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: process.env.GROQ_API_KEY,
      });
      return { model: groq(info.modelName), info };
    }
    case "opensource": {
      const { createOpenAICompatible } = await import(
        "@ai-sdk/openai-compatible"
      );
      const gateway = createOpenAICompatible({
        name: "opensource-gateway",
        baseURL: process.env.OPENSOURCE_BASE_URL!,
        apiKey: process.env.OPENSOURCE_API_KEY,
      });
      return { model: gateway(info.modelName), info };
    }
  }
}
