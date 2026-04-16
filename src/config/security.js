const { env } = require('./env');

const securityConfig = {
  rateLimitWindowMs: env.rateLimitWindowMs,
  rateLimitMax: env.rateLimitMax
};

module.exports = { securityConfig };
