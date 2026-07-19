"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UsageBar, formatTokens, formatUsd } from "@/components/chat/usage-bar";
import type { ProviderUsage } from "@/lib/ai/limits";
import { modelPrice } from "@/lib/ai/pricing";

/**
 * Settings entry for usage. Shows a compact card; the actual data (spend,
 * tokens, and per-model pricing) lives in a modal opened by "Check usage",
 * Claude-style, so it doesn't clutter the settings page.
 */
export function UsageSection() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Usage &amp; billing
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Exact spend, token counts, and model pricing for this month.
          </p>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
            <BarChart3 className="h-4 w-4" />
            Check usage
          </Button>
        </CardContent>
      </Card>

      <UsageDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * Modal with the full usage + pricing breakdown, grouped by provider. Fetches
 * fresh each time it opens. Escape or a backdrop click closes it. Counts and
 * cost are exact (real AI SDK token usage priced at list rates).
 */
function UsageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [providers, setProviders] = useState<ProviderUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowStart, setWindowStart] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/usage");
      if (!res.ok) return;
      const data: { providers: ProviderUsage[]; windowStart?: string } =
        await res.json();
      setProviders(data.providers ?? []);
      setWindowStart(data.windowStart ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Lock the page behind the modal so only the modal body scrolls.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, load, onClose]);

  if (!open || !mounted) return null;

  const monthLabel = windowStart
    ? new Date(windowStart).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Usage and pricing"
    >
      <div
        className="absolute inset-0 bg-foreground/10 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl animate-fade-in flex-col overflow-hidden rounded-2xl border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Usage &amp; pricing
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {monthLabel ? `${monthLabel} · ` : ""}Exact spend and tokens
              against each provider&apos;s monthly budget. Resets each month.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            className="shrink-0 text-muted-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-thin px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-lg bg-muted/60"
                />
              ))}
            </div>
          ) : providers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No providers configured yet. Add a provider API key on the
                server to start tracking usage.
              </p>
            </div>
          ) : (
            providers.map((p) => (
              <div key={p.provider} className="rounded-xl border p-4">
                {/* Provider header: exact spend against the dollar budget */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.requests} {p.requests === 1 ? "request" : "requests"} ·{" "}
                      {formatTokens(p.totalTokens)} tokens
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatUsd(p.costUsd)}{" "}
                      <span className="font-normal text-muted-foreground">
                        / {formatUsd(p.costLimit)}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {p.costPercentUsed}% used · {formatUsd(p.costRemaining)}{" "}
                      left
                    </p>
                  </div>
                </div>
                <UsageBar percent={p.costPercentUsed} />
                <TokenBreakdown
                  input={p.inputTokens}
                  output={p.outputTokens}
                  cached={p.cachedInputTokens}
                  reasoning={p.reasoningTokens}
                />

                {/* Per-model breakdown with pricing */}
                <div className="mt-3 divide-y rounded-lg border bg-card/40">
                  {p.models.map((m) => {
                    const price = modelPrice(m.modelId);
                    return (
                      <div key={m.modelId} className="space-y-1.5 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm">{m.label}</span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {formatUsd(m.costUsd)} / {formatUsd(m.costLimit)}
                          </span>
                        </div>
                        <UsageBar percent={m.costPercentUsed} />
                        <TokenBreakdown
                          input={m.inputTokens}
                          output={m.outputTokens}
                          cached={m.cachedInputTokens}
                          reasoning={m.reasoningTokens}
                        />
                        <p className="text-[11px] tabular-nums text-muted-foreground/80">
                          Rate: ${price.in}/M in · ${price.cachedIn}/M cached · $
                          {price.out}/M out
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Exact token split: input (with cached subset), output (with reasoning). */
function TokenBreakdown({
  input,
  output,
  cached,
  reasoning,
}: {
  input: number;
  output: number;
  cached: number;
  reasoning: number;
}) {
  return (
    <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
      {formatTokens(input)} in
      {cached > 0 ? ` (${formatTokens(cached)} cached)` : ""} ·{" "}
      {formatTokens(output)} out
      {reasoning > 0 ? ` (${formatTokens(reasoning)} reasoning)` : ""}
    </p>
  );
}
