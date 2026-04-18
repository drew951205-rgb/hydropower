const userRepository = require('../repositories/user.repository');
const orderRepository = require('../repositories/order.repository');
const customerFlow = require('./customer-flow.service');
const technicianFlow = require('./technician-flow.service');
const technicianOnboarding = require('./technician-onboarding.service');
const orderService = require('./order.service');
const quoteService = require('./quote.service');
const completionService = require('./completion.service');
const disputeService = require('./dispute.service');
const lineMessageService = require('./line-message.service');
const { welcomeMessage } = require('../templates/customer-messages');

async function routeEvent(event) {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return { ignored: true };
  const user = await userRepository.findOrCreateByLineUserId(lineUserId);

  if (event.type === 'follow') {
    await lineMessageService.replyMessages(event, welcomeMessage());
    return { followed: true };
  }

  if (event.type === 'message' && event.message?.type === 'text') {
    const text = event.message.text || '';
    const technicianJoin = technicianOnboarding.parseTechnicianJoinText(text);
    if (technicianJoin) return technicianOnboarding.joinAsTechnician(user, event, technicianJoin);

    if (user.role === 'technician') return technicianFlow.handleTechnicianText(user, event, text);
    return customerFlow.handleCustomerText(user, event, text);
  }

  if (event.type === 'postback') return handlePostback(user, event, event.postback?.data || '');
  return { ignored: true };
}

async function cancelByCustomer(user, event, orderId) {
  const cancelled = await orderService.cancelOrder(orderId, {
    cancelled_by: 'customer',
    reason_code: 'line_customer_cancel',
    reason_text: 'Customer cancelled from LINE'
  }, 'customer', user.id);

  if (cancelled.technician_id) {
    const technician = await userRepository.findById(cancelled.technician_id);
    if (technician?.line_user_id) {
      await lineMessageService.pushMessages(technician.line_user_id, `顧客已取消案件 ${cancelled.order_no}。`);
    }
  }

  await lineMessageService.replyText(event, '已取消案件，平台會停止後續派工。');
  return { cancelled: true, order: cancelled };
}

async function handlePostback(user, event, data) {
  if (data === 'customer:start_repair') return customerFlow.startRepairFlow(user, event);

  if (data.startsWith('customer:accept_quote:')) {
    const order = await quoteService.confirmQuote(data.split(':')[2], true, user.id);
    await lineMessageService.replyText(event, '已確認報價，師傅會依案件資訊前往處理。');
    return { order };
  }

  if (data.startsWith('customer:reject_quote:')) {
    const order = await quoteService.confirmQuote(data.split(':')[2], false, user.id);
    await lineMessageService.replyText(event, '已拒絕報價，平台會協助後續處理。');
    return { order };
  }

  if (data.startsWith('customer:cancel_order:')) {
    const orderId = data.split(':')[2];
    const order = await orderRepository.findById(orderId);
    if (!order || String(order.customer_id) !== String(user.id)) {
      await lineMessageService.replyText(event, '找不到可取消的案件，請聯絡平台協助。');
      return { cancelled: false };
    }
    return cancelByCustomer(user, event, orderId);
  }

  if (data.startsWith('customer:confirm_completion:')) {
    const order = await completionService.customerConfirmCompletion(data.split(':')[2], {
      confirmed: true,
      paid_amount: 0,
      rating: null,
      comment: 'LINE customer confirmation'
    }, user.id);
    await lineMessageService.replyText(event, '已確認結案，謝謝你的回覆。');
    return { order };
  }

  if (data.startsWith('customer:dispute_completion:')) {
    const order = await disputeService.customerDispute(data.split(':')[2], 'Customer reported completion issue from LINE', user.id);
    await lineMessageService.replyText(event, '已收到你的異議，平台會協助審核。');
    return { order };
  }

  if (data.startsWith('technician:')) return technicianFlow.handleTechnicianPostback(user, event, data);
  return { ignored: true };
}

module.exports = { routeEvent };
