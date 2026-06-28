"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_COLORS, TOOLTIP_STYLE } from "./chart-theme";
import type { DashboardMetrics } from "@/lib/db-queries";

export function ExecutionChart({ metrics }: { metrics: DashboardMetrics }) {
  const data = [
    { name: "Successful", value: metrics.successfulExecutions, fill: CHART_COLORS.success },
    { name: "Failed", value: metrics.failedExecutions, fill: CHART_COLORS.failed },
    { name: "Running", value: metrics.runningExecutions, fill: CHART_COLORS.running },
    { name: "Paused", value: metrics.pausedExecutions, fill: CHART_COLORS.paused },
  ].filter((d) => d.value > 0);

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold">Execution status</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        {metrics.totalExecutions} total runs
      </p>
      {data.length === 0 ? (
        <EmptyChart label="No executions yet" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={88}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend
              iconType="circle"
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
