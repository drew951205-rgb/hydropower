const { logger } = require('../config/logger');
function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    logger.error('unhandled_error', {
      message: error.message,
      stack: error.stack,
      method: req.method,
      url: req.originalUrl,
      statusCode,
    });
  }
  res
    .status(statusCode)
    .json({ error: error.message || 'Internal server error' });
}

module.exports = { notFound, errorHandler };
