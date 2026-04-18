const orderService = require('./order.service');
const userRepository = require('../repositories/user.repository');
const lineMessageService = require('./line-message.service');
const { completionMessage } = require('../templates/customer-messages');
const { ORDER_STATUS } = require('../utils/order-status');

async function arrive(orderId, technicianId = null) {
  return orderService.transitionOrder(
    orderId,
    ORDER_STATUS.ARRIVED,
    'technician_arrived',
    'technician',
    technicianId,
    'Technician arrived'
  );
}

async function complete(orderId, payload, technicianId = null) {
  await orderService.addImages(orderId, payload.images || [], 'completion');
  const order = await orderService.transitionOrder(
    orderId,
    ORDER_STATUS.COMPLETED_PENDING_CUSTOMER,
    'technician_complete',
    'technician',
    technicianId,
    payload.summary,
    {
      final_amount: Number(payload.final_amount || 0),
      completion_summary: payload.summary,
    }
  );
  const customer = await userRepository.findById(order.customer_id);
  if (customer?.line_user_id)
    await lineMessageService.pushMessages(
      customer.line_user_id,
      completionMessage(order)
    );
  return order;
}

async function customerConfirmCompletion(orderId, payload, customerId = null) {
  if (!payload.confirmed) {
    return orderService.transitionOrder(
      orderId,
      ORDER_STATUS.DISPUTE_REVIEW,
      'customer_dispute_completion',
      'customer',
      customerId,
      payload.comment || 'Customer did not confirm completion'
    );
  }

  return orderService.transitionOrder(
    orderId,
    ORDER_STATUS.CLOSED,
    'customer_confirm_completion',
    'customer',
    customerId,
    payload.comment || 'Customer confirmed completion',
    {
      paid_amount: Number(payload.paid_amount || 0),
      rating: payload.rating,
      customer_comment: payload.comment,
    }
  );
}

module.exports = { arrive, complete, customerConfirmCompletion };
