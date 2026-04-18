const dispatchService = require('./dispatch.service');
const completionService = require('./completion.service');
const quoteService = require('./quote.service');
const orderService = require('./order.service');
const orderRepository = require('../repositories/order.repository');
const userRepository = require('../repositories/user.repository');
const sessionRepository = require('../repositories/session.repository');
const lineMessageService = require('./line-message.service');
const {
  quotePromptMessage,
  changeRequestPromptMessage,
} = require('../templates/technician-messages');
const { ORDER_STATUS } = require('../utils/order-status');

function parseQuoteText(text) {
  const match = String(text || '')
    .trim()
    .match(/^報價\s+(?:(\d+)\s+)?(\d+)(?:\s+(.+))?$/);
  if (!match) return null;

  return {
    orderId: match[1] || null,
    amount: Number(match[2]),
    note: match[3] || 'Technician submitted quote from LINE',
  };
}

function parseChangeRequestText(text) {
  const match = String(text || '')
    .trim()
    .match(/^(?:追加|追價|追加報價)\s+(?:(\d+)\s+)?(\d+)(?:\s+(.+))?$/);
  if (!match) return null;

  return {
    orderId: match[1] || null,
    amount: Number(match[2]),
    reason: match[3] || 'Technician submitted change request from LINE',
  };
}

async function findQuoteOrder(user, quote) {
  if (quote.orderId) {
    const order = await orderRepository.findById(quote.orderId);
    return { order, explicitOrderId: true };
  }

  const orders = await orderRepository.listOrders({
    technician_id: user.id,
    status: ORDER_STATUS.ASSIGNED,
  });

  if (orders.length === 1) return { order: orders[0], explicitOrderId: false };
  return { order: null, activeOrders: orders, explicitOrderId: false };
}

async function findChangeRequestOrder(user, changeRequest) {
  if (changeRequest.orderId) {
    const order = await orderRepository.findById(changeRequest.orderId);
    return { order, explicitOrderId: true };
  }

  const orders = (
    await Promise.all([
      orderRepository.listOrders({
        technician_id: user.id,
        status: ORDER_STATUS.IN_PROGRESS,
      }),
      orderRepository.listOrders({
        technician_id: user.id,
        status: ORDER_STATUS.ARRIVED,
      }),
    ])
  ).flat();

  if (orders.length === 1) return { order: orders[0], explicitOrderId: false };
  return { order: null, activeOrders: orders, explicitOrderId: false };
}

async function handleTechnicianText(user, event, text) {
  const session = await sessionRepository.findByUserId(user.id);
  if (session?.flow_type === 'technician_review')
    return handleTechnicianReviewText(user, event, session, text);

  const changeRequest = parseChangeRequestText(text);
  if (changeRequest) return submitLineChangeRequest(user, event, changeRequest);

  const quote = parseQuoteText(text);
  if (quote) return submitLineQuote(user, event, quote);

  await lineMessageService.replyText(
    event,
    '如果要回報報價，請輸入「報價 1500」。如果要追加報價，請輸入「追加 500 更換零件」。'
  );
  return { technicianMessage: true };
}

async function handleTechnicianReviewText(user, event, session, text) {
  const payload = session.temp_payload || {};
  const comment = /^(略過|跳過|skip)$/i.test(String(text || '').trim())
    ? ''
    : text;

  const result = await completionService.submitTechnicianReview(
    payload.order_id,
    user.id,
    comment
  );
  await sessionRepository.clearForUser(user.id);
  await lineMessageService.replyText(event, '謝謝，已記錄你的本案心得。');
  return { technicianReviewSubmitted: true, ...result };
}

async function submitLineQuote(user, event, quote) {
  const { order, activeOrders, explicitOrderId } = await findQuoteOrder(
    user,
    quote
  );

  if (!order) {
    if (activeOrders?.length > 1) {
      await lineMessageService.replyText(
        event,
        [
          '你目前有多張已接單案件，請加上案件 ID。',
          '',
          ...activeOrders.map((item) => `${item.id}：${item.order_no}`),
          '',
          '範例：報價 3 1500',
        ].join('\n')
      );
      return { quoteSubmitted: false, reason: 'multiple_assigned_orders' };
    }

    await lineMessageService.replyText(
      event,
      explicitOrderId
        ? '找不到這張案件，請確認案件 ID 是否正確。'
        : '目前沒有可報價的已接單案件。'
    );
    return { quoteSubmitted: false, reason: 'order_not_found' };
  }

  if (String(order.technician_id) !== String(user.id)) {
    await lineMessageService.replyText(event, '這張案件不是由你接單，不能報價。');
    return { quoteSubmitted: false, reason: 'wrong_technician' };
  }

  if (order.status !== ORDER_STATUS.ASSIGNED) {
    await lineMessageService.replyText(
      event,
      '這張案件目前不能報價，請確認案件狀態。'
    );
    return { quoteSubmitted: false, reason: 'not_assigned' };
  }

  const updated = await quoteService.submitQuote(
    order.id,
    {
      amount: quote.amount,
      note: quote.note,
    },
    user.id
  );

  await lineMessageService.replyText(
    event,
    `已送出報價 ${quote.amount} 元，等待客戶確認。`
  );
  return { quoteSubmitted: true, order: updated };
}

