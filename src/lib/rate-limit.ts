/**
 * Minimal in-memory sliding-window rate limiter (single-instance MVP).
 * Swap for a Redis-backed store when deploying multiple replicas.
 */

interface Bucket {
  hits: number[];
}

const store = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { ok: boolean; remaining: number } {
  const now = Date.now();
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < opts.windowMs);

  if (bucket.hits.length >= opts.limit) {
    store.set(key, bucket);
    return { ok: false, remaining: 0 };
  }
  bucket.hits.push(now);
  store.set(key, bucket);
  return { ok: true, remaining: opts.limit - bucket.hits.length };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
