const express = require('express');
const multer = require('multer');
const liffController = require('../controllers/liff.controller');
const { env } = require('../config/env');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.uploadMaxFileSize,
    files: env.uploadMaxFiles,
  },
});

router.get('/config', liffController.getConfig);
router.post('/repair', upload.array('images', env.uploadMaxFiles), liffController.createRepair);
router.get('/orders/:id', liffController.getOrder);
router.post('/orders/:id/quote', liffController.submitQuote);
router.post(
  '/orders/:id/change-request',
  upload.array('images', env.uploadMaxFiles),
  liffController.submitChangeRequest
);
router.post('/orders/:id/confirm-quote', liffController.confirmQuote);
router.post('/orders/:id/confirm-completion', liffController.confirmCompletion);
router.post('/orders/:id/customer-review', liffController.submitCustomerReview);
router.post('/orders/:id/technician-review', liffController.submitTechnicianReview);
router.get('/technician/orders', liffController.listTechnicianOrders);

module.exports = router;
