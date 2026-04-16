const dispatchService = require('./dispatch.service');
const completionService = require('./completion.service');
const quoteService = require('./quote.service');
const orderRepository = require('../repositories/order.repository');
const lineMessageService = require('./line-message.service');
const { quotePromptMessage } = require('../templates/technician-messages');
const { ORDER_STATUS } = require('../utils/order-status');

function parseQuoteText(text) {
  const match = String(text || '').trim().match(/^報價\s+(?:(\d+)\s+)?(\d+)(?:\s+(.+))?$/);
  if (!match) return null;

  return {
    orderId: match[1] || null,
    amount: Number(match[2]),
    note: match[3] || 'Technician submitted quote from LINE'
  };
}

async function findQuoteOrder(user, quote) {
  if (quote.orderId) {
    const order = await orderRepository.findById(quote.orderId);
    return { order, explicitOrderId: true };
  }

  const orders = await orderRepository.listOrders({
    technician_id: user.id,
    status: ORDER_STATUS.ARRIVED
  });

  if (orders.length === 1) return { order: orders[0], explicitOrderId: false };
  return { order: null, activeOrders: orders, explicitOrderId: false };
}

async function handleTechnicianText(user, event, text) {
  const quote = parseQuoteText(text);
  if (quote) return submitLineQuote(user, event, quote);

  await lineMessageService.replyText(event, '請使用案件按鈕操作；若要報價，請輸入「報價 金額」，例如：報價 1500。');
  return { technicianMessage: true };
}

async function submitLineQuote(user, event, quote) {
  const { order, activeOrders, explicitOrderId } = await findQuoteOrder(user, quote);

  if (!order) {
    if (activeOrders?.length > 1) {
      await lineMessageService.replyText(event, [
        '你目前有多張已到場案件，請加上案件 ID。',
        '',
        ...activeOrders.map((item) => `${item.id}：${item.order_no}`),
        '',
        '例如：報價 3 1500'
      ].join('\n'));
      return { quoteSubmitted: false, reason: 'multiple_arrived_orders' };
    }

    await lineMessageService.replyText(event, explicitOrderId ? '找不到這張案件，請確認案件 ID 是否正確。' : '目前找不到已到場案件，請先按「已到場」。');
    return { quoteSubmitted: false, reason: 'order_not_found' };
  }

  if (String(order.technician_id) !== String(user.id)) {
    await lineMessageService.replyText(event, '這張案件不是指派給你的案件，無法報價。');
    return { quoteSubmitted: false, reason: 'wrong_technician' };
  }

  if (order.status !== ORDER_STATUS.ARRIVED) {
    await lineMessageService.replyText(event, '請先按「已到場」，到場後才能送出報價。');
    return { quoteSubmitted: false, reason: 'not_arrived' };
  }

  const updated = await quoteService.submitQuote(order.id, {
    amount: quote.amount,
    note: quote.note
  }, user.id);

  await lineMessageService.replyText(event, `已送出報價 ${quote.amount} 元，等待客戶確認。`);
  return { quoteSubmitted: true, order: updated };
}

async function handleTechnicianPostback(user, event, data) {
  const [role, action, id] = data.split(':');
  if (role !== 'technician') return null;

  if (action === 'accept_assignment') {
    const order = await dispatchService.acceptAssignment(id, user);
    await lineMessageService.replyText(event, '接單成功，請依案件資訊前往現場。');
    return order;
  }

  if (action === 'arrived') {
    const order = await completionService.arrive(id, user.id);
    await lineMessageService.replyMessages(event, [
      { type: 'text', text: '已記錄到場。請回報報價給客戶確認。' },
      quotePromptMessage(order)
    ]);
    return order;
  }

  if (action === 'quote') {
    const order = await orderRepository.findById(id);
    if (!order) {
      await lineMessageService.replyText(event, '找不到這張案件，請回到最新案件訊息重新操作。');
      return null;
    }

    if (order.status !== ORDER_STATUS.ARRIVED) {
      await lineMessageService.replyText(event, '請先按「已到場」，到場後才能送出報價。');
      return order;
    }

    await lineMessageService.replyMessages(event, quotePromptMessage(order));
    return order;
  }

  if (action === 'complete') {
    const order = await orderRepository.findById(id);
    const amount = Number(order?.quote_amount || 0) + Number(order?.change_request_amount || 0);
    const completed = await completionService.complete(id, {
      final_amount: amount,
      summary: 'Technician completed from LINE button',
      images: []
    }, user.id);
    await lineMessageService.replyText(event, '已送出完工回報，請等待客戶確認。');
    return completed;
  }

  return null;
}

module.exports = { handleTechnicianText, handleTechnicianPostback, parseQuoteText };
