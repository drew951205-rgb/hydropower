const cron = require('node-cron');
const { runDispatchTimeoutJob } = require('./dispatch-timeout.job');
const { runUnpaidFollowupJob } = require('./unpaid-followup.job');
const { runStaleOrderJob } = require('./stale-order.job');
const { logger } = require('../config/logger');

function startBackgroundJobs() {
  cron.schedule('*/5 * * * *', runDispatchTimeoutJob);
  cron.schedule('0 * * * *', runStaleOrderJob);
  cron.schedule('0 9 * * *', runUnpaidFollowupJob);
  logger.info('[app] Background jobs scheduled');
}

module.exports = { startBackgroundJobs };
