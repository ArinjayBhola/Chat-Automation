import type { ProviderHealthMonitor } from "./health-monitor";
import type { Candidate } from "./provider-manager";

/**
 * Walks the provider chain on failure. The first candidate (the user's chosen
 * provider) always leads. On each subsequent advance it prefers a candidate
 * whose circuit is closed (healthy); if every remaining candidate is in
 * cooldown it still returns the next untried one as a last resort, since health
 * is best-effort and trying beats hard-failing the run.
 */
export class FailoverController {
  private idx = -1;

  constructor(
    private readonly chain: Candidate[],
    private readonly health: ProviderHealthMonitor,
  ) {}

  private pick(from: number): { candidate: Candidate; index: number } | null {
    let firstUntried: { candidate: Candidate; index: number } | null = null;
    for (let i = from; i < this.chain.length; i++) {
      const candidate = this.chain[i];
      if (firstUntried === null) firstUntried = { candidate, index: i };
      // The primary (index 0) always leads; secondaries prefer healthy.
      if (i === 0 || this.health.isHealthy(candidate.provider)) {
        return { candidate, index: i };
      }
    }
    return firstUntried;
  }

  /** Advance to and return the next candidate, or null when the chain is spent. */
  next(): Candidate | null {
    const picked = this.pick(this.idx + 1);
    if (!picked) {
      this.idx = this.chain.length;
      return null;
    }
    this.idx = picked.index;
    return picked.candidate;
  }

  hasNext(): boolean {
    return this.pick(this.idx + 1) !== null;
  }

  current(): Candidate | null {
    return this.idx >= 0 && this.idx < this.chain.length
      ? this.chain[this.idx]
      : null;
  }

  get size(): number {
    return this.chain.length;
  }
}
