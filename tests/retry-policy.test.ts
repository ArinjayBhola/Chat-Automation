import { describe, expect, it } from "vitest";
import { classifyFailure, RetryPolicy } from "@/lib/agent/failover/retry-policy";
import { isRetryable } from "@/lib/agent/failover/types";

describe("classifyFailure", () => {
  it("classifies 429 / rate limit / quota as rate_limit (retryable)", () => {
    expect(classifyFailure({ statusCode: 429 })).toBe("rate_limit");
    expect(classifyFailure(new Error("Rate limit exceeded"))).toBe("rate_limit");
    expect(classifyFailure(new Error("You exceeded your current quota"))).toBe(
      "rate_limit",
    );
    expect(classifyFailure(new Error("free tier tokens exhausted"))).toBe(
      "rate_limit",
    );
    expect(isRetryable("rate_limit")).toBe(true);
  });

  it("classifies 5xx / unavailable / overloaded as server (retryable)", () => {
    expect(classifyFailure({ statusCode: 503 })).toBe("server");
    expect(classifyFailure(new Error("Service Unavailable"))).toBe("server");
    expect(classifyFailure(new Error("model is overloaded"))).toBe("server");
  });

  it("classifies timeouts and network errors (retryable)", () => {
    expect(classifyFailure(new Error("request timed out"))).toBe("timeout");
    expect(classifyFailure({ statusCode: 504 })).toBe("timeout");
    expect(classifyFailure(new Error("ECONNRESET"))).toBe("network");
    expect(classifyFailure(new Error("fetch failed"))).toBe("network");
  });

  it("classifies auth errors (retryable to another provider, not same)", () => {
    expect(classifyFailure({ statusCode: 401 })).toBe("auth");
    expect(classifyFailure({ statusCode: 403 })).toBe("auth");
    expect(classifyFailure(new Error("Invalid API key"))).toBe("auth");
    expect(isRetryable("auth")).toBe(true);
  });

  it("classifies validation/client errors as fatal (do not fail over)", () => {
    expect(classifyFailure({ statusCode: 400 })).toBe("fatal");
    expect(classifyFailure(new Error("invalid tool schema"))).toBe("fatal");
    expect(isRetryable("fatal")).toBe(false);
  });

  it("honors the AI SDK isRetryable flag when unparseable", () => {
    expect(classifyFailure({ isRetryable: true, message: "weird" })).toBe(
      "server",
    );
  });
});

describe("RetryPolicy", () => {
  it("retries same provider only for transient classes, within the cap", () => {
    const p = new RetryPolicy(2);
    expect(p.shouldRetrySameProvider("server", 0)).toBe(true);
    expect(p.shouldRetrySameProvider("network", 1)).toBe(true);
    expect(p.shouldRetrySameProvider("server", 2)).toBe(false); // cap reached
    expect(p.shouldRetrySameProvider("rate_limit", 0)).toBe(false);
    expect(p.shouldRetrySameProvider("fatal", 0)).toBe(false);
  });

  it("computes exponential backoff", () => {
    const p = new RetryPolicy(3, 400);
    expect(p.backoffMs(0)).toBe(400);
    expect(p.backoffMs(1)).toBe(800);
    expect(p.backoffMs(2)).toBe(1600);
  });
});
