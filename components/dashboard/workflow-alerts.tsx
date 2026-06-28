"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  KeyRound,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, timeAgo } from "@/lib/utils";

export interface DashboardAlert {
  id: string;
  workflowId: string;
  type: "error" | "slow" | "auth" | "warning";
  message: string;
  createdAt: string;
}

const STYLES: Record<
  DashboardAlert["type"],
  { Icon: LucideIcon; chip: string }
> = {
  error: { Icon: ShieldAlert, chip: "bg-destructive/10 text-destructive" },
  auth: { Icon: KeyRound, chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  slow: { Icon: Clock, chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  warning: { Icon: AlertTriangle, chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

export function WorkflowAlerts({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold">Alerts</h3>
      {alerts.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          All clear. No failures or slow runs recently.
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => {
            const { Icon, chip } = STYLES[a.type] ?? STYLES.warning;
            return (
              <li
                key={`${a.id}-${a.type}`}
                className="flex items-start gap-3 rounded-lg border bg-surface p-3"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    chip,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/workflows/${a.workflowId}`}
                    className="block text-sm hover:underline"
                  >
                    {a.message}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {timeAgo(a.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
