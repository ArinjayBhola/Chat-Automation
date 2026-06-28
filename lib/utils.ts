import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Compact relative time, e.g. "3m ago", "2h ago", "5d ago". */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Human-readable duration from milliseconds, e.g. "350ms", "1.2s". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "-";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
