"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Step, StepStatus } from "@/lib/types";

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "success":
      return <Check className="h-3.5 w-3.5 text-emerald-500" />;
    case "failed":
      return <X className="h-3.5 w-3.5 text-destructive" />;
    case "in_progress":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    case "needs_approval":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

export function StepsList({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState(true);
  if (steps.length === 0) return null;

  return (
    <div className="mt-2.5 overflow-hidden rounded-xl border bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50"
      >
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Steps taken ({steps.filter((s) => s.status === "success").length}/
          {steps.length})
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ol className="space-y-1 border-t px-3 pb-2 pt-1.5">
          {steps.map((step, i) => (
            <li key={step.id} className="flex items-start gap-2 py-1 text-xs">
              <span className="mt-0.5">
                <StatusIcon status={step.status} />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[11px] leading-snug text-foreground">
                  {i + 1}. {step.action}
                </p>
                {step.detail && (
                  <p className="text-[11px] text-muted-foreground">
                    {step.detail}
                  </p>
                )}
                {step.error && (
                  <p className="text-[11px] text-destructive">{step.error}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
