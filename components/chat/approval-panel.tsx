"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, SkipForward, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApprovalField, ClientApproval } from "@/lib/types";

type Props = {
  approval: ClientApproval;
  onApprove: (fields: ApprovalField[]) => void;
  onSkip: () => void;
};

export function ApprovalPanel({ approval, onApprove, onSkip }: Props) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<ApprovalField[]>(approval.fields);
  const [remaining, setRemaining] = useState(
    approval.timeoutSeconds ?? null,
  );

  const resolved = approval.status !== "pending";

  // Countdown → auto-skip on timeout.
  useEffect(() => {
    if (resolved || remaining === null) return;
    if (remaining <= 0) {
      onSkip();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => (r ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, resolved, onSkip]);

  if (resolved) {
    const approved = approval.status === "approved";
    return (
      <div
        className={cn(
          "mt-2 rounded-lg border px-3 py-2 text-sm",
          approved
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-border bg-muted text-muted-foreground",
        )}
      >
        {approved ? "✅ Approved" : "⏭️ Skipped"} — {approval.description}
      </div>
    );
  }

  function updateField(key: string, value: string) {
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value } : f)),
    );
  }

  return (
    <div className="mt-2 animate-fade-in rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            Approval needed: {approval.toolName}
          </p>
          <p className="text-xs text-muted-foreground">{approval.description}</p>
        </div>
        {remaining !== null && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums",
              remaining <= 10
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
          >
            {remaining}s
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-0.5 block text-xs font-medium text-muted-foreground">
              {f.label}
            </label>
            {editing ? (
              f.multiline ? (
                <textarea
                  value={f.value}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              ) : (
                <input
                  value={f.value}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              )
            ) : (
              <p className="whitespace-pre-wrap rounded-md bg-background/60 px-2 py-1.5 text-sm">
                {f.value}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onApprove(fields)}>
          <Check className="h-3.5 w-3.5" />
          {editing ? "Save & Approve" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing((e) => !e)}
        >
          <Pencil className="h-3.5 w-3.5" />
          {editing ? "Cancel edit" : "Edit"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onSkip}>
          <SkipForward className="h-3.5 w-3.5" />
          Skip
        </Button>
      </div>
    </div>
  );
}
