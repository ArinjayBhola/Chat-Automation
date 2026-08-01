"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { RefreshCw } from "lucide-react";
import { AppTopbar } from "@/components/layout/app-topbar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  DashboardMetrics,
  NodeUsage,
  TrendPoint,
} from "@/lib/db-queries";
import { MetricsCards } from "./metrics-cards";
import type { RecentExecutionItem } from "./recent-executions";
import type { DashboardAlert } from "./workflow-alerts";

const ExecutionChart = dynamic(() => import("./execution-chart").then((m) => m.ExecutionChart));
const TrendChart = dynamic(() => import("./trend-chart").then((m) => m.TrendChart));
const NodeUsageChart = dynamic(() => import("./node-usage-chart").then((m) => m.NodeUsageChart));
const RecentExecutions = dynamic(() => import("./recent-executions").then((m) => m.RecentExecutions));
const WorkflowAlerts = dynamic(() => import("./workflow-alerts").then((m) => m.WorkflowAlerts));

const REFRESH_MS = 30_000;

export function DashboardClient() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [nodeUsage, setNodeUsage] = useState<NodeUsage[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [executions, setExecutions] = useState<RecentExecutionItem[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [m, t, e, a] = await Promise.all([
        fetch("/api/dashboard/metrics").then((r) => r.json()),
        fetch("/api/dashboard/trend").then((r) => r.json()),
        fetch("/api/dashboard/executions?limit=10").then((r) => r.json()),
        fetch("/api/dashboard/alerts").then((r) => r.json()),
      ]);
      setMetrics(m.metrics ?? null);
      setNodeUsage(m.nodeUsage ?? []);
      setTrend(t.trend ?? []);
      setExecutions(e.executions ?? []);
      setAlerts(a.alerts ?? []);
    } catch {
      /* keep previous data on transient failures */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="min-h-screen bg-background">
      <AppTopbar>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={load}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <ThemeToggle />
      </AppTopbar>

      <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Workflow monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Health, performance, and recent activity across your automations.
          </p>
        </div>

        {loading || !metrics ? (
          <DashboardSkeleton />
        ) : (
          <>
            <MetricsCards metrics={metrics} />
            <div className="grid gap-5 lg:grid-cols-2">
              <ExecutionChart metrics={metrics} />
              <TrendChart trend={trend} />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <NodeUsageChart usage={nodeUsage} />
              <WorkflowAlerts alerts={alerts} />
            </div>
            <RecentExecutions executions={executions} />
          </>
        )}
      </main>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-[88px] animate-pulse bg-muted/50" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="h-[320px] animate-pulse bg-muted/50" />
        <Card className="h-[320px] animate-pulse bg-muted/50" />
      </div>
    </div>
  );
}
