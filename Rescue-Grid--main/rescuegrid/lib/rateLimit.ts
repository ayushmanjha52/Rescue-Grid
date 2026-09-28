import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export interface RateRule {
  /** What is being limited, e.g. `otp-send:phone:+919876543210`. Hashed before storage. */
  key: string;
  limit: number;
  windowSeconds: number;
}

/**
 * Fixed-window counter kept in process memory. Used when the database limiter
 * (migration 018) isn't available, and exported for tests.
 */
export function createMemoryLimiter(now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>();
  return (key: string, limit: number, windowMs: number): boolean => {
    const t = now();
    const current = windows.get(key);
    if (!current || t - current.start >= windowMs) {
      windows.set(key, { start: t, count: 1 });
      if (windows.size > 10_000) {
        for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k);
      }
      return 1 <= limit;
    }
    current.count += 1;
    return current.count <= limit;
  };
}

const memoryLimiter = createMemoryLimiter();
let databaseLimiterAvailable = true;

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex').slice(0, 48);
}

/** Counts one hit; returns true while the caller is within the limit. */
export async function hitRateLimit({ key, limit, windowSeconds }: RateRule): Promise<boolean> {
  const hashed = hashKey(key);
  if (databaseLimiterAvailable) {
    try {
      const { data, error } = await createServiceClient().rpc('hit_rate_limit', {
        p_key: hashed,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      if (!error && typeof data === 'boolean') return data;
      // Function missing (migration 018 not applied) — stop asking the database.
      if (error?.code === 'PGRST202' || error?.code === '42883') databaseLimiterAvailable = false;
    } catch {
      // Database unreachable — fall back to memory for this request.
    }
  }
  return memoryLimiter(hashed, limit, windowSeconds * 1000);
}

/** Best-effort client IP from the proxy headers set by the hosting platform. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return (forwarded?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown').trim();
}

/**
 * Applies every rule and returns a 429 response if any is exceeded, or null
 * to continue.
 */
export async function enforceRateLimits(
  rules: RateRule[],
  message = 'Too many requests. Please wait a few minutes and try again.'
): Promise<NextResponse | null> {
  const results = await Promise.all(rules.map(hitRateLimit));
  const exceeded = rules.find((_, i) => !results[i]);
  if (!exceeded) return null;
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(exceeded.windowSeconds) } }
  );
}
