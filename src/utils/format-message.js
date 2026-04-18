function textMessage(text) {
  return { type: 'text', text };
}

function orderSummary(order) {
  return [
    `案件編號：${order.order_no}`,
    `服務類型：${order.service_type}`,
    `區域：${order.area}`,
    `狀態：${order.status}`,
  ].join('\n');
}

module.exports = { textMessage, orderSummary };
