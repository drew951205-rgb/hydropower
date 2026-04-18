const userRepository = require('../repositories/user.repository');
const orderRepository = require('../repositories/order.repository');
const assignmentRepository = require('../repositories/assignment.repository');
const sessionRepository = require('../repositories/session.repository');
const lineMessageService = require('./line-message.service');
const { ORDER_STATUS } = require('../utils/order-status');

const JOIN_KEYWORDS = new Set(['加入師傅', '我是師傅']);
const LEAVE_KEYWORDS = new Set(['退出師傅', '取消師傅', '不當師傅']);
const PHONE_PATTERN = /^(?:09\d{2}-?\d{3}-?\d{3}|0\d{1,3}-?\d{6,8})$/;
const ACTIVE_ORDER_STATUSES = [
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.ARRIVED,
  ORDER_STATUS.COMPLETED_PENDING_CUSTOMER,
  ORDER_STATUS.PLATFORM_REVIEW,
];

function parseTechnicianJoinText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  if (!JOIN_KEYWORDS.has(parts[0])) return null;

  const extraParts = parts.slice(1);
  const phone = extraParts.find((part) => PHONE_PATTERN.test(part)) || null;
  const name = extraParts.find((part) => part !== phone) || null;

  return { name, phone };
}

function parseTechnicianLeaveText(text) {
  return LEAVE_KEYWORDS.has(String(text || '').trim());
}

async function listActiveTechnicianOrders(userId) {
  const lists = await Promise.all(
    ACTIVE_ORDER_STATUSES.map((status) =>
      orderRepository.listOrders({
        technician_id: userId,
        status,
      })
    )
  );
  return lists.flat();
}

async function expirePendingAssignments(userId) {
  const assignments = await assignmentRepository.findForTechnician(userId);
  const pending = assignments.filter((assignment) => assignment.status === 'pending');
  await Promise.all(
    pending.map((assignment) =>
      assignmentRepository.updateAssignment(assignment.id, { status: 'expired' })
    )
  );
  return pending.length;
}

async function joinAsTechnician(user, event, input = {}) {
  const updated = await userRepository.updateUser(user.id, {
    role: 'technician',
    status: 'active',
    available: true,
    name: input.name || user.name || 'LINE 師傅',
    phone: input.phone || user.phone,
    available_time_text: user.available_time_text || '請由後台補充可接時段',
    service_areas: user.service_areas || [],
    service_types: user.service_types || [],
  });

  await lineMessageService.replyText(
    event,
    '已加入師傅名單。管理員派單後，你會在 LINE 收到接單按鈕。'
  );
  return { technicianJoined: true, user: updated };
}

async function leaveAsTechnician(user, event) {
  if (user.role !== 'technician') {
    await lineMessageService.replyText(
      event,
      '你目前不是師傅身份。如果要加入師傅，請輸入「加入師傅 姓名 電話」。'
    );
    return { technicianLeft: false, reason: 'not_technician' };
  }

  const activeOrders = await listActiveTechnicianOrders(user.id);
  if (activeOrders.length) {
    const updated = await userRepository.updateUser(user.id, {
      available: false,
    });
    await lineMessageService.replyText(
      event,
      [
        '你目前還有處理中的案件，暫時不能退出師傅身份。',
        '已先幫你暫停接新案，請完成或取消目前案件後再輸入「退出師傅」。',
      ].join('\n')
    );
    return {
      technicianLeft: false,
      reason: 'active_orders',
      activeOrderCount: activeOrders.length,
      user: updated,
    };
  }

  const expiredAssignments = await expirePendingAssignments(user.id);
  await sessionRepository.clearForUser(user.id);
  const updated = await userRepository.updateUser(user.id, {
    role: 'customer',
    available: false,
  });

  await lineMessageService.replyText(
    event,
    '已退出師傅身份，之後不會再收到派單。你仍可用同一個 LINE 帳號報修。'
  );
  return {
    technicianLeft: true,
    expiredAssignments,
    user: updated,
  };
}

module.exports = {
  parseTechnicianJoinText,
  parseTechnicianLeaveText,
  joinAsTechnician,
  leaveAsTechnician,
};
