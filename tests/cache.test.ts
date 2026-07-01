import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cacheClear,
  cacheGet,
  cacheSet,
  cached,
  invalidate,
  invalidatePrefix,
  stableKey,
} from "@/lib/cache";

afterEach(() => cacheClear());

describe("TTL cache", () => {
  it("returns a stored value before it expires and nothing after", () => {
    cacheSet("k", 42, 1000);
    expect(cacheGet<number>("k")).toBe(42);

    vi.useFakeTimers();
    cacheSet("k2", 7, 50);
    vi.advanceTimersByTime(51);
    expect(cacheGet("k2")).toBeUndefined();
    vi.useRealTimers();
  });

  it("invalidate drops one key; invalidatePrefix drops a namespace", () => {
    cacheSet("conn:u1:all", "a", 1000);
    cacheSet("conn:u1:t:gmail", "b", 1000);
    cacheSet("conn:u2:all", "c", 1000);

    invalidate("conn:u1:all");
    expect(cacheGet("conn:u1:all")).toBeUndefined();
    expect(cacheGet("conn:u1:t:gmail")).toBe("b");

    invalidatePrefix("conn:u1:");
    expect(cacheGet("conn:u1:t:gmail")).toBeUndefined();
    expect(cacheGet("conn:u2:all")).toBe("c");
  });
});

describe("cached() single-flight", () => {
  it("computes once on a miss and serves the cached value after", async () => {
    const load = vi.fn(async () => "value");
    expect(await cached("x", 1000, load)).toBe("value");
    expect(await cached("x", 1000, load)).toBe("value");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("de-duplicates concurrent misses into one load", async () => {
    let resolve!: (v: string) => void;
    const load = vi.fn(
      () => new Promise<string>((r) => (resolve = r)),
    );

    const a = cached("y", 1000, load);
    const b = cached("y", 1000, load);
    resolve("done");

    expect(await a).toBe("done");
    expect(await b).toBe("done");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache a rejected load", async () => {
    const fail = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(cached("z", 1000, fail)).rejects.toThrow("boom");

    const ok = vi.fn(async () => "recovered");
    expect(await cached("z", 1000, ok)).toBe("recovered");
    expect(ok).toHaveBeenCalledTimes(1);
  });
});

describe("stableKey", () => {
  it("is order-independent and distinguishes different values", () => {
    expect(stableKey({ a: 1, b: 2 })).toBe(stableKey({ b: 2, a: 1 }));
    expect(stableKey({ a: 1 })).not.toBe(stableKey({ a: 2 }));
    expect(stableKey(undefined)).toBe("");
  });
});
