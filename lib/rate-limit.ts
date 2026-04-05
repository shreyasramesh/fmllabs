/**
 * In-process sliding-window rate limiter.
 *
 * Keyed by arbitrary string (userId, IP, etc.). Each key tracks a list of
 * timestamps within the current window. Old entries are pruned on every check.
 *
 * Memory is bounded: keys that haven't been seen within their window are
 * evicted on the next sweep (runs every 60s).
 */

interface WindowEntry {
  timestamps: number[];
  windowMs: number;
}

const buckets = new Map<string, WindowEntry>();

let sweepScheduled = false;
function scheduleSweep() {
  if (sweepScheduled) return;
  sweepScheduled = true;
  if (typeof setInterval !== "undefined") {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of buckets) {
        const cutoff = now - entry.windowMs;
        entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
        if (entry.timestamps.length === 0) buckets.delete(key);
      }
    }, 60_000);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the oldest request in the window expires. */
  resetMs: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  scheduleSweep();

  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = buckets.get(key);
  if (!entry) {
    entry = { timestamps: [], windowMs };
    buckets.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldest + windowMs - now,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetMs: windowMs,
  };
}

// ── Pre-configured limiters ──

const ONE_MINUTE = 60_000;

export function rateLimitByUser(
  userId: string,
  opts?: { max?: number; windowMs?: number },
): RateLimitResult {
  return checkRateLimit(
    `user:${userId}`,
    opts?.max ?? 120,
    opts?.windowMs ?? ONE_MINUTE,
  );
}

export function rateLimitByIp(
  ip: string,
  opts?: { max?: number; windowMs?: number },
): RateLimitResult {
  return checkRateLimit(
    `ip:${ip}`,
    opts?.max ?? 300,
    opts?.windowMs ?? ONE_MINUTE,
  );
}

/** Stricter limit for auth-related endpoints (brute-force protection). */
export function rateLimitAuthByIp(ip: string): RateLimitResult {
  return checkRateLimit(`auth-ip:${ip}`, 10, ONE_MINUTE);
}

/** Helper: extract client IP from request headers. */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** Helper: build a 429 Response with Retry-After header. */
export function tooManyRequestsResponse(resetMs: number): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests" }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(resetMs / 1000)),
      },
    },
  );
}
