// Simple in-memory, per-IP rate limiter shared by the AI API routes.
//
// NOTE: state lives in process memory, so it is per server instance and resets
// on redeploy. On a multi-instance / serverless platform (Cloudflare, Vercel)
// this is best-effort — for hard guarantees back it with a shared store such as
// Upstash/Redis. It still meaningfully slows down single-client abuse.

const buckets = new Map(); // routeKey -> Map(ip -> { count, resetAt })

// Best-effort client IP from the usual proxy headers.
export function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Returns true if the request is allowed, false if the IP is over its quota for
// `routeKey`. The window resets `windowMs` after the first request in it.
export function checkRateLimit(routeKey, ip, { max = 10, windowMs = 60_000 } = {}) {
  let hits = buckets.get(routeKey);
  if (!hits) {
    hits = new Map();
    buckets.set(routeKey, hits);
  }

  const now = Date.now();
  // Opportunistically drop expired entries so the map can't grow unbounded.
  if (hits.size > 5000) {
    for (const [key, entry] of hits) {
      if (now >= entry.resetAt) hits.delete(key);
    }
  }

  const entry = hits.get(ip);
  if (!entry || now >= entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}
