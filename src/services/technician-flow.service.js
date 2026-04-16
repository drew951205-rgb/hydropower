const dispatchService = require('./dispatch.service');
const completionService = require('./completion.service');
const orderRepository = require('../repositories/order.repository');
const lineMessageService = require('./line-message.service');

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
    await lineMessageService.replyText(event, '已記錄到場。');
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
    await lineMessageService.replyText(event, '已送出完工回報，等待顧客確認。');
    return completed;
  }

  return null;
}

module.exports = { handleTechnicianPostback };
