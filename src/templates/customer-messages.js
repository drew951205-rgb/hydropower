const { orderSummary } = require('../utils/format-message');

const customerMessages = {
  welcome: '歡迎來到師傅抵嘉。需要水電維修時，請點選「我要報修」或直接輸入「報修」。',
  askServiceType: '請輸入需要的服務類型，例如：漏水、馬桶堵塞、插座故障、熱水器問題。',
  askArea: '請輸入所在區域，例如：西區、東區、民雄、太保。',
  askAddress: '請輸入完整地址，方便師傅到場。',
  askIssueDescription: '請描述問題狀況，越具體越好。例如：廚房水槽下方持續漏水。',
  askPhone: '請輸入聯絡電話。',
  orderCreated: (order) => `已建立報修案件，我們會先人工審核。\n\n${orderSummary(order)}`
};

function postbackAction(label, data, displayText = label) {
  return { type: 'postback', label, data, displayText };
}

function textWithQuickReply(text, actions) {
  return {
    type: 'text',
    text,
    quickReply: {
      items: actions.map((action) => ({ type: 'action', action }))
    }
  };
}

function welcomeMessage() {
  return textWithQuickReply(customerMessages.welcome, [
    postbackAction('我要報修', 'customer:start_repair', '我要報修')
  ]);
}

function quoteMessage(order) {
  const amount = Number(order.quote_amount || 0);
  return {
    type: 'template',
    altText: `師傅報價 ${amount} 元`,
    template: {
      type: 'buttons',
      title: '師傅報價',
      text: `${order.order_no}\n報價金額：${amount} 元`,
      actions: [
        postbackAction('同意報價', `customer:accept_quote:${order.id}`, '同意報價'),
        postbackAction('拒絕報價', `customer:reject_quote:${order.id}`, '拒絕報價')
      ]
    }
  };
}

function changeRequestMessage(order) {
  const amount = Number(order.change_request_amount || 0);
  return {
    type: 'template',
    altText: `追加報價 ${amount} 元`,
    template: {
      type: 'buttons',
      title: '追加報價',
      text: `${order.order_no}\n追加金額：${amount} 元\n${order.change_request_reason || ''}`.slice(0, 160),
      actions: [
        postbackAction('同意追加', `customer:accept_quote:${order.id}`, '同意追加'),
        postbackAction('拒絕追加', `customer:reject_quote:${order.id}`, '拒絕追加')
      ]
    }
  };
}

function completionMessage(order) {
  const amount = Number(order.final_amount || order.quote_amount || 0);
  return {
    type: 'template',
    altText: `完工確認 ${amount} 元`,
    template: {
      type: 'buttons',
      title: '完工確認',
      text: `${order.order_no}\n最終金額：${amount} 元\n請確認施工結果。`,
      actions: [
        postbackAction('確認完工', `customer:confirm_completion:${order.id}`, '確認完工'),
        postbackAction('我要反映問題', `customer:dispute_completion:${order.id}`, '我要反映問題')
      ]
    }
  };
}

module.exports = {
  customerMessages,
  welcomeMessage,
  quoteMessage,
  changeRequestMessage,
  completionMessage,
  textWithQuickReply,
  postbackAction
};
