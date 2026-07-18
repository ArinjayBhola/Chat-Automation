import type { FailureClass } from "./types";

/**
 * Classifies a provider error into a FailureClass without depending on any
 * single provider SDK. Works off HTTP status codes and error-message shapes so
 * it holds across Anthropic / OpenAI / Google / OpenAI-compatible gateways.
 */

/** Pull an HTTP-ish status code out of whatever error shape we were handed. */
function statusOf(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as Record<string, unknown>;
  const candidates = [e.statusCode, e.status, e.code];
  for (const c of candidates) {
    if (typeof c === "number" && c >= 100 && c < 600) return c;
    if (typeof c === "string" && /^\d{3}$/.test(c)) return Number(c);
  }
  // AI SDK APICallError nests it here sometimes.
  const resp = e.response as Record<string, unknown> | undefined;
  if (resp && typeof resp.status === "number") return resp.status;
  return undefined;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    try {
      return JSON.stringify(e);
    } catch {
      return String(err);
    }
  }
  return String(err ?? "unknown error");
}

export function classifyFailure(err: unknown): FailureClass {
  const status = statusOf(err);
  const msg = messageOf(err).toLowerCase();

  // Rate limit / quota / free-tier exhaustion.
  if (
    status === 429 ||
    /rate.?limit|too many requests|quota|exhaust|insufficient_quota|billing|credit|out of tokens|capacity/.test(
      msg,
    )
  ) {
    return "rate_limit";
  }

  // Auth / permission: provider-specific creds are bad -> try the next provider.
  if (
    status === 401 ||
    status === 403 ||
    /unauthorized|forbidden|invalid api key|authentication|permission denied/.test(
      msg,
    )
  ) {
    return "auth";
  }

  // Timeouts.
  if (
    status === 408 ||
    status === 504 ||
    /timed? ?out|timeout|etimedout|deadline exceeded/.test(msg)
  ) {
    return "timeout";
  }

  // Network / connection failures.
  if (
    /econnreset|econnrefused|enotfound|eai_again|socket hang up|network|fetch failed|connection (error|closed|reset)|und_err/.test(
      msg,
    )
  ) {
    return "network";
  }

  // Server-side / provider unavailable (retryable elsewhere).
  if (
    (typeof status === "number" && status >= 500) ||
    /server error|internal error|unavailable|overloaded|bad gateway|service unavailable|try again/.test(
      msg,
    )
  ) {
    return "server";
  }

  // AI SDK marks transient errors as retryable even when we can't parse them.
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (e.isRetryable === true) return "server";
  }

  // Client errors (400/422 bad request, tool schema, validation) fail on every
  // provider - do not fail over, surface immediately.
  return "fatal";
}

/**
 * Same-provider retry policy layered UNDER provider failover. AI SDK already
 * retries transient errors a couple of times inside a single streamText call;
 * this exposes a bounded backoff we use only if we ever retry the same provider
 * before escalating. Kept tiny and pure so it is trivially testable.
 */
export class RetryPolicy {
  constructor(
    readonly maxSameProviderRetries = Number(
      process.env.PROVIDER_MAX_RETRIES ?? 1,
    ),
    private readonly baseDelayMs = 400,
  ) {}

  shouldRetrySameProvider(cls: FailureClass, attempt: number): boolean {
    if (attempt >= this.maxSameProviderRetries) return false;
    // Only worth retrying the same provider for transient blips, not rate
    // limits (which need cooldown) or auth/fatal.
    return cls === "server" || cls === "network" || cls === "timeout";
  }

  backoffMs(attempt: number): number {
    return this.baseDelayMs * Math.pow(2, attempt);
  }
}
