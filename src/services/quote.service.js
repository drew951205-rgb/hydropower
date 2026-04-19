const orderRepository = require('../repositories/order.repository');
const userRepository = require('../repositories/user.repository');
const orderService = require('./order.service');
const lineMessageService = require('./line-message.service');
const {
  quoteMessage,
  changeRequestMessage,
} = require('../templates/customer-messages');
const {
  acceptedQuoteTechnicianMessage,
  acceptedChangeRequestTechnicianMessage,
} = require('../templates/technician-messages');
const { ORDER_STATUS } = require('../utils/order-status');

async function submitQuote(orderId, payload, technicianId = null) {
  if (!Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0) {
    throw Object.assign(new Error('Quote amount must be greater than 0'), {
      statusCode: 400,
    });
  }

  const order = await orderService.transitionOrder(
    orderId,
    ORDER_STATUS.QUOTED,
    'submit_quote',
    'technician',
    technicianId,
    payload.note || 'Technician submitted quote',
    {
      quote_amount: Number(payload.amount),
    }
  );
  await pushToCustomer(order, quoteMessage(order));
  return order;
}

async function confirmQuote(orderId, accepted, customerId = null) {
  const order = await orderRepository.findById(orderId);
  if (!order) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  const isChangeRequest =
    order.status === ORDER_STATUS.PLATFORM_REVIEW &&
    order.change_request_status === 'pending';
  const extra = isChangeRequest
    ? { change_request_status: accepted ? 'approved' : 'rejected' }
    : {};

  const nextStatus = accepted
    ? isChangeRequest
      ? ORDER_STATUS.ARRIVED
      : ORDER_STATUS.IN_PROGRESS
    : ORDER_STATUS.PLATFORM_REVIEW;

  const updated = await orderService.transitionOrder(
    orderId,
    nextStatus,
    accepted ? 'customer_accept_quote' : 'customer_reject_quote',
    'customer',
    customerId,
    accepted
      ? 'Customer accepted quote or change request'
      : 'Customer rejected quote or change request',
    extra
  );

  if (accepted) {
    const message = isChangeRequest
      ? acceptedChangeRequestTechnicianMessage(updated)
      : acceptedQuoteTechnicianMessage(updated);
    await pushToTechnician(updated, message);
  }
  return updated;
}

async function submitChangeRequest(orderId, payload, technicianId = null) {
  if (!Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0) {
    throw Object.assign(
      new Error('Change request amount must be greater than 0'),
      { statusCode: 400 }
    );
  }

  await orderService.addImages(orderId, payload.images || [], 'change_request');
  const order = await orderService.transitionOrder(
    orderId,
    ORDER_STATUS.PLATFORM_REVIEW,
    'submit_change_request',
    'technician',
    technicianId,
    payload.reason,
    {
      change_request_amount: Number(payload.amount),
      change_request_reason: payload.reason,
      change_request_status: 'pending',
    }
  );
  await pushToCustomer(order, changeRequestMessage(order));
  return order;
}

async function pushToCustomer(order, message) {
  const customer = await userRepository.findById(order.customer_id);
  if (!customer?.line_user_id) {
    console.warn('[quote:customer-push:skip]', JSON.stringify({
      orderId: order.id,
      customerId: order.customer_id,
      reason: 'missing_customer_line_user_id'
    }));
    return { skipped: true };
  }

  return lineMessageService.pushMessages(customer.line_user_id, message);
}

async function pushToTechnician(order, message) {
  const technician = await userRepository.findById(order.technician_id);
  if (!technician?.line_user_id) {
    console.warn('[quote:technician-push:skip]', JSON.stringify({
      orderId: order.id,
      technicianId: order.technician_id,
      reason: 'missing_technician_line_user_id'
    }));
    return { skipped: true };
  }

  console.log('[quote:technician-push]', JSON.stringify({
    orderId: order.id,
    orderNo: order.order_no,
    technicianId: technician.id,
    lineUserId: technician.line_user_id
  }));

  return lineMessageService.pushMessages(technician.line_user_id, message);
}

module.exports = { submitQuote, confirmQuote, submitChangeRequest };
