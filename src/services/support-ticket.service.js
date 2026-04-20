const supportTicketRepository = require('../repositories/support-ticket.repository');
const orderRepository = require('../repositories/order.repository');
const orderService = require('./order.service');
const lineMessageService = require('./line-message.service');
const userRepository = require('../repositories/user.repository');
const messageRepository = require('../repositories/message.repository');
const assignmentRepository = require('../repositories/assignment.repository');

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

async function ensureCustomerOwnsOrder(user, orderId) {
  if (!orderId) return null;
  const order = await orderRepository.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (String(order.customer_id) !== String(user.id)) {
    throw forbidden('Customer does not own this order');
  }
  return order;
}

async function createSupportTicket(user, payload = {}) {
  const message = String(payload.message || '').trim();
  if (!message) throw badRequest('Support message is required');

  const order = payload.order_id
    ? await ensureCustomerOwnsOrder(user, payload.order_id)
    : null;

  const ticket = await supportTicketRepository.createTicket({
    ticket_no: createTicketNo('CS'),
    user_id: user.id,
    order_id: order?.id || null,
    type: String(payload.type || 'general').trim() || 'general',
    status: 'open',
    title: String(payload.title || '').trim() || 'Customer support request',
    message,
    phone: String(payload.phone || user.phone || '').trim() || null,
    image_urls: payload.image_urls || [],
  });

  if (order) {
    await messageRepository.createMessage({
      order_id: order.id,
      sender_role: 'customer',
      sender_id: user.id,
      message_type: 'support_ticket',
      content: `${ticket.ticket_no}\n${message}`,
    });
    if (payload.type === 'completion_dispute' && disputeStatuses.has(order.status)) {
      await orderService.transitionOrder(
        order.id,
        'dispute_review',
        'customer_dispute',
        'customer',
        user.id,
        message,
        { dispute_reason: message }
      );
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
    status: 'closed',
    title: 'Technician cancelled order',
    message: reason,
    phone: String(payload.phone || user.phone || '').trim() || null,
    image_urls: [],
  });

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
      `師傅取消案件 ${order.order_no}\n原因：${reason}\n平台會重新幫你安排師傅。`
    );
  }

  return { order: requeued, ticket };
}

module.exports = {
  createSupportTicket,
  cancelOrderByCustomer,
  cancelOrderByTechnician,
};
