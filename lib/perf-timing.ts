/**
 * Opt-in request timing for isolating DB vs other work.
 * Set DEBUG_DB_TIMING=1 in the environment (e.g. .env.local) to log timings to stderr.
 */

const enabled = () => process.env.DEBUG_DB_TIMING === "1" || process.env.DEBUG_DB_TIMING === "true";

export function perfLabel(route: string, phase: string): string {
  return `[perf] ${route} ${phase}`;
}

export async function perfAsync<T>(route: string, phase: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled()) return fn();
  const label = perfLabel(route, phase);
  console.time(label);
  try {
    return await fn();
  } finally {
    console.timeEnd(label);
  }
}

export function perfSync<T>(route: string, phase: string, fn: () => T): T {
  if (!enabled()) return fn();
  const label = perfLabel(route, phase);
  console.time(label);
  try {
    return fn();
  } finally {
    console.timeEnd(label);
  }
}
