function hasReplyToken(event) {
  return Boolean(event?.replyToken && event.replyToken !== '00000000000000000000000000000000');
}

module.exports = { hasReplyToken };
