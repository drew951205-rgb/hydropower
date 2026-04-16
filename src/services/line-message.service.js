const { lineConfig } = require('../config/line');
const { textMessage } = require('../utils/format-message');
const { hasReplyToken } = require('../utils/reply-token');

async function sendLineMessage(endpoint, body) {
  if (!lineConfig.channelAccessToken) {
    console.log('[line:dry-run]', JSON.stringify({ endpoint, body }));
    return { dryRun: true };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lineConfig.channelAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) console.error('[line:error]', response.status, await response.text());
  return { ok: response.ok };
}

function normalizeMessages(messagesOrText) {
  if (Array.isArray(messagesOrText)) return messagesOrText;
  if (typeof messagesOrText === 'string') return [textMessage(messagesOrText)];
  return [messagesOrText];
}

async function replyMessages(event, messagesOrText) {
  if (!hasReplyToken(event)) return { skipped: true };
  return sendLineMessage(lineConfig.replyEndpoint, {
    replyToken: event.replyToken,
    messages: normalizeMessages(messagesOrText)
  });
}

async function pushMessages(lineUserId, messagesOrText) {
  if (!lineUserId) return { skipped: true };
  return sendLineMessage(lineConfig.pushEndpoint, {
    to: lineUserId,
    messages: normalizeMessages(messagesOrText)
  });
}

async function replyText(event, text) {
  return replyMessages(event, text);
}

async function pushText(lineUserId, text) {
  return pushMessages(lineUserId, text);
}

module.exports = { replyMessages, pushMessages, replyText, pushText };
