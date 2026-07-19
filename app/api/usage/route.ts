import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { currentUsageWindow, getModelUsage, type UsageRow } from "@/lib/db-queries";
import { toModelUsage, toProviderUsage } from "@/lib/ai/limits";
import { listModels, type ProviderId } from "@/lib/ai/models";

const PROVIDER_ORDER: ProviderId[] = [
  "groq",
  "openrouter",
  "openai",
  "anthropic",
  "google",
  "opensource",
];

/**
 * GET /api/usage - the current user's usage this month, grouped BY PROVIDER.
 * Each provider carries its own budget and a per-model breakdown (every model
 * offered by a configured provider is listed, even at zero). Token counts come
 * from real AI SDK usage, so they are exact.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getModelUsage(session.user.id);
  const byModel = new Map<string, UsageRow>(rows.map((r) => [r.modelId, r]));

  // Only surface providers the user actually has configured (available models).
  const available = listModels().filter((m) => m.available);
  const grouped = new Map<ProviderId, typeof available>();
  for (const m of available) {
    const list = grouped.get(m.provider) ?? [];
    list.push(m);
    grouped.set(m.provider, list);
  }

  const providers = PROVIDER_ORDER.filter((p) => grouped.has(p)).map((p) => {
    const models = (grouped.get(p) ?? []).map((m) => {
      const u = byModel.get(m.id);
      return toModelUsage({
        modelId: m.id,
        label: m.label,
        provider: m.provider,
        inputTokens: u?.inputTokens ?? 0,
        outputTokens: u?.outputTokens ?? 0,
        cachedInputTokens: u?.cachedInputTokens ?? 0,
        reasoningTokens: u?.reasoningTokens ?? 0,
        requests: u?.requestCount ?? 0,
      });
    });
    // Heaviest-used models first within each provider.
    models.sort((a, b) => b.totalTokens - a.totalTokens);
    return toProviderUsage(p, models);
  });

  return NextResponse.json({
    windowStart: currentUsageWindow().toISOString(),
    providers,
  });
}
