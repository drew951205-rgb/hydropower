const userRepository = require('../repositories/user.repository');
const customerFlow = require('./customer-flow.service');
const technicianFlow = require('./technician-flow.service');
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
    if (user.role === 'technician') {
      await lineMessageService.replyText(event, '請使用案件按鈕操作，或由管理後台提交報價與完工。');
      return { technicianMessage: true };
    }
    return customerFlow.handleCustomerText(user, event, event.message.text);
  }

  if (event.type === 'postback') return handlePostback(user, event, event.postback?.data || '');
  return { ignored: true };
}

async function handlePostback(user, event, data) {
  if (data === 'customer:start_repair') return customerFlow.startRepairFlow(user, event);

  if (data.startsWith('customer:accept_quote:')) {
    const order = await quoteService.confirmQuote(data.split(':')[2], true, user.id);
    await lineMessageService.replyText(event, '已收到確認，師傅會繼續處理。');
    return { order };
  }

  if (data.startsWith('customer:reject_quote:')) {
    const order = await quoteService.confirmQuote(data.split(':')[2], false, user.id);
    await lineMessageService.replyText(event, '已收到回覆，平台會協助處理。');
    return { order };
  }

  if (data.startsWith('customer:confirm_completion:')) {
    const order = await completionService.customerConfirmCompletion(data.split(':')[2], {
      confirmed: true,
      paid_amount: 0,
      rating: null,
      comment: 'LINE customer confirmation'
    }, user.id);
    await lineMessageService.replyText(event, '已確認完工，感謝你的使用。');
    return { order };
  }

  if (data.startsWith('customer:dispute_completion:')) {
    const order = await disputeService.customerDispute(data.split(':')[2], 'Customer reported completion issue from LINE', user.id);
    await lineMessageService.replyText(event, '已收到問題回報，平台會協助確認。');
    return { order };
  }

  if (data.startsWith('technician:')) return technicianFlow.handleTechnicianPostback(user, event, data);
  return { ignored: true };
}

module.exports = { routeEvent };
