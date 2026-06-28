import { describe, expect, it } from "vitest";
import { isValidCron, nextRun, nextRuns } from "@/lib/workflows/cron";

describe("isValidCron", () => {
  it("accepts valid expressions", () => {
    expect(isValidCron("0 9 * * *")).toBe(true);
    expect(isValidCron("*/15 * * * *")).toBe(true);
    expect(isValidCron("0 9 * * 1-5")).toBe(true);
  });
  it("rejects nonsense", () => {
    expect(isValidCron("not a cron")).toBe(false);
    expect(isValidCron("99 99 * * *")).toBe(false);
  });
});

describe("nextRun", () => {
  it("computes the next minute-aligned occurrence in UTC", () => {
    const from = new Date("2026-06-28T08:00:00Z");
    expect(nextRun("0 9 * * *", "UTC", from)?.toISOString()).toBe(
      "2026-06-28T09:00:00.000Z",
    );
  });

  it("rounds up to the next interval", () => {
    const from = new Date("2026-06-28T08:07:00Z");
    expect(nextRun("*/15 * * * *", "UTC", from)?.toISOString()).toBe(
      "2026-06-28T08:15:00.000Z",
    );
  });

  it("respects the timezone (9 AM New York = 13:00 UTC in summer)", () => {
    const from = new Date("2026-06-28T08:00:00Z");
    expect(
      nextRun("0 9 * * *", "America/New_York", from)?.toISOString(),
    ).toBe("2026-06-28T13:00:00.000Z");
  });

  it("returns null for invalid input", () => {
    expect(nextRun("garbage", "UTC")).toBeNull();
  });
});

describe("nextRuns", () => {
  it("returns multiple upcoming times", () => {
    const from = new Date("2026-06-28T08:00:00Z");
    const runs = nextRuns("0 * * * *", "UTC", 3, from);
    expect(runs.map((d) => d.toISOString())).toEqual([
      "2026-06-28T09:00:00.000Z",
      "2026-06-28T10:00:00.000Z",
      "2026-06-28T11:00:00.000Z",
    ]);
  });
});
