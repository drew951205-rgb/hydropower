const sessionRepository = require('../repositories/session.repository');
const userRepository = require('../repositories/user.repository');
const orderService = require('./order.service');
const lineMessageService = require('./line-message.service');
const fileUploadService = require('./file-upload.service');
const orderRepository = require('../repositories/order.repository');
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

async function handleCustomerText(user, event, text) {
  const session = await sessionRepository.findByUserId(user.id);
  if (session?.flow_type === 'customer_review') {
    await sessionRepository.clearForUser(user.id);
    await lineMessageService.replyMessages(event, customerReviewThanksMessage());
    return { customerReviewSessionCleared: true };
  }

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
