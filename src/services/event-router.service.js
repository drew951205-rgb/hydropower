const userRepository = require('../repositories/user.repository');
const orderRepository = require('../repositories/order.repository');
const sessionRepository = require('../repositories/session.repository');
const customerFlow = require('./customer-flow.service');
const technicianFlow = require('./technician-flow.service');
const technicianOnboarding = require('./technician-onboarding.service');
const lineProfileService = require('./line-profile.service');
const orderService = require('./order.service');
const quoteService = require('./quote.service');
const completionService = require('./completion.service');
const disputeService = require('./dispute.service');
const lineMessageService = require('./line-message.service');
const {
  welcomeMessage,
  customerReviewThanksMessage,
} = require('../templates/customer-messages');

async function routeEvent(event) {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return { ignored: true };

  let user = await userRepository.findOrCreateByLineUserId(lineUserId);
  user = await lineProfileService.syncLineProfile(user);

  if (event.type === 'follow') {
    await lineMessageService.replyMessages(event, welcomeMessage());
    return { followed: true };
  }

  if (event.type === 'message' && event.message?.type === 'text') {
    const text = event.message.text || '';
    if (technicianOnboarding.parseTechnicianLeaveText(text))
      return technicianOnboarding.leaveAsTechnician(user, event);

    const technicianJoin = technicianOnboarding.parseTechnicianJoinText(text);
    if (technicianJoin)
      return technicianOnboarding.joinAsTechnician(user, event, technicianJoin);

    if (user.role === 'technician')
      return technicianFlow.handleTechnicianText(user, event, text);
    return customerFlow.handleCustomerText(user, event, text);
  }

  if (event.type === 'message' && event.message?.type === 'image') {
    if (user.role === 'technician') {
      await lineMessageService.replyText(
        event,
        '已收到圖片。師傅端照片回報會放在下一版，目前請先用文字回報案件狀況。'
      );
      return { technicianImageReceived: true };
    }
    return customerFlow.handleCustomerImage(user, event, event.message);
  }

  if (event.type === 'postback')
    return handlePostback(user, event, event.postback?.data || '');
  return { ignored: true };
}

async function cancelByCustomer(user, event, orderId) {
  const order = await orderRepository.findById(orderId);
  const cancellableStatuses = new Set([
    'pending_review',
    'waiting_customer_info',
    'pending_dispatch',
    'dispatching',
    'assigned',
    'quoted',
    'platform_review',
  ]);
  if (!order || String(order.customer_id) !== String(user.id)) {
    await lineMessageService.replyText(event, '找不到這筆案件，請重新開啟最新訊息。');
    return { cancelled: false, reason: 'order_not_found' };
  }
  if (!cancellableStatuses.has(order.status)) {
    await lineMessageService.replyText(
      event,
      `這個取消按鈕已失效，案件目前狀態為 ${order.status}，不會重複變更。`
    );
    return { cancelled: false, reason: 'stale_action', order };
  }

  const cancelled = await orderService.cancelOrder(
    orderId,
    {
      cancelled_by: 'customer',
      reason_code: 'line_customer_cancel',
      reason_text: 'Customer cancelled from LINE',
    },
    'customer',
    user.id
  );

  if (cancelled.technician_id) {
    const technician = await userRepository.findById(cancelled.technician_id);
    if (technician?.line_user_id) {
      await lineMessageService.pushMessages(
        technician.line_user_id,
        `顧客已取消案件 ${cancelled.order_no}，平台會協助後續安排。`
      );
    }
  }

  await lineMessageService.replyText(event, '已取消案件，平台已記錄。');
  return { cancelled: true, order: cancelled };
}

async function handlePostback(user, event, data) {
  if (data === 'customer:start_repair')
    return customerFlow.startRepairFlow(user, event);

  if (data.startsWith('customer:accept_quote:')) {
    const orderId = data.split(':')[2];
    const current = await orderRepository.findById(orderId);
    const canConfirm =
      current?.status === 'quoted' ||
      (current?.status === 'platform_review' &&
        current?.change_request_status === 'pending');
    if (!current || String(current.customer_id) !== String(user.id)) {
      await lineMessageService.replyText(event, '找不到這筆案件，請重新開啟最新訊息。');
      return { accepted: false, reason: 'order_not_found' };
    }
    if (!canConfirm) {
      await lineMessageService.replyText(
        event,
        `這個報價確認按鈕已失效，案件目前狀態為 ${current.status}，不會重複送出。`
      );
      return { accepted: false, reason: 'stale_action', order: current };
    }
    const order = await quoteService.confirmQuote(orderId, true, user.id);
    await lineMessageService.replyText(
      event,
      '已確認報價，師傅會依案件資訊前往處理。'
    );
    return { order };
  }

  if (data.startsWith('customer:reject_quote:')) {
    const orderId = data.split(':')[2];
    const current = await orderRepository.findById(orderId);
    const canConfirm =
      current?.status === 'quoted' ||
      (current?.status === 'platform_review' &&
        current?.change_request_status === 'pending');
    if (!current || String(current.customer_id) !== String(user.id)) {
      await lineMessageService.replyText(event, '找不到這筆案件，請重新開啟最新訊息。');
      return { rejected: false, reason: 'order_not_found' };
    }
    if (!canConfirm) {
      await lineMessageService.replyText(
        event,
        `這個報價確認按鈕已失效，案件目前狀態為 ${current.status}，不會重複送出。`
      );
      return { rejected: false, reason: 'stale_action', order: current };
    }
    const order = await quoteService.confirmQuote(orderId, false, user.id);
    await lineMessageService.replyText(
      event,
      '已拒絕報價，平台會協助後續安排。'
    );
    return { order };
  }

  if (data.startsWith('customer:cancel_order:')) {
    const orderId = data.split(':')[2];
    const order = await orderRepository.findById(orderId);
    if (!order || String(order.customer_id) !== String(user.id)) {
      await lineMessageService.replyText(event, '找不到可取消的案件。');
      return { cancelled: false };
    }
    return cancelByCustomer(user, event, orderId);
  }

  if (data.startsWith('customer:confirm_completion:')) {
    const orderId = data.split(':')[2];
    const current = await orderRepository.findById(orderId);
    if (!current || String(current.customer_id) !== String(user.id)) {
      await lineMessageService.replyText(event, '找不到這筆案件，請重新開啟最新訊息。');
      return { reviewCompleted: false, reason: 'order_not_found' };
    }
    if (current.status !== 'completed_pending_customer') {
      await lineMessageService.replyText(
        event,
        `這個結案確認按鈕已失效，案件目前狀態為 ${current.status}，不會重複送出。`
      );
      return { reviewCompleted: false, reason: 'stale_action', order: current };
    }
    const order = await completionService.customerConfirmCompletion(
      orderId,
      {
        confirmed: true,
        paid_amount: 0,
        rating: null,
        comment: 'Customer confirmed completion from LINE',
      },
      user.id
    );
    await sessionRepository.clearForUser(user.id);
    await lineMessageService.replyMessages(event, customerReviewThanksMessage());
    return { order, reviewCompleted: true };
  }

  if (data.startsWith('customer:dispute_completion:')) {
    const order = await disputeService.customerDispute(
      data.split(':')[2],
      'Customer reported completion issue from LINE',
      user.id
    );
    await lineMessageService.replyText(
      event,
      '已收到你的申訴，平台會協助審核。'
    );
    return { order };
  }

  if (data.startsWith('technician:'))
    return technicianFlow.handleTechnicianPostback(user, event, data);
  return { ignored: true };
}

module.exports = { routeEvent };
