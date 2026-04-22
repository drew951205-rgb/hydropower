const supportTicketRepository = require('../repositories/support-ticket.repository');
const orderRepository = require('../repositories/order.repository');
const orderService = require('./order.service');
const lineMessageService = require('./line-message.service');
const userRepository = require('../repositories/user.repository');
const messageRepository = require('../repositories/message.repository');
const assignmentRepository = require('../repositories/assignment.repository');
const { ORDER_STATUS } = require('../utils/order-status');

const cancellableStatuses = new Set([
  'pending_review',
  'pending_dispatch',
  'dispatching',
  'assigned',
  'quoted',
  'in_progress',
  'arrived',
  'platform_review',
]);

const disputeStatuses = new Set([
  'assigned',
  'quoted',
  'in_progress',
  'arrived',
  'completed_pending_customer',
  'platform_review',
]);

const disputeTypes = new Set([
  'completion_dispute',
  'quote_dispute',
  'technician_no_show',
  'service_quality',
  'cancel_order',
]);

const autoLinkedStatuses = new Set([
  ORDER_STATUS.PENDING_REVIEW,
  ORDER_STATUS.WAITING_CUSTOMER_INFO,
  ORDER_STATUS.PENDING_DISPATCH,
  ORDER_STATUS.DISPATCHING,
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.QUOTED,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.ARRIVED,
  ORDER_STATUS.COMPLETED_PENDING_CUSTOMER,
  ORDER_STATUS.PLATFORM_REVIEW,
  ORDER_STATUS.DISPUTE_REVIEW,
]);

function createTicketNo(prefix = 'CS') {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function forbidden(message) {
  return Object.assign(new Error(message), { statusCode: 403 });
}

function supportTitle(type, order) {
  const orderNo = order?.order_no ? ` ${order.order_no}` : '';
  return {
    general: `一般諮詢${orderNo}`.trim(),
    completion_dispute: `完工申訴${orderNo}`.trim(),
    quote_dispute: `報價申訴${orderNo}`.trim(),
    technician_no_show: `師傅未到場${orderNo}`.trim(),
    service_quality: `施工品質申訴${orderNo}`.trim(),
    cancel_order: `取消案件爭議${orderNo}`.trim(),
    customer_cancel: `客戶取消案件${orderNo}`.trim(),
    technician_cancel: `師傅取消案件${orderNo}`.trim(),
  }[type] || `客服單${orderNo}`.trim();
}

async function ensureCustomerOwnsOrder(user, orderId) {
  if (!orderId) return null;
  const order = await orderRepository.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (String(order.customer_id) !== String(user.id)) {
    throw forbidden('Customer does not own this order');
  }
  return order;
}

async function findLatestCustomerActiveOrder(user) {
  const orders = await orderRepository.listOrders({ customer_id: user.id });
  return (
    orders
      .filter((order) => autoLinkedStatuses.has(order.status))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] ||
    null
  );
}

async function createSupportTicket(user, payload = {}) {
  const message = String(payload.message || '').trim();
  if (!message) throw badRequest('Support message is required');
  const type = String(payload.type || 'general').trim() || 'general';

  const order = payload.order_id
    ? await ensureCustomerOwnsOrder(user, payload.order_id)
    : await findLatestCustomerActiveOrder(user);

  const ticket = await supportTicketRepository.createTicket({
    ticket_no: createTicketNo('CS'),
    user_id: user.id,
    order_id: order?.id || null,
    type,
    status: 'open',
    title: String(payload.title || '').trim() || supportTitle(type, order),
    message,
    phone: String(payload.phone || user.phone || '').trim() || null,
    image_urls: payload.image_urls || [],
  });

  console.log('[support-ticket:new]', JSON.stringify({
    ticket_no: ticket.ticket_no,
    type: ticket.type,
    user_id: ticket.user_id,
    order_id: ticket.order_id,
  }));

  if (order) {
    await messageRepository.createMessage({
      order_id: order.id,
      sender_role: 'customer',
      sender_id: user.id,
      message_type: 'support_ticket',
      content: `${ticket.ticket_no}\n${message}`,
    });
    if (type === 'completion_dispute' && disputeStatuses.has(order.status)) {
      await orderService.transitionOrder(
        order.id,
        'dispute_review',
        'customer_dispute',
        'customer',
        user.id,
        message,
        { dispute_reason: message }
      );
    } else if (disputeTypes.has(type) && order.status !== ORDER_STATUS.DISPUTE_REVIEW) {
      await orderRepository.updateOrder(order.id, {
        dispute_reason: message,
      }).catch(() => null);
    }
  }

  return ticket;
}

