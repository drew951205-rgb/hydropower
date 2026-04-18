const userRepository = require('../repositories/user.repository');
const lineMessageService = require('./line-message.service');

const JOIN_KEYWORDS = new Set(['加入師傅', '我是師傅']);
const PHONE_PATTERN = /^(?:09\d{2}-?\d{3}-?\d{3}|0\d{1,3}-?\d{6,8})$/;

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

module.exports = { parseTechnicianJoinText, joinAsTechnician };
