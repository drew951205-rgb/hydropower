const { securityConfig } = require('../config/security');

const buckets = new Map();

function rateLimit(req, res, next) {
  const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const bucket = buckets.get(key) || {
    count: 0,
    resetAt: now + securityConfig.rateLimitWindowMs,
  };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + securityConfig.rateLimitWindowMs;
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count > securityConfig.rateLimitMax)
    return res.status(429).json({ error: 'Too many requests' });
  next();
}

module.exports = { rateLimit };
