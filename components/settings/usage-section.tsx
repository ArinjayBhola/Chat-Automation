"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UsageBar, formatTokens } from "@/components/chat/usage-bar";
import type { ProviderUsage } from "@/lib/ai/limits";

/**
 * Settings section: token usage this month grouped by PROVIDER. Each provider
 * shows its total used against the budget it offers, with a per-model
 * breakdown beneath. Counts are exact (real AI SDK token usage).
 */
export function UsageSection() {
  const [providers, setProviders] = useState<ProviderUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) return;
        const data: { providers: ProviderUsage[] } = await res.json();
        if (active) setProviders(data.providers ?? []);
      } catch {
        /* ignore */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Model usage
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tokens used this month per provider, against the budget each provider
          offers. Resets at the start of each month.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <BarChart3 className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No providers configured yet. Add a provider API key on the server
              to start tracking usage.
            </p>
          </div>
        ) : (
          providers.map((p) => (
            <div key={p.provider} className="rounded-xl border p-4">
              {/* Provider header + total */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.requests} {p.requests === 1 ? "request" : "requests"} ·{" "}
                    {formatTokens(p.inputTokens)} in / {formatTokens(p.outputTokens)}{" "}
                    out
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatTokens(p.totalTokens)}{" "}
                    <span className="font-normal text-muted-foreground">
                      / {formatTokens(p.limit)}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {p.percentUsed}% used · {formatTokens(p.remaining)} left
                  </p>
                </div>
              </div>
              <UsageBar percent={p.percentUsed} />

              {/* Per-model breakdown */}
              <div className="mt-3 divide-y rounded-lg border bg-card/40">
                {p.models.map((m) => (
                  <div key={m.modelId} className="space-y-1.5 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{m.label}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {formatTokens(m.totalTokens)} / {formatTokens(m.limit)}
                      </span>
                    </div>
                    <UsageBar percent={m.percentUsed} />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
