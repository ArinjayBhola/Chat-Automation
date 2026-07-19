"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Pencil,
  SkipForward,
  Mail,
  Calendar,
  FileText,
  NotebookText,
  ShieldAlert,
  X,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApprovalField, ClientApproval } from "@/lib/types";

type Props = {
  approval: ClientApproval;
  onApprove: (fields: ApprovalField[]) => void;
  onSkip: () => void;
};

type Accent = {
  icon: LucideIcon;
  verb: string;
  /** Tailwind classes for the icon badge (bg + text). */
  badge: string;
};

// Map the write op (preferred) or coarse actionType to an icon, a human verb,
// and a tool-colored badge so each approval reads at a glance.
function accentFor(approval: ClientApproval): Accent {
  const byOp: Record<string, Accent> = {
    "gmail.send": { icon: Mail, verb: "Send email", badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
    "calendar.create": { icon: Calendar, verb: "Create calendar event", badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
    "docs.create": { icon: FileText, verb: "Create document", badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
    "docs.append": { icon: FileText, verb: "Append to document", badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
    "notion.create": { icon: NotebookText, verb: "Create Notion page", badge: "bg-foreground/10 text-foreground" },
    "notion.update": { icon: NotebookText, verb: "Update Notion page", badge: "bg-foreground/10 text-foreground" },
  };
  if (approval.op && byOp[approval.op]) return byOp[approval.op];

  const byType: Record<string, Accent> = {
    send_email: byOp["gmail.send"],
    create_event: byOp["calendar.create"],
    update_doc: byOp["docs.append"],
    create_notion_page: byOp["notion.create"],
  };
  return (
    byType[approval.actionType] ?? {
      icon: ShieldAlert,
      verb: "Confirm action",
      badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    }
  );
}

export function ApprovalPanel({ approval, onApprove, onSkip }: Props) {
  const [editing, setEditing] = useState(() =>
    approval.fields.some((f) => !f.value),
  );
  const [fields, setFields] = useState<ApprovalField[]>(approval.fields);

  // Countdown only when nothing needs a manual pick.
  const hasChoice = approval.fields.some((f) => f.options);
  const initial = useRef(hasChoice ? null : approval.timeoutSeconds ?? null);
  const [remaining, setRemaining] = useState<number | null>(initial.current);

  const resolved = approval.status !== "pending";
  const accent = useMemo(() => accentFor(approval), [approval]);
  const Icon = accent.icon;

  // Selectable (picker) fields are required — block approve until one is chosen.
  const missingSelection = fields.some((f) => f.options && !f.value);

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

  // Ctrl/Cmd+Enter approves (skips the timeout race).
  useEffect(() => {
    if (resolved) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !missingSelection) {
        e.preventDefault();
        onApprove(fields);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resolved, missingSelection, fields, onApprove]);

  if (resolved) {
    const approved = approval.status === "approved";
    return (
      <div
        className={cn(
          "mt-3 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm",
          approved
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-border bg-muted/50 text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            approved ? "bg-emerald-500/20" : "bg-muted-foreground/15",
          )}
        >
          {approved ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <SkipForward className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">
            {approved ? "Approved" : "Skipped"}
          </span>
          <span className="text-muted-foreground"> - {accent.verb}</span>
        </span>
      </div>
    );
  }

  function updateField(key: string, value: string) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
  }

  const total = initial.current;
  const urgent = remaining !== null && remaining <= 10;

  return (
    <div className="mt-3 animate-fade-in overflow-hidden rounded-xl border border-amber-500/40 bg-card shadow-sm">
      {/* Countdown progress rail. */}
      {remaining !== null && total ? (
        <div className="h-0.5 w-full bg-muted">
          <div
            className={cn(
              "h-full transition-all duration-1000 ease-linear",
              urgent ? "bg-destructive" : "bg-amber-500",
            )}
            style={{ width: `${Math.max(0, (remaining / total) * 100)}%` }}
          />
        </div>
      ) : null}

      {/* Header. */}
      <div className="flex items-start gap-3 border-b border-border/60 bg-muted/30 px-4 py-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            accent.badge,
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Approval needed
          </p>
          <p className="text-sm font-semibold leading-tight">{accent.verb}</p>
          <p className="truncate text-xs text-muted-foreground">
            {approval.description}
          </p>
        </div>
        {remaining !== null && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
              urgent
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
          >
            {remaining}s
          </span>
        )}
      </div>

      {/* Fields. */}
      <div className="space-y-3 px-4 py-3">
        {fields.map((f) => {
          const display =
            f.options?.find((o) => o.value === f.value)?.label ?? f.value;

          if (editing) {
            return (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {f.label}
                </label>
                {f.options ? (
                  <select
                    value={f.value}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    className="w-full rounded-lg border bg-background px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="" disabled>
                      Select an option...
                    </option>
                    {f.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : f.multiline ? (
                  <textarea
                    value={f.value}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    rows={4}
                    className="w-full resize-y rounded-lg border bg-background px-2.5 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                ) : (
                  <input
                    value={f.value}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    className="w-full rounded-lg border bg-background px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                )}
              </div>
            );
          }

          // Read mode: multiline gets a preview box; short fields are compact rows.
          if (f.multiline) {
            return (
              <div key={f.key}>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {f.label}
                </p>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 px-3 py-2 text-sm leading-relaxed">
                  {display || (
                    <span className="italic text-muted-foreground">empty</span>
                  )}
                </div>
              </div>
            );
          }
          return (
            <div key={f.key} className="flex gap-3 text-sm">
              <span className="w-20 shrink-0 pt-px text-xs font-medium text-muted-foreground">
                {f.label}
              </span>
              <span className="min-w-0 flex-1 break-words font-medium">
                {display || (
                  <span className="font-normal italic text-muted-foreground">
                    empty
                  </span>
                )}
              </span>
            </div>
          );
        })}

        {missingSelection && (
          <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            Select an option above to continue.
          </p>
        )}
      </div>

      {/* Actions. */}
      <div className="flex items-center gap-2 border-t border-border/60 bg-muted/20 px-4 py-3">
        <Button
          size="sm"
          disabled={missingSelection}
          onClick={() => onApprove(fields)}
        >
          <Check className="h-3.5 w-3.5" />
          {editing ? "Save & approve" : "Approve"}
          <kbd className="ml-1 hidden items-center gap-0.5 rounded border border-primary-foreground/30 px-1 text-[10px] opacity-70 sm:inline-flex">
            <CornerDownLeft className="h-2.5 w-2.5" />
          </kbd>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? (
            <>
              <X className="h-3.5 w-3.5" />
              Cancel edit
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          onClick={onSkip}
        >
          <SkipForward className="h-3.5 w-3.5" />
          Skip
        </Button>
      </div>
    </div>
  );
}
