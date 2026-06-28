"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { AXIS_TICK, CHART_COLORS, GRID_STROKE, TOOLTIP_STYLE } from "./chart-theme";
import { EmptyChart } from "./execution-chart";
import type { NodeUsage } from "@/lib/db-queries";

export function NodeUsageChart({ usage }: { usage: NodeUsage[] }) {
  const data = usage.slice(0, 8);
  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold">Step activity by type</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        How often each node type runs
      </p>
      {data.length === 0 ? (
        <EmptyChart label="No step activity yet" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="nodeType"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: GRID_STROKE }}
            />
            <YAxis
              allowDecimals={false}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--accent))" }} />
            <Bar dataKey="total" name="Runs" radius={[6, 6, 0, 0]}>
              {data.map((d) => (
                <Cell
                  key={d.nodeType}
                  fill={d.failed > 0 ? CHART_COLORS.failed : CHART_COLORS.primary}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
