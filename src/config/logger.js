const path = require('path');
const winston = require('winston');

const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'shi-fu-di-jia-platform' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'error.log'),
      level: 'error',
    }),
  ],
});

function normalizePayload(message, payload) {
  if (payload === undefined) return { message };

  if (payload instanceof Error) {
    return {
      message,
      errorMessage: payload.message,
      stack: payload.stack,
    };
  }

  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { message, ...parsed };
      }
      return { message, detail: parsed };
    } catch {
      return { message, detail: payload };
    }
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { message, ...payload };
  }

  return { message, detail: payload };
}

const logger = {
  info(message, payload) {
    baseLogger.info(normalizePayload(message, payload));
  },
  warn(message, payload) {
    baseLogger.warn(normalizePayload(message, payload));
  },
  error(message, payload) {
    baseLogger.error(normalizePayload(message, payload));
  },
  debug(message, payload) {
    baseLogger.debug(normalizePayload(message, payload));
  },
};

module.exports = { logger };
