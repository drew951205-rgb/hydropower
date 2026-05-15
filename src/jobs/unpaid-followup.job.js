const { logger } = require('../config/logger');
function runUnpaidFollowupJob() {
  logger.info(
    '[job] unpaid-followup placeholder: MVP does not collect payments'
  );
}

module.exports = { runUnpaidFollowupJob };
