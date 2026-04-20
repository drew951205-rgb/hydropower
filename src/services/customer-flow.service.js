const sessionRepository = require('../repositories/session.repository');
const userRepository = require('../repositories/user.repository');
const orderService = require('./order.service');
const lineMessageService = require('./line-message.service');
const fileUploadService = require('./file-upload.service');
const orderRepository = require('../repositories/order.repository');
const supportTicketService = require('./support-ticket.service');
const { ORDER_STATUS } = require('../utils/order-status');
const {
  customerMessages,
  welcomeMessage,
  customerReviewThanksMessage,
} = require('../templates/customer-messages');

const STEPS = [
  'service_type',
  'area',
  'address',
  'issue_description',
  'preferred_time_text',
  'contact_phone',
];

function promptForStep(step) {
  return {
    service_type: customerMessages.askServiceType,
    area: customerMessages.askArea,
    address: customerMessages.askAddress,
    issue_description: customerMessages.askIssueDescription,
    preferred_time_text: customerMessages.askPreferredTime,
    contact_phone: customerMessages.askPhone,
  }[step];
}

function isStartRepairText(text = '') {
  return /報修|我要報修|維修|修理/.test(text.trim());
}

function validateStep(step, value) {
  const text = String(value || '').trim();
  if (!text) return '請輸入內容。';
  if (
    step === 'contact_phone' &&
    !/^0\d{1,3}-?\d{6,8}$|^09\d{2}-?\d{6}$/.test(text)
  )
    return '電話格式看起來不正確，請輸入市話或手機。';
  if (step === 'address' && text.length < 6) return '地址請再完整一點。';
  return null;
}

function resolveServiceMode(preferredTimeText = '') {
  const text = String(preferredTimeText || '').trim();
  return /越快|馬上|立即|急|現在|今天/.test(text) ? 'urgent' : 'scheduled';
}

async function resolveLineImageUrl(message) {
  const externalUrl = message?.contentProvider?.originalContentUrl;
  if (externalUrl) return externalUrl;

  const fallbackUrl = `line-image:${message.id}`;
  const content = await lineMessageService.getMessageContent(message.id);
  if (!content?.buffer) return fallbackUrl;

  try {
    const uploaded = await fileUploadService.uploadImages(
      [
        {
          buffer: content.buffer,
          mimetype: content.mimetype,
          size: content.size,
        },
      ],
      'issue'
    );
    return uploaded[0]?.url || fallbackUrl;
  } catch (error) {
    console.warn('[line-image:upload:fallback]', JSON.stringify({
      messageId: message.id,
      message: error.message,
    }));
    return fallbackUrl;
  }
}

async function findLatestCustomerOpenOrder(user) {
  const activeStatuses = [
    ORDER_STATUS.PENDING_REVIEW,
    ORDER_STATUS.WAITING_CUSTOMER_INFO,
    ORDER_STATUS.PENDING_DISPATCH,
    ORDER_STATUS.DISPATCHING,
    ORDER_STATUS.ASSIGNED,
    ORDER_STATUS.QUOTED,
    ORDER_STATUS.IN_PROGRESS,
    ORDER_STATUS.ARRIVED,
    ORDER_STATUS.PLATFORM_REVIEW,
  ];
  const lists = await Promise.all(
    activeStatuses.map((status) =>
      orderRepository.listOrders({ customer_id: user.id, status })
    )
  );

  return (
    lists
      .flat()
      .sort(
        (a, b) =>
          new Date(b.created_at || 0) - new Date(a.created_at || 0)
      )[0] || null
  );
}

async function startRepairFlow(user, event) {
  await sessionRepository.clearForUser(user.id);
  await lineMessageService.replyMessages(event, welcomeMessage());
  return { repairFormPrompted: true };
}

function isMyOrdersText(text = '') {
  return /我的案件|案件查詢|訂單查詢|訂單紀錄/.test(String(text).trim());
}

function isSupportText(text = '') {
  return /聯絡客服|客服|人工客服|需要協助/.test(String(text).trim());
}

