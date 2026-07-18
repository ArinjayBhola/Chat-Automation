import type { ProviderId } from "../../ai/models";
import type { FailureClass } from "./types";

/**
 * In-memory provider health tracking with a simple circuit breaker. Cached on
 * globalThis so it survives Next.js HMR and is shared across requests in a
 * single server process (best-effort; not shared across serverless instances,
 * which is fine - the failover loop re-checks each attempt regardless).
 */

export type ProviderMetrics = {
  provider: ProviderId;
  totalSuccess: number;
  totalFailure: number;
  consecutiveFailures: number;
  /** Epoch ms until which the circuit is open (provider skipped). 0 = closed. */
  openUntil: number;
  lastError?: string;
  lastLatencyMs?: number;
  lastUsedAt?: number;
};

const OPEN_AFTER_CONSECUTIVE = Number(process.env.PROVIDER_OPEN_AFTER ?? 3);
const COOLDOWN_MS = Number(process.env.PROVIDER_COOLDOWN_MS ?? 60_000);
const RATE_LIMIT_COOLDOWN_MS = Number(
  process.env.PROVIDER_RATE_LIMIT_COOLDOWN_MS ?? 90_000,
);

export class ProviderHealthMonitor {
  private metrics = new Map<ProviderId, ProviderMetrics>();

  private get(provider: ProviderId): ProviderMetrics {
    let m = this.metrics.get(provider);
    if (!m) {
      m = {
        provider,
        totalSuccess: 0,
        totalFailure: 0,
        consecutiveFailures: 0,
        openUntil: 0,
      };
      this.metrics.set(provider, m);
    }
    return m;
  }

  /** A provider is healthy when its circuit is not currently open. */
  isHealthy(provider: ProviderId, now = Date.now()): boolean {
    return this.get(provider).openUntil <= now;
  }

  recordSuccess(provider: ProviderId, latencyMs?: number): void {
    const m = this.get(provider);
    m.totalSuccess += 1;
    m.consecutiveFailures = 0;
    m.openUntil = 0;
    m.lastError = undefined;
    m.lastLatencyMs = latencyMs;
    m.lastUsedAt = Date.now();
  }

  recordFailure(
    provider: ProviderId,
    cls: FailureClass,
    message: string,
    now = Date.now(),
  ): void {
    const m = this.get(provider);
    m.totalFailure += 1;
    m.consecutiveFailures += 1;
    m.lastError = message;
    m.lastUsedAt = now;

    // Rate limits open the circuit immediately for a longer cooldown; other
    // failures open only after several consecutive hits.
    if (cls === "rate_limit") {
      m.openUntil = now + RATE_LIMIT_COOLDOWN_MS;
    } else if (m.consecutiveFailures >= OPEN_AFTER_CONSECUTIVE) {
      m.openUntil = now + COOLDOWN_MS;
    }
  }

  snapshot(): ProviderMetrics[] {
    return [...this.metrics.values()].map((m) => ({ ...m }));
  }

  /** Test helper: wipe all tracked state. */
  reset(): void {
    this.metrics.clear();
  }
}

const globalForHealth = globalThis as unknown as {
  __providerHealth?: ProviderHealthMonitor;
};

/** Process-wide shared health monitor. */
export function getHealthMonitor(): ProviderHealthMonitor {
  return (globalForHealth.__providerHealth ??= new ProviderHealthMonitor());
}
