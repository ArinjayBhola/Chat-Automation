import { describe, expect, it } from "vitest";
import { ProviderHealthMonitor } from "@/lib/agent/failover/health-monitor";

describe("ProviderHealthMonitor", () => {
  it("starts healthy and stays healthy on success", () => {
    const h = new ProviderHealthMonitor();
    expect(h.isHealthy("groq")).toBe(true);
    h.recordSuccess("groq", 120);
    expect(h.isHealthy("groq")).toBe(true);
  });

  it("opens the circuit immediately on a rate limit", () => {
    const h = new ProviderHealthMonitor();
    const now = 1_000_000;
    h.recordFailure("groq", "rate_limit", "429", now);
    expect(h.isHealthy("groq", now)).toBe(false);
    // recovers after the cooldown window
    expect(h.isHealthy("groq", now + 10 * 60_000)).toBe(true);
  });

  it("opens only after several consecutive non-rate-limit failures", () => {
    const h = new ProviderHealthMonitor();
    const now = 2_000_000;
    h.recordFailure("openai", "server", "500", now);
    h.recordFailure("openai", "server", "500", now);
    expect(h.isHealthy("openai", now)).toBe(true); // still under threshold
    h.recordFailure("openai", "server", "500", now);
    expect(h.isHealthy("openai", now)).toBe(false); // threshold hit
  });

  it("a success resets the consecutive failure count and closes the circuit", () => {
    const h = new ProviderHealthMonitor();
    const now = 3_000_000;
    h.recordFailure("google", "server", "500", now);
    h.recordFailure("google", "server", "500", now);
    h.recordSuccess("google");
    expect(h.isHealthy("google", now)).toBe(true);
    const m = h.snapshot().find((x) => x.provider === "google");
    expect(m?.consecutiveFailures).toBe(0);
    expect(m?.totalSuccess).toBe(1);
    expect(m?.totalFailure).toBe(2);
  });
});