function statusLabel(status) {
  return {
    pending_review: '等待平台審核',
    waiting_customer_info: '等待補充資料',
    pending_dispatch: '等待派單',
    dispatching: '尋找師傅中',
    assigned: '師傅已接單',
    quoted: '等待你確認報價',
    in_progress: '師傅準備前往',
    arrived: '師傅已到場',
    completed_pending_customer: '等待你確認結案',
    closed: '已結案',
    customer_cancelled: '你已取消',
    technician_cancelled: '師傅已取消',
    platform_cancelled: '平台已取消',
    platform_review: '平台處理中',
    dispute_review: '申訴處理中',
  }[status] || status || '未知狀態';
}

async function listCustomerOrders(user, event) {
  const orders = await orderRepository.listOrders({ customer_id: user.id });
  const sorted = orders
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  if (!sorted.length) {
    await lineMessageService.replyMessages(event, welcomeMessage());
    return { customerOrdersListed: true, count: 0 };
  }

  const orderBlocks = sorted.map((order, index) => [
      `${index + 1}. ${order.order_no}`,
      `狀態：${statusLabel(order.status)}`,
      `服務：${order.service_type || '未填寫'}`,
      order.preferred_time_text ? `時間：${order.preferred_time_text}` : '',
    ].filter(Boolean).join('\n'));

  const lines = [
    '你的最近案件如下：',
    ...orderBlocks,
    '需要新增案件時，請點選下方「我要報修」。',
  ];

  await lineMessageService.replyText(event, lines.join('\n\n'));
  return { customerOrdersListed: true, count: sorted.length };
}

async function showCustomerSupport(user, event) {
  const order = await findLatestCustomerOpenOrder(user);
  await sessionRepository.upsertForUser(user.id, {
    flow_type: 'customer_support',
    current_step: 'message',
    temp_payload: {
      order_id: order?.id || null,
    },
  });

  await lineMessageService.replyText(
    event,
    [
      '\u5e2b\u5085\u62b5\u5609\u5ba2\u670d\u4e2d\u5fc3',
      '',
      '\u670d\u52d9\u6642\u9593\uff1a\u6bcf\u65e5 09:00-21:00',
      order
        ? `\u76ee\u524d\u6703\u5148\u5c0d\u61c9\u6848\u4ef6 ${order.order_no}\u3002`
        : '\u76ee\u524d\u6c92\u6709\u5c0d\u61c9\u5230\u672a\u7d50\u6848\u6848\u4ef6\uff0c\u6703\u4ee5\u4e00\u822c\u5ba2\u670d\u55ae\u8655\u7406\u3002',
      '',
      '\u8acb\u76f4\u63a5\u8f38\u5165\u4f60\u8981\u806f\u7d61\u5ba2\u670d\u7684\u5167\u5bb9\uff0c\u9001\u51fa\u5f8c\u5e73\u53f0\u6703\u5efa\u7acb\u5ba2\u670d\u55ae\u3002',
      '',
      '\u82e5\u73fe\u5834\u6709\u6f0f\u96fb\u3001\u74e6\u65af\u5473\u3001\u706b\u82b1\u6216\u7acb\u5373\u5371\u96aa\uff0c\u8acb\u5148\u505c\u6b62\u4f7f\u7528\u76f8\u95dc\u8a2d\u5099\u4e26\u806f\u7d61\u7dca\u6025\u55ae\u4f4d\u3002',
    ].join('\n')
  );
  return { customerSupportPrompted: true, orderId: order?.id || null };
}
async function createSupportTicketFromSession(user, event, session, text) {
  const content = String(text || '').trim();
  if (!content) {
    await lineMessageService.replyText(event, '請輸入想詢問或申訴的內容。');
    return { supportValidationError: true };
  }

  const ticket = await supportTicketService.createSupportTicket(user, {
    order_id: session.temp_payload?.order_id || null,
    type: 'general',
    title: 'LINE customer support message',
    message: content,
  });

  await sessionRepository.clearForUser(user.id);
  await lineMessageService.replyText(
    event,
    `已收到你的客服訊息，客服單號 ${ticket.ticket_no}。平台會依紀錄協助處理。`
  );
  return { supportTicketCreated: true, ticket };
}

