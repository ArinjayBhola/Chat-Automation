export type TimeGroup<T> = {
  id: string;
  label: string;
  items: T[];
};

const DAY = 86_400_000;

const BUCKETS: { id: string; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "previous7", label: "Previous 7 Days" },
  { id: "previous30", label: "Previous 30 Days" },
  { id: "older", label: "Older" },
];

function bucketFor(time: number, startOfTodayMs: number): string {
  if (Number.isNaN(time)) return "older";
  if (time >= startOfTodayMs) return "today";
  if (time >= startOfTodayMs - DAY) return "yesterday";
  if (time >= startOfTodayMs - 7 * DAY) return "previous7";
  if (time >= startOfTodayMs - 30 * DAY) return "previous30";
  return "older";
}

/**
 * Bucket items into time-based sections (Today / Yesterday / Previous 7 Days /
 * Previous 30 Days / Older) by a date accessor, newest-first within each
 * bucket. Empty buckets are dropped. `now` is injectable for deterministic
 * tests.
 */
export function groupByRecency<T>(
  items: T[],
  getDate: (item: T) => string | Date,
  now: Date = new Date(),
): TimeGroup<T>[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startMs = startOfToday.getTime();

  const timeOf = (item: T) => new Date(getDate(item)).getTime();

  const byBucket = new Map<string, T[]>();
  for (const item of items) {
    const id = bucketFor(timeOf(item), startMs);
    const list = byBucket.get(id);
    if (list) list.push(item);
    else byBucket.set(id, [item]);
  }

  const groups: TimeGroup<T>[] = [];
  for (const { id, label } of BUCKETS) {
    const list = byBucket.get(id);
    if (list && list.length) {
      list.sort((a, b) => timeOf(b) - timeOf(a));
      groups.push({ id, label, items: list });
    }
  }
  return groups;
}
