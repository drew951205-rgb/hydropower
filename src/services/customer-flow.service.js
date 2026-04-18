const sessionRepository = require('../repositories/session.repository');
const userRepository = require('../repositories/user.repository');
const orderService = require('./order.service');
const completionService = require('./completion.service');
const lineMessageService = require('./line-message.service');
const {
  customerMessages,
  customerReviewCommentPrompt,
} = require('../templates/customer-messages');

const STEPS = [
  'service_type',
  'area',
  'address',
  'issue_description',
  'contact_phone',
];

function promptForStep(step) {
  return {
    service_type: customerMessages.askServiceType,
    area: customerMessages.askArea,
    address: customerMessages.askAddress,
    issue_description: customerMessages.askIssueDescription,
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

async function startRepairFlow(user, event) {
  const firstStep = STEPS[0];
  await sessionRepository.upsertForUser(user.id, {
    flow_type: 'repair',
    current_step: firstStep,
    temp_payload: {},
  });
  await lineMessageService.replyText(event, promptForStep(firstStep));
  return { started: true };
}

async function handleCustomerText(user, event, text) {
  if (isStartRepairText(text)) return startRepairFlow(user, event);

  const session = await sessionRepository.findByUserId(user.id);
  if (session?.flow_type === 'customer_review')
    return handleCustomerReviewText(user, event, session, text);

  if (!session?.current_step) {
    const { welcomeMessage } = require('../templates/customer-messages');
    await lineMessageService.replyMessages(event, welcomeMessage());
    return { idle: true };
  }

  const step = session.current_step;
  const error = validateStep(step, text);
  if (error) {
    await lineMessageService.replyText(
      event,
      `${error}\n\n${promptForStep(step)}`
    );
    return { validationError: true };
  }

  const nextPayload = {
    ...(session.temp_payload || {}),
    [step]: String(text).trim(),
  };
  const nextStep = STEPS[STEPS.indexOf(step) + 1];
  if (nextStep) {
    await sessionRepository.upsertForUser(user.id, {
      flow_type: 'repair',
      current_step: nextStep,
      temp_payload: nextPayload,
    });
    await lineMessageService.replyText(event, promptForStep(nextStep));
    return { nextStep };
  }

  const order = await orderService.createRepairOrder(user, nextPayload);
  await updateCustomerProfileFromRepair(user, nextPayload);
  await sessionRepository.clearForUser(user.id);
  await lineMessageService.replyText(
    event,
    customerMessages.orderCreated(order)
  );
  return { order };
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
    await lineMessageService.replyText(event, '謝謝你的評價，平台已收到。');
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

module.exports = { startRepairFlow, handleCustomerText };
