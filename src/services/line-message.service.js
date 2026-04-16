const { lineConfig } = require('../config/line');
const { textMessage } = require('../utils/format-message');
const { hasReplyToken } = require('../utils/reply-token');

async function sendLineMessage(endpoint, body) {
  const mode = endpoint.includes('/reply') ? 'reply' : endpoint.includes('/push') ? 'push' : 'unknown';
  const messageTypes = (body.messages || []).map((message) => message.type).join(',');

  if (!lineConfig.channelAccessToken) {
    console.log('[line:dry-run]', JSON.stringify({ mode, messageTypes, endpoint, body }));
    return { dryRun: true };
  }

  console.log('[line:send]', JSON.stringify({
    mode,
    messageTypes,
    messageCount: body.messages?.length || 0,
    hasReplyToken: Boolean(body.replyToken),
    hasTo: Boolean(body.to)
  }));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lineConfig.channelAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const responseText = await response.text();
  console.log('[line:response]', JSON.stringify({
    mode,
    status: response.status,
    ok: response.ok,
    body: responseText || null
  }));

  if (!response.ok) console.error('[line:error]', response.status, responseText);
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
