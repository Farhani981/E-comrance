// Generic bounded rate limiter for abuse protection
export function createRateLimiter({
  limit = 10,
  windowMs = 15 * 60 * 1000,
  message = 'Too many requests. Please try again later.',
  statusCode = 429,
  maxEntries = 10000,
  keyGenerator = (req) => req.ip || req.socket?.remoteAddress || 'unknown',
  now = Date.now,
} = {}) {
  const tracker = new Map();

  return (req, res, next) => {
    const currentTime = now();

    // Occasional cleanup of expired entries
    if (tracker.size > maxEntries * 0.8) {
      for (const [k, entry] of tracker) {
        if (entry.expires <= currentTime) {
          tracker.delete(k);
        }
      }
    }

    const key = keyGenerator(req);
    let record = tracker.get(key);

    if (!record || record.expires <= currentTime) {
      if (tracker.size >= maxEntries) {
        // Evict oldest if capacity is saturated
        const oldestKey = tracker.keys().next().value;
        tracker.delete(oldestKey);
      }
      record = { count: 0, expires: currentTime + windowMs };
      tracker.set(key, record);
    }

    if (record.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.expires - currentTime) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(statusCode).json({
        success: false,
        message,
        retryAfter: retryAfterSeconds,
      });
    }

    record.count++;
    next();
  };
}
