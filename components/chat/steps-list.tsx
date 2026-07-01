"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Circle,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOL_META } from "@/lib/types";
import type { Step, StepStatus } from "@/lib/types";

function StatusNode({ status }: { status: StepStatus }) {
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
      return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function pretty(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function CodeBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/40">
      <div className="border-b px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <pre className="max-h-56 overflow-auto px-2.5 py-2 text-[11px] leading-relaxed text-foreground/80">
        <code>{body}</code>
      </pre>
    </div>
  );
}

function StepRow({ step, last }: { step: Step; last: boolean }) {
  const [open, setOpen] = useState(false);
  const req = pretty(step.input);
  const res = pretty(step.output);
  const expandable = Boolean(req || res);
  const label = step.label ?? step.action;

  return (
    <li className="relative pl-6">
      {/* vertical connector to the next node */}
      {!last && (
        <span className="absolute left-[7px] top-5 -bottom-3 w-px bg-border" />
      )}
      <span className="absolute left-0 top-0.5">
        <StatusNode status={step.status} />
      </span>

      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        disabled={!expandable}
        className={cn(
          "flex w-full items-center gap-1.5 text-left text-[13px]",
          expandable && "cursor-pointer",
        )}
      >
        <span
          className={cn(
            "truncate",
            step.status === "in_progress"
              ? "text-muted-foreground"
              : "text-foreground",
          )}
        >
          {label}
        </span>
        {step.tool && (
          <span className="shrink-0 rounded border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {TOOL_META[step.tool].name}
          </span>
        )}
        {expandable && (
          <ChevronRight
            className={cn(
              "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
        )}
      </button>

      {step.detail && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{step.detail}</p>
      )}
      {step.error && (
        <p className="mt-0.5 text-[11px] text-destructive">{step.error}</p>
      )}

      {open && expandable && (
        <div className="mt-2 space-y-2">
          {req && <CodeBlock title="Request" body={req} />}
          {res && <CodeBlock title="Response" body={res} />}
        </div>
      )}
    </li>
  );
}

export function StepsList({ steps, done }: { steps: Step[]; done?: boolean }) {
  const [open, setOpen] = useState(true);
  if (steps.length === 0) return null;

  const finished = steps.filter((s) => s.status === "success").length;

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
        />
        Steps taken ({finished}/{steps.length})
      </button>

      {open && (
        <ol className="space-y-3 pl-1">
          {steps.map((s, i) => (
            <StepRow
              key={s.id}
              step={s}
              last={!done && i === steps.length - 1}
            />
          ))}
          {done && (
            <li className="relative pl-6">
              <span className="absolute left-0 top-0.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              </span>
              <span className="text-[13px] text-muted-foreground">Done</span>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