async function handleCustomerText(user, event, text) {
  const session = await sessionRepository.findByUserId(user.id);
  if (session?.flow_type === 'customer_review') {
    await sessionRepository.clearForUser(user.id);
    await lineMessageService.replyMessages(event, customerReviewThanksMessage());
    return { customerReviewSessionCleared: true };
  }
  if (session?.flow_type === 'customer_support')
    return createSupportTicketFromSession(user, event, session, text);

  if (isMyOrdersText(text)) return listCustomerOrders(user, event);
  if (isSupportText(text)) return showCustomerSupport(user, event);

  return startRepairFlow(user, event);
}

async function handleCustomerImage(user, event, message) {
  const session = await sessionRepository.findByUserId(user.id);
  const imageUrl = await resolveLineImageUrl(message);

  if (session?.flow_type === 'repair') {
    const payload = session.temp_payload || {};
    const images = [...(payload.images || []), imageUrl].slice(0, 5);
    await sessionRepository.upsertForUser(user.id, {
      flow_type: 'repair',
      current_step: session.current_step,
      temp_payload: {
        ...payload,
        images,
      },
    });
    await lineMessageService.replyText(
      event,
      [
        `已收到照片，目前共 ${images.length} 張。`,
        `請繼續：${promptForStep(session.current_step)}`,
      ].join('\n')
    );
    return { imageSavedToSession: true, imageCount: images.length };
  }

  const order = await findLatestCustomerOpenOrder(user);
  if (!order) {
    await lineMessageService.replyText(
      event,
      '已收到照片。如果要建立案件，請輸入「報修」開始。'
    );
    return { imageSaved: false, reason: 'no_active_order' };
  }

  await orderService.addImages(order.id, [imageUrl], 'issue');
  await lineMessageService.replyText(
    event,
    `已把照片加入案件 ${order.order_no}，平台和師傅會看到這筆紀錄。`
  );
  return { imageSavedToOrder: true, orderId: order.id };
}

async function handleCustomerReviewText(user, event, session, text) {
  const value = String(text || '').trim();
  const payload = session.temp_payload || {};

  if (session.current_step === 'rating') {
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      await lineMessageService.replyText(event, '請輸入 1 到 5 分，例如：5');
      return { reviewValidationError: true };
    }

    await sessionRepository.upsertForUser(user.id, {
      flow_type: 'customer_review',
      current_step: 'comment',
      temp_payload: {
        ...payload,
        rating,
      },
    });
    await lineMessageService.replyText(event, customerReviewCommentPrompt(rating));
    return { nextStep: 'customer_review_comment' };
  }

  if (session.current_step === 'comment') {
    const comment = /^(略過|跳過|skip)$/i.test(value) ? '' : value;
    const order = await completionService.submitCustomerReview(
      payload.order_id,
      {
        rating: payload.rating,
        comment,
      },
      user.id
    );
    await sessionRepository.clearForUser(user.id);
    await lineMessageService.replyMessages(event, customerReviewThanksMessage());
    return { customerReviewSubmitted: true, order };
  }

  await sessionRepository.clearForUser(user.id);
  await lineMessageService.replyText(event, '評價流程已重置，請重新操作。');
  return { customerReviewReset: true };
}

async function updateCustomerProfileFromRepair(user, payload) {
  const changes = {
    phone: payload.contact_phone,
    default_address: payload.address
  };

  try {
    await userRepository.updateUser(user.id, changes);
  } catch (error) {
    console.warn('[customer-profile:update:fallback]', JSON.stringify({
      userId: user.id,
      message: error.message
    }));

    await userRepository.updateUser(user.id, { phone: payload.contact_phone });
  }
}

module.exports = { startRepairFlow, handleCustomerText, handleCustomerImage };
