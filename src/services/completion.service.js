const orderService = require('./order.service');
const orderRepository = require('../repositories/order.repository');
const userRepository = require('../repositories/user.repository');
const messageRepository = require('../repositories/message.repository');
const logRepository = require('../repositories/log.repository');
const lineMessageService = require('./line-message.service');
const { completionMessage } = require('../templates/customer-messages');
const { ORDER_STATUS } = require('../utils/order-status');

function googleMapsUrl(address = '') {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`;
}

async function notifyEnRoute(orderId, technicianId = null) {
  const order = await orderRepository.getOrderDetail(orderId);
  if (!order) {
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }

  if (technicianId && String(order.technician_id) !== String(technicianId)) {
    const error = new Error('Technician does not own this order');
    error.statusCode = 403;
    throw error;
  }

  if (order.status !== ORDER_STATUS.IN_PROGRESS) {
    const error = new Error('Order is not ready for en route notification');
    error.statusCode = 409;
    throw error;
  }

  const alreadySent = (order.logs || []).some(
    (log) => log.action === 'technician_en_route'
  );

  if (!alreadySent) {
    await logRepository.createLog({
      order_id: order.id,
      from_status: order.status,
      to_status: order.status,
      action: 'technician_en_route',
      operator_role: 'technician',
      operator_id: technicianId,
      note: 'Technician is heading to the site',
    });

    const customer = await userRepository.findById(order.customer_id);
    if (customer?.line_user_id) {
      await lineMessageService.pushMessages(
        customer.line_user_id,
        [
          '師傅即將趕往現場',
          `案件編號：${order.order_no}`,
          `地址：${order.address || '未提供'}`,
          '請先留意電話並提前整理施工位置，方便師傅到場後直接處理。',
        ].join('\n')
      );
    }
  }

  return {
    ...order,
    en_route_notified: true,
    maps_url: googleMapsUrl(order.address),
    duplicate: alreadySent,
  };
}

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
  if (customer?.line_user_id) {
    await lineMessageService.pushMessages(
      customer.line_user_id,
      completionMessage(order)
    );
  }
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
      payload.comment || 'Customer did not confirm completion',
      {
        dispute_reason:
          payload.comment || 'Customer did not confirm completion',
      }
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

function normalizeRating(value) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    const error = new Error('Rating must be an integer from 1 to 5');
    error.statusCode = 400;
    throw error;
  }
  return rating;
}

async function submitCustomerReview(orderId, payload, customerId = null) {
  const order = await orderRepository.findById(orderId);
  if (!order) {
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }

  if (customerId && String(order.customer_id) !== String(customerId)) {
    const error = new Error('Customer does not own this order');
    error.statusCode = 403;
    throw error;
  }

  const rating = normalizeRating(payload.rating);
  const comment = String(payload.comment || '').trim();
  const updated = await orderRepository.updateOrder(orderId, {
    rating,
    customer_comment: comment || null,
  });

  await messageRepository.createMessage({
    order_id: order.id,
    sender_role: 'customer',
    sender_id: customerId,
    message_type: 'customer_review',
    content: comment || `Customer rated ${rating}/5 without comment`,
  });

  await logRepository.createLog({
    order_id: order.id,
    from_status: updated.status,
    to_status: updated.status,
    action: 'customer_review',
    operator_role: 'customer',
    operator_id: customerId,
    note: `Customer rated ${rating}/5`,
  });

  return updated;
}

async function submitTechnicianReview(orderId, technicianId, comment) {
  const order = await orderRepository.findById(orderId);
  if (!order) {
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }

  if (technicianId && String(order.technician_id) !== String(technicianId)) {
    const error = new Error('Technician does not own this order');
    error.statusCode = 403;
    throw error;
  }

  const content =
    String(comment || '').trim() || '師傅已提交本案心得，感謝此次服務。';
  const message = await messageRepository.createMessage({
    order_id: order.id,
    sender_role: 'technician',
    sender_id: technicianId,
    message_type: 'technician_review',
    content,
  });

  await logRepository.createLog({
    order_id: order.id,
    from_status: order.status,
    to_status: order.status,
    action: 'technician_review',
    operator_role: 'technician',
    operator_id: technicianId,
    note: content,
  });

  return { order, message };
}

module.exports = {
  notifyEnRoute,
  arrive,
  complete,
  customerConfirmCompletion,
  submitCustomerReview,
  submitTechnicianReview,
};
