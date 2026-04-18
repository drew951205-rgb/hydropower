const { Client } = require('@line/bot-sdk');
const { lineConfig } = require('../config/line');
const { textMessage } = require('../utils/format-message');
const { hasReplyToken } = require('../utils/reply-token');

let lineClient = null;
if (lineConfig.channelAccessToken && lineConfig.channelSecret) {
  lineClient = new Client({
    channelAccessToken: lineConfig.channelAccessToken,
    channelSecret: lineConfig.channelSecret,
  });
}

async function replyMessages(event, messagesOrText) {
  if (!lineClient) {
    console.log('[line:dry-run] reply', JSON.stringify(messagesOrText));
    return { dryRun: true };
  }

  if (!hasReplyToken(event)) {
    throw new Error('No reply token available');
  }

  const messages = Array.isArray(messagesOrText)
    ? messagesOrText
    : [messagesOrText];
  console.log('[line:reply]', `Sending ${messages.length} messages`);

  return lineClient.replyMessage(event.replyToken, messages);
}

async function replyText(event, text) {
  return replyMessages(event, textMessage(text));
}

async function pushMessages(to, messagesOrText) {
  if (!lineClient) {
    console.log('[line:dry-run] push', JSON.stringify({ to, messagesOrText }));
    return { dryRun: true };
  }

  const messages = Array.isArray(messagesOrText)
    ? messagesOrText
    : [messagesOrText];
  console.log('[line:push]', `Pushing ${messages.length} messages to ${to}`);

  return lineClient.pushMessage(to, messages);
}

async function sendLineMessage() {
  // Legacy function for backward compatibility
  console.warn(
    '[line] sendLineMessage is deprecated, use replyMessages or pushMessages instead'
  );
  return { deprecated: true };
}

function normalizeMessages(messagesOrText) {
  if (Array.isArray(messagesOrText)) return messagesOrText;
  if (typeof messagesOrText === 'string') return [textMessage(messagesOrText)];
  return [messagesOrText];
}

module.exports = {
  replyMessages,
  replyText,
  pushMessages,
  sendLineMessage,
  normalizeMessages,
};
