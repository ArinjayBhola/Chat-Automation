"use client";

import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Percent,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import type { DashboardMetrics } from "@/lib/db-queries";

export function MetricsCards({ metrics }: { metrics: DashboardMetrics }) {
  const cards: {
    title: string;
    value: string | number;
    Icon: LucideIcon;
    chip: string;
  }[] = [
    {
      title: "Total workflows",
      value: metrics.totalWorkflows,
      Icon: Workflow,
      chip: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      title: "Active schedules",
      value: metrics.activeSchedules,
      Icon: CalendarClock,
      chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      title: "Successful runs",
      value: metrics.successfulExecutions,
      Icon: CheckCircle2,
      chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Failed runs",
      value: metrics.failedExecutions,
      Icon: AlertCircle,
      chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
    {
      title: "Avg run time",
      value: formatDuration(metrics.averageDurationMs || 0),
      Icon: Clock,
      chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    },
    {
      title: "Success rate",
      value: `${metrics.successRate}%`,
      Icon: Percent,
      chip: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.title} className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{c.title}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
            </div>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.chip}`}
            >
              <c.Icon className="h-4 w-4" />
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
