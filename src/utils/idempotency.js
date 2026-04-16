const processedKeys = new Map();
const ttlMs = 10 * 60 * 1000;

function getEventKey(event) {
  return event.webhookEventId || `${event.type}:${event.replyToken || ''}:${event.timestamp || ''}`;
}

function wasProcessed(key) {
  const now = Date.now();
  for (const [storedKey, expiresAt] of processedKeys.entries()) {
    if (expiresAt <= now) processedKeys.delete(storedKey);
  }
  if (processedKeys.has(key)) return true;
  processedKeys.set(key, now + ttlMs);
  return false;
}

module.exports = { getEventKey, wasProcessed };
