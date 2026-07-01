/**
 * Lightweight in-memory TTL cache with single-flight de-duplication.
 *
 * Same operational envelope as lib/rate-limit.ts: process-local, fine for a
 * single instance / dev / small deployments. For multi-instance production,
 * back this with Redis/Upstash - the call sites (`cached`, `invalidate*`) won't
 * change, only this module's internals.
 *
 * Two things this buys us:
 *  - TTL cache so repeated reads inside a short window skip the DB / external API.
 *  - Single-flight: concurrent misses for the same key await ONE underlying call
 *    instead of stampeding the upstream (the agent often fires identical reads).
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
// Promises for in-flight loads, so concurrent callers share one upstream call.
const inFlight = new Map<string, Promise<unknown>>();

// Opportunistic cleanup so the map doesn't grow unbounded (mirrors rate-limit).
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  const now = Date.now();
  sweep(now);
  store.set(key, { value, expiresAt: now + ttlMs });
}

/** Drop a single key. */
export function invalidate(key: string): void {
  store.delete(key);
  inFlight.delete(key);
}

/** Drop every key starting with `prefix` (e.g. all entries for one user). */
export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  for (const key of inFlight.keys()) {
    if (key.startsWith(prefix)) inFlight.delete(key);
  }
}

/** Clear everything (mainly for tests). */
export function cacheClear(): void {
  store.clear();
  inFlight.clear();
}

/**
 * Return a cached value or compute it via `load`, caching the result for
 * `ttlMs`. Concurrent misses for the same key share a single `load()` call.
 * A rejected load is never cached.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    try {
      const value = await load();
      cacheSet(key, value, ttlMs);
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/** Stable key fragment for an args object (order-independent). */
export function stableKey(obj: Record<string, unknown> | undefined): string {
  if (!obj) return "";
  return JSON.stringify(
    Object.keys(obj)
      .sort()
      .map((k) => [k, obj[k]]),
  );
}

// Default TTLs (ms). Kept short: correctness over hit-rate for live user data.
export const TTL = {
  /** Tool connection rows (invalidated explicitly on connect/disconnect). */
  connections: 60_000,
  /** Read-only external tool results (search/list/read). */
  toolRead: 30_000,
} as const;
