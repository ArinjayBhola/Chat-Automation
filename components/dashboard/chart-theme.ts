/** Shared, theme-aware styling for the dashboard recharts components. */

export const CHART_COLORS = {
  success: "#10b981",
  failed: "#f43f5e",
  running: "#3b82f6",
  paused: "#f59e0b",
  primary: "hsl(var(--primary))",
};

export const AXIS_TICK = {
  fill: "hsl(var(--muted-foreground))",
  fontSize: 11,
};

export const GRID_STROKE = "hsl(var(--border))";

export const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
} as const;
