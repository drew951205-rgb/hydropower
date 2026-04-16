const express = require('express');
const webhookController = require('../controllers/webhook.controller');
const { verifyLineSignature } = require('../middlewares/verify-line-signature');

const router = express.Router();
router.post('/', verifyLineSignature, webhookController.receiveWebhook);

module.exports = router;
