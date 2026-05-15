const expressRateLimit = require('express-rate-limit');

const rateLimit = expressRateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    error: 'Too many requests',
  },
});

function resetRateLimit() {
  if (rateLimit.store && typeof rateLimit.store.resetAll === 'function') {
    rateLimit.store.resetAll();
  }
}

module.exports = { rateLimit, resetRateLimit };
