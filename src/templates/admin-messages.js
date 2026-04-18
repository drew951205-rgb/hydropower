const { orderSummary } = require('../utils/format-message');

const adminMessages = {
  newOrder: (order) => `新案件待審核：\n${orderSummary(order)}`,
};

module.exports = { adminMessages };
