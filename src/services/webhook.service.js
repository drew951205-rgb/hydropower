const eventRouter = require('./event-router.service');
const { getEventKey, wasProcessed } = require('../utils/idempotency');

async function handleWebhook(body) {
  const events = Array.isArray(body.events) ? body.events : [];
  const results = [];
  for (const event of events) {
    const key = getEventKey(event);
    if (key && wasProcessed(key)) {
      results.push({ duplicate: true });
      continue;
    }
    results.push(await eventRouter.routeEvent(event));
  }
  return { ok: true, results };
}

module.exports = { handleWebhook };
