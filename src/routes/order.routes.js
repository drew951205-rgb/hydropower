const express = require('express');
const orderController = require('../controllers/order.controller');
const { authAdmin } = require('../middlewares/auth-admin');

const router = express.Router();

router.get('/', authAdmin, orderController.listOrders);
router.get('/:id', authAdmin, orderController.getOrder);
router.post('/:id/review', authAdmin, orderController.reviewOrder);
router.post('/:id/dispatch', authAdmin, orderController.dispatchOrder);
router.post('/:id/assign', authAdmin, orderController.assignOrder);
router.post('/:id/cancel', authAdmin, orderController.cancelOrder);
router.post('/:id/platform-review', authAdmin, orderController.platformReview);
router.post('/:id/arrive', authAdmin, orderController.arrive);
router.post('/:id/quote', authAdmin, orderController.quote);
router.post('/:id/change-request', authAdmin, orderController.changeRequest);
router.post('/:id/complete', authAdmin, orderController.complete);
router.post('/:id/customer-confirm-quote', authAdmin, orderController.customerConfirmQuote);
router.post('/:id/customer-confirm-completion', authAdmin, orderController.customerConfirmCompletion);
router.post('/:id/customer-dispute', authAdmin, orderController.customerDispute);

module.exports = router;
