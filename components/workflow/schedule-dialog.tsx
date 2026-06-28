"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Kept local (not imported from lib/workflows/cron.ts) so this client bundle
// doesn't pull in luxon. The server validates with cron-parser on submit.
const PRESETS = [
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 4 hours", value: "0 */4 * * *" },
  { label: "Daily at 9 AM", value: "0 9 * * *" },
  { label: "Weekdays at 9 AM", value: "0 9 * * 1-5" },
  { label: "Mondays at 9 AM", value: "0 9 * * 1" },
];
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

interface ScheduleRow {
  id: string;
  schedule: string;
  timezone: string;
  name: string | null;
  isActive: boolean;
  lastRun: string | null;
  nextRun: string | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastError: string | null;
}

interface ExecutionRow {
  id: string;
  status: string;
  triggerType: string;
  startedAt: string;
  durationMs?: number | null;
  duration?: number | null;
}

function looksLikeCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  return parts.length === 5 && parts.every((p) => /^[\d*/,\-]+$/.test(p));
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(ms?: number | null): string {
  if (ms == null) return "";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function ScheduleDialog({
  workflowId,
  published,
  onClose,
}: {
  workflowId: string;
  published: boolean;
  onClose: () => void;
}) {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [cron, setCron] = useState("0 9 * * *");
  const [timezone, setTimezone] = useState("UTC");
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, eRes] = await Promise.all([
        fetch(`/api/workflows/${workflowId}/schedules`),
        fetch(`/api/workflows/${workflowId}/executions?limit=10`),
      ]);
      const sData = await sRes.json().catch(() => ({}));
      const eData = await eRes.json().catch(() => ({}));
      setSchedules(sData.schedules ?? []);
      setExecutions(eData.executions ?? []);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function create() {
    setError(null);
    if (!looksLikeCron(cron)) {
      setError("That doesn't look like a valid 5-field cron expression.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule: cron,
          timezone,
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not create schedule.");
        return;
      }
      setName("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function toggle(s: ScheduleRow) {
    setBusyId(s.id);
    try {
      await fetch(`/api/workflows/${workflowId}/schedules/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(s: ScheduleRow) {
    setBusyId(s.id);
    try {
      await fetch(`/api/workflows/${workflowId}/schedules/${s.id}`, {
        method: "DELETE",
      });
      setSchedules((prev) => prev.filter((x) => x.id !== s.id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Schedules</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto scrollbar-thin p-5">
          {!published && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              This workflow is a draft. Scheduled runs only fire once it is
              published.
            </p>
          )}

          {/* Existing schedules */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Active schedules
            </h3>
            {loading ? (
              <div className="h-12 animate-pulse rounded-lg bg-muted/60" />
            ) : schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No schedules yet. Create one below.
              </p>
            ) : (
              <ul className="space-y-2">
                {schedules.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-lg border bg-surface p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {s.schedule}
                          </code>
                          <span className="text-xs text-muted-foreground">
                            {s.timezone}
                          </span>
                          {s.isActive ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="outline">Paused</Badge>
                          )}
                        </div>
                        {s.name && (
                          <p className="mt-1 text-sm font-medium">{s.name}</p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Next: {fmtDate(s.nextRun)} · Last: {fmtDate(s.lastRun)}{" "}
                          · {s.totalRuns} run{s.totalRuns === 1 ? "" : "s"} (
                          {s.successfulRuns} ok, {s.failedRuns} failed)
                        </p>
                        {s.lastError && (
                          <p className="mt-1 truncate text-[11px] text-destructive">
                            {s.lastError}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          disabled={busyId === s.id}
                          onClick={() => toggle(s)}
                          aria-label={s.isActive ? "Pause" : "Resume"}
                        >
                          {busyId === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : s.isActive ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={busyId === s.id}
                          onClick={() => remove(s)}
                          aria-label="Delete schedule"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Create */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              New schedule
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setCron(p.value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    cron === p.value
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "hover:bg-accent",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cron">Cron expression</Label>
                <Input
                  id="cron"
                  value={cron}
                  onChange={(e) => setCron(e.target.value)}
                  placeholder="0 9 * * *"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-name">Name (optional)</Label>
              <Input
                id="sched-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Daily morning digest"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              className="w-full gap-1.5"
              onClick={create}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create schedule
            </Button>
          </section>

          {/* Recent runs */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recent runs
            </h3>
            {loading ? (
              <div className="h-10 animate-pulse rounded-lg bg-muted/60" />
            ) : executions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {executions.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{fmtDate(e.startedAt)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {e.triggerType}
                        {e.duration || e.durationMs
                          ? ` · ${fmtDuration(e.duration ?? e.durationMs)}`
                          : ""}
                      </div>
                    </div>
                    <StatusBadge status={e.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge variant="success">success</Badge>;
  if (status === "failed") {
    return (
      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
        failed
      </span>
    );
  }
  if (status === "running" || status === "paused") {
    return <Badge variant="warning">{status}</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}
