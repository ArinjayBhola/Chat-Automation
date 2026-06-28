import { CronExpressionParser } from "cron-parser";

/**
 * Cron utilities for the scheduling system. Uses cron-parser for correct,
 * timezone-aware next-run computation (handles DST, month lengths, etc.) so we
 * don't hand-roll calendar math.
 */

export interface CronPreset {
  label: string;
  value: string;
}

export const CRON_PRESETS: CronPreset[] = [
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 4 hours", value: "0 */4 * * *" },
  { label: "Every day at 9 AM", value: "0 9 * * *" },
  { label: "Every weekday at 9 AM", value: "0 9 * * 1-5" },
  { label: "Every Monday at 9 AM", value: "0 9 * * 1" },
  { label: "First day of month", value: "0 0 1 * *" },
];

export const COMMON_TIMEZONES: string[] = [
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

/** True when `expr` is a parseable cron expression. */
export function isValidCron(expr: string): boolean {
  try {
    CronExpressionParser.parse(expr);
    return true;
  } catch {
    return false;
  }
}

/** True when `tz` is a valid IANA timezone. */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The next time the cron expression fires after `from`, in the given timezone.
 * Returns null when the expression or timezone is invalid.
 */
export function nextRun(
  expr: string,
  timezone = "UTC",
  from: Date = new Date(),
): Date | null {
  try {
    const interval = CronExpressionParser.parse(expr, {
      currentDate: from,
      tz: timezone,
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

/** The next `count` fire times (used for previewing a schedule). */
export function nextRuns(
  expr: string,
  timezone = "UTC",
  count = 3,
  from: Date = new Date(),
): Date[] {
  try {
    const interval = CronExpressionParser.parse(expr, {
      currentDate: from,
      tz: timezone,
    });
    return interval.take(count).map((d) => d.toDate());
  } catch {
    return [];
  }
}
