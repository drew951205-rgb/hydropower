const orderRepository = require('../repositories/order.repository');
const logRepository = require('../repositories/log.repository');
const messageRepository = require('../repositories/message.repository');
const imageRepository = require('../repositories/image.repository');
const { ORDER_STATUS } = require('../utils/order-status');
const { calculatePriorityScore } = require('../utils/priority-score');
const { calculateRiskScore } = require('../utils/risk-score');

const terminalStatuses = new Set([
  ORDER_STATUS.CLOSED,
  ORDER_STATUS.CUSTOMER_CANCELLED,
  ORDER_STATUS.TECHNICIAN_CANCELLED,
  ORDER_STATUS.PLATFORM_CANCELLED
]);

const allowedFromByAction = {
  customer_create_order: [null],
  review_approve: [ORDER_STATUS.PENDING_REVIEW],
  review_request_more_info: [ORDER_STATUS.PENDING_REVIEW],
  review_reject: [ORDER_STATUS.PENDING_REVIEW],
  dispatch_order: [ORDER_STATUS.PENDING_DISPATCH, ORDER_STATUS.DISPATCHING],
  manual_assign_order: [ORDER_STATUS.PENDING_DISPATCH, ORDER_STATUS.DISPATCHING],
  accept_assignment: [ORDER_STATUS.PENDING_DISPATCH, ORDER_STATUS.DISPATCHING],
  technician_arrived: [ORDER_STATUS.IN_PROGRESS],
  submit_quote: [ORDER_STATUS.ASSIGNED],
  customer_accept_quote: [ORDER_STATUS.QUOTED, ORDER_STATUS.PLATFORM_REVIEW],
  customer_reject_quote: [ORDER_STATUS.QUOTED, ORDER_STATUS.PLATFORM_REVIEW],
  submit_change_request: [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.ARRIVED],
  technician_complete: [ORDER_STATUS.ARRIVED],
  customer_confirm_completion: [ORDER_STATUS.COMPLETED_PENDING_CUSTOMER],
  customer_dispute_completion: [ORDER_STATUS.COMPLETED_PENDING_CUSTOMER],
  customer_dispute: [
    ORDER_STATUS.ASSIGNED,
    ORDER_STATUS.ARRIVED,
    ORDER_STATUS.QUOTED,
    ORDER_STATUS.IN_PROGRESS,
    ORDER_STATUS.COMPLETED_PENDING_CUSTOMER,
    ORDER_STATUS.PLATFORM_REVIEW
  ],
  platform_review: [
    ORDER_STATUS.PENDING_REVIEW,
    ORDER_STATUS.PENDING_DISPATCH,
    ORDER_STATUS.DISPATCHING,
    ORDER_STATUS.ASSIGNED,
    ORDER_STATUS.ARRIVED,
    ORDER_STATUS.QUOTED,
    ORDER_STATUS.IN_PROGRESS,
    ORDER_STATUS.COMPLETED_PENDING_CUSTOMER
  ]
};

function createOrderNo() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `CJ-${stamp}-${suffix}`;
}

function assertTransitionAllowed(fromStatus, toStatus, action) {
  if (action === 'cancel_order') {
    if (terminalStatuses.has(fromStatus)) {
      throwTransitionError(fromStatus, toStatus, action);
    }
    return;
  }

  const allowed = allowedFromByAction[action];
  if (!allowed) return;

  if (!allowed.includes(fromStatus)) {
    throwTransitionError(fromStatus, toStatus, action);
  }
}

function throwTransitionError(fromStatus, toStatus, action) {
  const error = new Error(`Invalid order transition: ${fromStatus || 'none'} -> ${toStatus} (${action})`);
  error.statusCode = 409;
  throw error;
}

async function createRepairOrder(customer, payload) {
  const order = await orderRepository.createOrder({
    order_no: createOrderNo(),
    customer_id: customer.id,
    technician_id: null,
    service_type: payload.service_type,
    area: payload.area,
    address: payload.address,
    issue_description: payload.issue_description,
    contact_phone: payload.contact_phone,
    status: ORDER_STATUS.PENDING_REVIEW,
    quote_amount: null,
    final_amount: null,
    priority_score: calculatePriorityScore(payload),
    risk_score: calculateRiskScore(payload),
    change_request_amount: null,
    change_request_reason: null
  });

  await logStatus(order, null, ORDER_STATUS.PENDING_REVIEW, 'customer_create_order', 'customer', customer.id, 'Customer completed repair intake');
  await messageRepository.createMessage({
    order_id: order.id,
    sender_role: 'customer',
    sender_id: customer.id,
    message_type: 'text',
    content: payload.issue_description
  });

  return order;
}

async function transitionOrder(orderId, toStatus, action, operatorRole, operatorId, note, extra = {}) {
  const order = await orderRepository.findById(orderId);
  if (!order) {
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }

  const fromStatus = order.status;
  assertTransitionAllowed(fromStatus, toStatus, action);

  const updated = await orderRepository.updateOrder(orderId, { ...extra, status: toStatus });
  await logStatus(updated, fromStatus, toStatus, action, operatorRole, operatorId, note);
  return updated;
}

async function logStatus(order, fromStatus, toStatus, action, operatorRole, operatorId, note) {
  return logRepository.createLog({
    order_id: order.id,
    from_status: fromStatus,
    to_status: toStatus,
    action,
    operator_role: operatorRole,
    operator_id: operatorId,
    note
  });
}

async function listOrders(filters) {
  return orderRepository.listOrders(filters);
}

async function getOrderDetail(id) {
  const detail = await orderRepository.getOrderDetail(id);
  if (!detail) {
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }
  return detail;
}

async function cancelOrder(id, payload, operatorRole = 'admin', operatorId = null) {
  const status = payload.cancelled_by === 'customer'
    ? ORDER_STATUS.CUSTOMER_CANCELLED
    : payload.cancelled_by === 'technician'
      ? ORDER_STATUS.TECHNICIAN_CANCELLED
      : ORDER_STATUS.PLATFORM_CANCELLED;

  return transitionOrder(id, status, 'cancel_order', operatorRole, operatorId, payload.reason_text, {
    cancelled_by: payload.cancelled_by,
    cancel_reason_code: payload.reason_code,
    cancel_reason_text: payload.reason_text
  });
}

async function addImages(orderId, images, category) {
  return imageRepository.createImages(orderId, images, category);
}

module.exports = { createRepairOrder, transitionOrder, listOrders, getOrderDetail, cancelOrder, addImages };
