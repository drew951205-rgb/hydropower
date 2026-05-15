const { logger } = require('../config/logger');
function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('http_request', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
}

module.exports = { requestLogger };
