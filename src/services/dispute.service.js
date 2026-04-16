const orderService = require('./order.service');
const { ORDER_STATUS } = require('../utils/order-status');

async function platformReview(orderId, reason, operator = { role: 'admin', id: null }) {
  return orderService.transitionOrder(orderId, ORDER_STATUS.PLATFORM_REVIEW, 'platform_review', operator.role, operator.id, reason, {
    platform_review_reason: reason
  });
}

async function customerDispute(orderId, reason, customerId = null) {
  return orderService.transitionOrder(orderId, ORDER_STATUS.DISPUTE_REVIEW, 'customer_dispute', 'customer', customerId, reason, {
    dispute_reason: reason
  });
}

module.exports = { platformReview, customerDispute };
