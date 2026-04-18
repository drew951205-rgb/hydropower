const cron = require('node-cron');
const { runDispatchTimeoutJob } = require('./dispatch-timeout.job');
const { runUnpaidFollowupJob } = require('./unpaid-followup.job');
const { runStaleOrderJob } = require('./stale-order.job');

function startBackgroundJobs() {
  cron.schedule('*/5 * * * *', runDispatchTimeoutJob);
  cron.schedule('0 * * * *', runStaleOrderJob);
  cron.schedule('0 9 * * *', runUnpaidFollowupJob);
  console.log('[app] Background jobs scheduled');
}

module.exports = { startBackgroundJobs };
