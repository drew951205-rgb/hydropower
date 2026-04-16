const { orderSummary } = require('../utils/format-message');

function postbackAction(label, data, displayText = label) {
  return { type: 'postback', label, data, displayText };
}

const technicianMessages = {
  assignmentText: (order) => `有新的師傅抵嘉案件可接。\n\n${orderSummary(order)}`,
  assignedText: (order) => `你已成功接單。\n地址：${order.address}\n聯絡電話：${order.contact_phone || '未提供'}`,
  alreadyTaken: '案件已被接走或已失效。',
  completed: '已送出完工回報，等待顧客確認。'
};

function assignmentMessage(order, assignment) {
  return {
    type: 'template',
    altText: `新案件 ${order.order_no}`,
    template: {
      type: 'buttons',
      title: '新案件可接',
      text: `${order.service_type}｜${order.area}\n${order.issue_description}`.slice(0, 160),
      actions: [
        postbackAction('接單', `technician:accept_assignment:${assignment.id}`, '接單')
      ]
    }
  };
}

function assignedMessage(order) {
  return {
    type: 'template',
    altText: `已接單 ${order.order_no}`,
    template: {
      type: 'buttons',
      title: '已接單',
      text: `地址：${order.address}\n電話：${order.contact_phone || '未提供'}`.slice(0, 160),
      actions: [
        postbackAction('已到場', `technician:arrived:${order.id}`, '已到場'),
        postbackAction('完工回報', `technician:complete:${order.id}`, '完工回報')
      ]
    }
  };
}

module.exports = { technicianMessages, assignmentMessage, assignedMessage };
