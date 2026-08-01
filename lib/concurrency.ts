const MAX_ACTIVE_RUNS = Math.max(
  1,
  Number(process.env.MAX_ACTIVE_AGENT_RUNS_PER_USER ?? 2),
);

const globalForConcurrency = globalThis as unknown as {
  __relayActiveRuns?: Map<string, number>;
};

const activeRuns =
  (globalForConcurrency.__relayActiveRuns ??= new Map<string, number>());

export function acquireAgentRun(userId: string): (() => void) | null {
  const count = activeRuns.get(userId) ?? 0;
  if (count >= MAX_ACTIVE_RUNS) return null;
  activeRuns.set(userId, count + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = (activeRuns.get(userId) ?? 1) - 1;
    if (next <= 0) activeRuns.delete(userId);
    else activeRuns.set(userId, next);
  };
}
