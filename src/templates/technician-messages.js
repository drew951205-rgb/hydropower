const { orderSummary } = require('../utils/format-message');

function postbackAction(label, data, displayText = label) {
  return { type: 'postback', label, data, displayText };
}

const technicianMessages = {
  assignmentText: (order) => `有新的派單可以接。\n\n${orderSummary(order)}`,
  assignedText: (order) =>
    `接單成功。\n地址：${order.address}\n電話：${order.contact_phone || '未提供'}`,
  alreadyTaken: '這張單已由其他師傅接走。',
  completed: '已送出完工回報，請等待客戶確認。',
};

function assignmentMessage(order, assignment) {
  return {
    type: 'template',
    altText: `新派單 ${order.order_no}`,
    template: {
      type: 'buttons',
      title: '新派單',
      text: `${order.service_type}｜${order.area}\n${order.issue_description}`.slice(
        0,
        160
      ),
      actions: [
        postbackAction(
          '接單',
          `technician:accept_assignment:${assignment.id}`,
          '接單'
        ),
      ],
    },
  };
}

function assignedMessage(order) {
  return {
    type: 'template',
    altText: `已接單 ${order.order_no}`,
    template: {
      type: 'buttons',
      title: '已接單',
      text: `案件：${order.order_no}\n請先回報報價，客戶接受後再前往。`.slice(
        0,
        160
      ),
      actions: [postbackAction('報價', `technician:quote:${order.id}`, '報價')],
    },
  };
}

function quotePromptMessage(order) {
  return {
    type: 'template',
    altText: `請回報報價 ${order.order_no}`,
    template: {
      type: 'buttons',
      title: '回報報價',
      text: `案件：${order.order_no}\n請輸入：報價 1500`,
      actions: [{ type: 'message', label: '填寫範例', text: '報價 1500' }],
    },
  };
}

function acceptedQuoteTechnicianMessage(order) {
  return {
    type: 'template',
    altText: `客戶已接受報價 ${order.order_no}`,
    template: {
      type: 'buttons',
      title: '客戶已接受報價',
      text: `案件：${order.order_no}\n地址：${order.address}\n電話：${order.contact_phone || '未提供'}`.slice(
        0,
        160
      ),
      actions: [
        postbackAction('已到場', `technician:arrived:${order.id}`, '已到場'),
        postbackAction(
          '完工回報',
          `technician:complete:${order.id}`,
          '完工回報'
        ),
      ],
    },
  };
}

module.exports = {
  technicianMessages,
  assignmentMessage,
  assignedMessage,
  quotePromptMessage,
  acceptedQuoteTechnicianMessage,
};
