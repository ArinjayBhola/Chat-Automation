"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  AXIS_TICK,
  CHART_COLORS,
  GRID_STROKE,
  TOOLTIP_STYLE,
} from "./chart-theme";
import { EmptyChart } from "./execution-chart";
import type { TrendPoint } from "@/lib/db-queries";

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function TrendChart({ trend }: { trend: TrendPoint[] }) {
  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold">Execution trend</h3>
      <p className="mb-3 text-xs text-muted-foreground">Last 30 days</p>
      {trend.length === 0 ? (
        <EmptyChart label="No runs in this period" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: GRID_STROKE }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(l) => shortDate(String(l))}
            />
            <Line
              type="monotone"
              dataKey="successful"
              name="Successful"
              stroke={CHART_COLORS.success}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="failed"
              name="Failed"
              stroke={CHART_COLORS.failed}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
