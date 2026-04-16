const { env } = require('./env');

const lineConfig = {
  channelSecret: env.lineChannelSecret,
  channelAccessToken: env.lineChannelAccessToken,
  replyEndpoint: 'https://api.line.me/v2/bot/message/reply',
  pushEndpoint: 'https://api.line.me/v2/bot/message/push'
};

module.exports = { lineConfig };