async function cancelOrderByCustomer(user, orderId, payload = {}) {
  const reason = String(payload.reason || '').trim();
  if (!reason) throw badRequest('Cancel reason is required');

  const order = await ensureCustomerOwnsOrder(user, orderId);
  if (!cancellableStatuses.has(order.status)) {
    const error = new Error('This order can no longer be cancelled');
    error.statusCode = 409;
    throw error;
  }

  const cancelled = await orderService.cancelOrder(
    order.id,
    {
      cancelled_by: 'customer',
      reason_code: String(payload.reason_code || 'customer_liff_cancel'),
      reason_text: reason,
    },
    'customer',
    user.id
  );

  const ticket = await supportTicketRepository.createTicket({
    ticket_no: createTicketNo('CC'),
    user_id: user.id,
    order_id: order.id,
    type: 'customer_cancel',
    status: 'closed',
    title: 'Customer cancelled order',
    message: reason,
    phone: String(payload.phone || user.phone || order.contact_phone || '').trim() || null,
    image_urls: [],
  });

  console.log('[support-ticket:customer-cancel]', JSON.stringify({
    ticket_no: ticket.ticket_no,
    user_id: user.id,
    order_id: order.id,
    reason,
  }));

  await messageRepository.createMessage({
    order_id: order.id,
    sender_role: 'customer',
    sender_id: user.id,
    message_type: 'customer_cancel',
    content: reason,
  });

  if (order.technician_id) {
    const technician = await userRepository.findById(order.technician_id);
    if (technician?.line_user_id) {
      await lineMessageService.pushMessages(
        technician.line_user_id,
        `顧客已取消案件 ${order.order_no}\n原因：${reason}`
      );
    }
  }

  return { order: cancelled, ticket };
}

async function cancelOrderByTechnician(user, orderId, payload = {}) {
  const reason = String(payload.reason || '').trim();
  if (!reason) throw badRequest('Cancel reason is required');

  const order = await orderRepository.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (String(order.technician_id) !== String(user.id)) {
    throw forbidden('Technician does not own this order');
  }
  if (!cancellableStatuses.has(order.status)) {
    const error = new Error('This order can no longer be cancelled');
    error.statusCode = 409;
    throw error;
  }

  const assignments = await assignmentRepository.listAssignments({
    order_id: order.id,
    technician_id: user.id,
  });
  await Promise.all(
    assignments
      .filter((assignment) => assignment.status === 'accepted')
      .map((assignment) =>
        assignmentRepository.updateAssignment(assignment.id, {
          status: 'rejected',
        })
      )
  );

  const requeued = await orderService.requeueAfterTechnicianCancel(order.id, user.id, reason);
  const ticket = await supportTicketRepository.createTicket({
    ticket_no: createTicketNo('TC'),
    user_id: user.id,
    order_id: order.id,
    type: 'technician_cancel',
    status: 'open',
    title: 'Technician cancelled order',
    message: reason,
    phone: String(payload.phone || user.phone || '').trim() || null,
    image_urls: [],
  });

  console.log('[support-ticket:technician-cancel]', JSON.stringify({
    ticket_no: ticket.ticket_no,
    technician_id: user.id,
    order_id: order.id,
    reason,
    next_step: 're_dispatch',
  }));

  await messageRepository.createMessage({
    order_id: order.id,
    sender_role: 'technician',
    sender_id: user.id,
    message_type: 'technician_cancel',
    content: reason,
  });

  const customer = await userRepository.findById(order.customer_id);
  if (customer?.line_user_id) {
    await lineMessageService.pushMessages(
      customer.line_user_id,
      `原師傅無法服務案件 ${order.order_no}\n原因：${reason}\n\n平台正在重新幫你安排師傅，請稍候通知。`
    );
  }

  return { order: requeued, ticket };
}

module.exports = {
  createSupportTicket,
  cancelOrderByCustomer,
  cancelOrderByTechnician,
};
