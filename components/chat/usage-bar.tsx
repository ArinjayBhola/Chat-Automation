"use client";

import { cn } from "@/lib/utils";

/** Compact token formatter: 1_234_567 -> "1.2M", 12_300 -> "12.3K". */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

/** Solid bar color by fill level (no gradients per project UI rules). */
function barColor(pct: number): string {
  if (pct >= 90) return "bg-destructive";
  if (pct >= 70) return "bg-amber-500";
  return "bg-primary";
}

/**
 * A thin horizontal meter showing tokens used against a limit. Used inline in
 * the model dropdown and in the usage tracker popover.
 */
export function UsageBar({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("w-full", className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
