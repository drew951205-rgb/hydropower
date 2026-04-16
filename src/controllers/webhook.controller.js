const webhookService = require('../services/webhook.service');

async function receiveWebhook(req, res, next) {
  try {
    res.json(await webhookService.handleWebhook(req.body || {}));
  } catch (error) {
    next(error);
  }
}

module.exports = { receiveWebhook };
