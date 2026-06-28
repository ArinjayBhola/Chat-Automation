"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, RefreshCw, Workflow } from "lucide-react";
import { Logo } from "@/components/brand/logo";
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
import { ExecutionChart } from "./execution-chart";
import { TrendChart } from "./trend-chart";
import { NodeUsageChart } from "./node-usage-chart";
import {
  RecentExecutions,
  type RecentExecutionItem,
} from "./recent-executions";
import { WorkflowAlerts, type DashboardAlert } from "./workflow-alerts";

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
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-card/80 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <Logo badgeClassName="h-7 w-7" />
          <span className="hidden text-sm font-semibold sm:inline">
            Dashboard
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/workflows">
              <Workflow className="h-4 w-4" />
              <span className="hidden sm:inline">Workflows</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/chat">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </Link>
          </Button>
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
        </div>
      </header>

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