async function submitLineChangeRequest(user, event, changeRequest) {
  const { order, activeOrders, explicitOrderId } = await findChangeRequestOrder(
    user,
    changeRequest
  );

  if (!order) {
    if (activeOrders?.length > 1) {
      await lineMessageService.replyText(
        event,
        [
          '你目前有多張進行中案件，請加上案件 ID。',
          '',
          ...activeOrders.map((item) => `${item.id}：${item.order_no}`),
          '',
          '範例：追加 3 500 更換零件',
        ].join('\n')
      );
      return { changeRequestSubmitted: false, reason: 'multiple_active_orders' };
    }

    await lineMessageService.replyText(
      event,
      explicitOrderId
        ? '找不到這張案件，請確認案件 ID 是否正確。'
        : '目前沒有可追加報價的進行中案件。'
    );
    return { changeRequestSubmitted: false, reason: 'order_not_found' };
  }

  if (String(order.technician_id) !== String(user.id)) {
    await lineMessageService.replyText(
      event,
      '這張案件不是由你接單，不能追加報價。'
    );
    return { changeRequestSubmitted: false, reason: 'wrong_technician' };
  }

  if (![ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.ARRIVED].includes(order.status)) {
    await lineMessageService.replyText(
      event,
      '這張案件目前不能追加報價，請等客戶同意原報價後再操作。'
    );
    return { changeRequestSubmitted: false, reason: 'invalid_status' };
  }

  const updated = await quoteService.submitChangeRequest(
    order.id,
    {
      amount: changeRequest.amount,
      reason: changeRequest.reason,
      images: [],
    },
    user.id
  );

  await lineMessageService.replyText(
    event,
    `已送出追加報價 ${changeRequest.amount} 元，等待客戶確認。`
  );
  return { changeRequestSubmitted: true, order: updated };
}

async function cancelByTechnician(user, event, orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) {
    await lineMessageService.replyText(event, '找不到這張案件，請確認案件 ID。');
    return null;
  }

  if (String(order.technician_id) !== String(user.id)) {
    await lineMessageService.replyText(event, '這張案件不是由你接單，不能取消。');
    return { cancelled: false, reason: 'wrong_technician' };
  }

  const cancelled = await orderService.cancelOrder(
    order.id,
    {
      cancelled_by: 'technician',
      reason_code: 'line_technician_cancel',
      reason_text: 'Technician cancelled from LINE',
    },
    'technician',
    user.id
  );

  const customer = await userRepository.findById(cancelled.customer_id);
  if (customer?.line_user_id) {
    await lineMessageService.pushMessages(
      customer.line_user_id,
      `師傅已取消案件 ${cancelled.order_no}，平台會協助重新安排。`
    );
  }

  await lineMessageService.replyText(event, '已取消案件，平台已記錄。');
  return { cancelled: true, order: cancelled };
}

async function startTechnicianReview(user, event, order) {
  await sessionRepository.upsertForUser(user.id, {
    flow_type: 'technician_review',
    current_step: 'comment',
    temp_payload: { order_id: order.id },
  });
  await lineMessageService.replyText(
    event,
    '已送出完工回報，請等待客戶確認。\n\n也請回覆本案心得，或輸入「略過」。'
  );
}

async function handleTechnicianPostback(user, event, data) {
  const [role, action, id] = data.split(':');
  if (role !== 'technician') return null;

  if (action === 'accept_assignment') {
    const order = await dispatchService.acceptAssignment(id, user);
    await lineMessageService.replyText(
      event,
      '接單成功，請先回報報價，客戶接受後再前往。'
    );
    return order;
  }

  if (action === 'arrived') {
    const order = await completionService.arrive(id, user.id);
    await lineMessageService.replyText(
      event,
      '已記錄到場。若現場有額外項目，請輸入「追加 500 更換零件」；完工後請按「完工回報」。'
    );
    return order;
  }

  if (action === 'quote') {
    const order = await orderRepository.findById(id);
    if (!order) {
      await lineMessageService.replyText(event, '找不到這張案件。');
      return null;
    }

    if (order.status !== ORDER_STATUS.ASSIGNED) {
      await lineMessageService.replyText(
        event,
        '這張案件目前不能報價，請確認案件狀態。'
      );
      return order;
    }

    await lineMessageService.replyMessages(event, quotePromptMessage(order));
    return order;
  }

  if (action === 'change_request') {
    const order = await orderRepository.findById(id);
    if (!order) {
      await lineMessageService.replyText(event, '找不到這張案件。');
      return null;
    }

    if (![ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.ARRIVED].includes(order.status)) {
      await lineMessageService.replyText(
        event,
        '這張案件目前不能追加報價，請等客戶同意原報價後再操作。'
      );
      return order;
    }

    await lineMessageService.replyMessages(event, changeRequestPromptMessage(order));
    return order;
  }

  if (action === 'complete') {
    const order = await orderRepository.findById(id);
    if (order?.status !== ORDER_STATUS.ARRIVED) {
      await lineMessageService.replyText(
        event,
        '請先確認已到場，再送出完工回報。'
      );
      return order;
    }

    const amount =
      Number(order.quote_amount || 0) + Number(order.change_request_amount || 0);
    const completed = await completionService.complete(
      id,
      {
        final_amount: amount,
        summary: 'Technician completed from LINE button',
        images: [],
      },
      user.id
    );
    await startTechnicianReview(user, event, completed);
    return completed;
  }

  if (action === 'cancel') return cancelByTechnician(user, event, id);

  return null;
}

module.exports = {
  handleTechnicianText,
  handleTechnicianPostback,
  parseQuoteText,
  parseChangeRequestText,
};
