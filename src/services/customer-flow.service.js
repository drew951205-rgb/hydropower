const sessionRepository = require('../repositories/session.repository');
const orderService = require('./order.service');
const lineMessageService = require('./line-message.service');
const { customerMessages } = require('../templates/customer-messages');

const STEPS = ['service_type', 'area', 'address', 'issue_description', 'contact_phone'];

function promptForStep(step) {
  return {
    service_type: customerMessages.askServiceType,
    area: customerMessages.askArea,
    address: customerMessages.askAddress,
    issue_description: customerMessages.askIssueDescription,
    contact_phone: customerMessages.askPhone
  }[step];
}

function isStartRepairText(text = '') {
  return /報修|我要報修|維修|修理/.test(text.trim());
}

function validateStep(step, value) {
  const text = String(value || '').trim();
  if (!text) return '請輸入內容。';
  if (step === 'contact_phone' && !/^0\d{1,3}-?\d{6,8}$|^09\d{2}-?\d{6}$/.test(text)) return '電話格式看起來不正確，請輸入市話或手機。';
  if (step === 'address' && text.length < 6) return '地址請再完整一點。';
  return null;
}

async function startRepairFlow(user, event) {
  const firstStep = STEPS[0];
  await sessionRepository.upsertForUser(user.id, { flow_type: 'repair', current_step: firstStep, temp_payload: {} });
  await lineMessageService.replyText(event, promptForStep(firstStep));
  return { started: true };
}

async function handleCustomerText(user, event, text) {
  if (isStartRepairText(text)) return startRepairFlow(user, event);

  const session = await sessionRepository.findByUserId(user.id);
  if (!session?.current_step) {
    const { welcomeMessage } = require('../templates/customer-messages');
    await lineMessageService.replyMessages(event, welcomeMessage());
    return { idle: true };
  }

  const step = session.current_step;
  const error = validateStep(step, text);
  if (error) {
    await lineMessageService.replyText(event, `${error}\n\n${promptForStep(step)}`);
    return { validationError: true };
  }

  const nextPayload = { ...(session.temp_payload || {}), [step]: String(text).trim() };
  const nextStep = STEPS[STEPS.indexOf(step) + 1];
  if (nextStep) {
    await sessionRepository.upsertForUser(user.id, { flow_type: 'repair', current_step: nextStep, temp_payload: nextPayload });
    await lineMessageService.replyText(event, promptForStep(nextStep));
    return { nextStep };
  }

  const order = await orderService.createRepairOrder(user, nextPayload);
  await sessionRepository.clearForUser(user.id);
  await lineMessageService.replyText(event, customerMessages.orderCreated(order));
  return { order };
}

module.exports = { startRepairFlow, handleCustomerText };
