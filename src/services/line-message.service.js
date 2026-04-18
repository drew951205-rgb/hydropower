const { lineConfig } = require('../config/line');
const { textMessage } = require('../utils/format-message');
const { hasReplyToken } = require('../utils/reply-token');

function normalizeMessages(messagesOrText) {
  if (Array.isArray(messagesOrText)) return messagesOrText;
  if (typeof messagesOrText === 'string') return [textMessage(messagesOrText)];
  return [messagesOrText];
}

async function sendLineMessage(mode, endpoint, body) {
  const messages = body.messages || [];
  const messageTypes = messages.map((message) => message.type).join(',');

  if (!lineConfig.channelAccessToken) {
    console.log('[line:dry-run]', JSON.stringify({ mode, messageTypes, endpoint, body }));
    return { dryRun: true, ok: true };
  }

  console.log('[line:send]', JSON.stringify({
    mode,
    messageTypes,
    messageCount: messages.length,
    hasReplyToken: Boolean(body.replyToken),
    hasTo: Boolean(body.to)
  }));

  try {
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

    if (!response.ok) {
      console.error('[line:error]', JSON.stringify({
        mode,
        status: response.status,
        body: responseText || null
      }));
    }

    return { ok: response.ok, status: response.status, body: responseText };
  } catch (error) {
    console.error('[line:error]', JSON.stringify({
      mode,
      message: error.message
    }));
    return { ok: false, error };
  }
}

async function replyMessages(event, messagesOrText) {
  if (!hasReplyToken(event)) {
    console.warn('[line:skip]', JSON.stringify({ mode: 'reply', reason: 'missing_reply_token' }));
    return { skipped: true, ok: false };
  }

  return sendLineMessage('reply', lineConfig.replyEndpoint, {
    replyToken: event.replyToken,
    messages: normalizeMessages(messagesOrText)
  });
}

async function replyText(event, text) {
  return replyMessages(event, text);
}

async function pushMessages(to, messagesOrText) {
  if (!to) {
    console.warn('[line:skip]', JSON.stringify({ mode: 'push', reason: 'missing_to' }));
    return { skipped: true, ok: false };
  }

  return sendLineMessage('push', lineConfig.pushEndpoint, {
    to,
    messages: normalizeMessages(messagesOrText)
  });
}

async function getProfile(lineUserId) {
  if (!lineUserId) return null;

  if (!lineConfig.channelAccessToken) {
    console.log('[line:dry-run]', JSON.stringify({
      mode: 'profile',
      lineUserId
    }));
    return null;
  }

  const endpoint = `https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`;
  console.log('[line:profile]', JSON.stringify({ lineUserId }));

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${lineConfig.channelAccessToken}`
      }
    });

    const responseText = await response.text();
    console.log('[line:profile:response]', JSON.stringify({
      status: response.status,
      ok: response.ok,
      body: responseText || null
    }));

    if (!response.ok) return null;
    return responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    console.error('[line:profile:error]', JSON.stringify({
      lineUserId,
      message: error.message
    }));
    return null;
  }
}

async function getMessageContent(messageId) {
  if (!messageId) return null;

  if (!lineConfig.channelAccessToken) {
    console.log('[line:dry-run]', JSON.stringify({
      mode: 'content',
      messageId
    }));
    return null;
  }

  const endpoint = `https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`;
  console.log('[line:content]', JSON.stringify({ messageId }));

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${lineConfig.channelAccessToken}`
      }
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error('[line:content:error]', JSON.stringify({
        messageId,
        status: response.status,
        body: responseText || null
      }));
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimetype: response.headers.get('content-type') || 'image/jpeg',
      size: Number(response.headers.get('content-length') || arrayBuffer.byteLength),
    };
  } catch (error) {
    console.error('[line:content:error]', JSON.stringify({
      messageId,
      message: error.message
    }));
    return null;
  }
}

async function sendLineMessageLegacy() {
  console.warn('[line] sendLineMessage is deprecated, use replyMessages or pushMessages instead');
  return { deprecated: true };
}

module.exports = {
  replyMessages,
  replyText,
  pushMessages,
  getProfile,
  getMessageContent,
  sendLineMessage: sendLineMessageLegacy,
  normalizeMessages
};
