const { orderSummary } = require('../utils/format-message');

const customerMessages = {
  welcome:
    '歡迎來到師傅抵嘉。需要水電維修時，請點選「我要報修」或直接輸入「報修」。',
  askServiceType:
    '請輸入需要的服務類型，例如：漏水、馬桶堵塞、插座故障、熱水器問題。',
  askArea: '請輸入案件所在區域，例如：東區、西區、水上、民雄。',
  askAddress: '請輸入完整地址，方便師傅前往。',
  askIssueDescription:
    '請描述問題狀況與發生位置，例如：廚房水槽下方漏水、浴室排水不順。',
  askPhone: '請輸入聯絡電話。',
  orderCreated: (order) =>
    `已建立報修案件，平台會先審核資料。\n\n${orderSummary(order)}`,
};

function postbackAction(label, data, displayText = label) {
  return { type: 'postback', label, data, displayText };
}

function textWithQuickReply(text, actions) {
  return {
    type: 'text',
    text,
    quickReply: {
      items: actions.map((action) => ({ type: 'action', action })),
    },
  };
}

function welcomeMessage() {
  return textWithQuickReply(customerMessages.welcome, [
    postbackAction('我要報修', 'customer:start_repair', '我要報修'),
  ]);
}

function reviewApprovedMessage(order) {
  return {
    type: 'text',
    text: [
      '案件已審核通過，我們馬上幫你找附近的師傅。',
      '',
      `案件編號：${order.order_no}`,
      `服務類型：${order.service_type}`,
      `區域：${order.area}`,
    ].join('\n'),
  };
}

function quoteMessage(order) {
  const amount = Number(order.quote_amount || 0);
  return {
    type: 'template',
    altText: `報價 ${amount} 元`,
    template: {
      type: 'buttons',
      title: '報價確認',
      text: `${order.order_no}\n報價金額：${amount} 元`,
      actions: [
        postbackAction('同意報價', `customer:accept_quote:${order.id}`, '同意報價'),
        postbackAction('拒絕報價', `customer:reject_quote:${order.id}`, '拒絕報價'),
        postbackAction('取消案件', `customer:cancel_order:${order.id}`, '取消案件'),
      ],
    },
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
      text: `${order.order_no}\n追加金額：${amount} 元\n${order.change_request_reason || ''}`.slice(
        0,
        160
      ),
      actions: [
        postbackAction('同意追加', `customer:accept_quote:${order.id}`, '同意追加'),
        postbackAction('拒絕追加', `customer:reject_quote:${order.id}`, '拒絕追加'),
        postbackAction('取消案件', `customer:cancel_order:${order.id}`, '取消案件'),
      ],
    },
  };
}

function assignedCustomerMessage(order, technician) {
  const technicianName = technician?.name || '師傅';
  const technicianPhone = technician?.phone || '暫無電話';

  return {
    type: 'text',
    text: [
      '師傅已接單，請等待師傅先提供報價。',
      '',
      `案件編號：${order.order_no}`,
      `服務類型：${order.service_type}`,
      `師傅：${technicianName}`,
      `師傅電話：${technicianPhone}`,
    ].join('\n'),
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
      text: `${order.order_no}\n實付金額：${amount} 元\n請確認是否完成服務。`,
      actions: [
        postbackAction('確認結案', `customer:confirm_completion:${order.id}`, '確認結案'),
        postbackAction('我要申訴', `customer:dispute_completion:${order.id}`, '我要申訴'),
      ],
    },
  };
}

module.exports = {
  customerMessages,
  welcomeMessage,
  reviewApprovedMessage,
  quoteMessage,
  changeRequestMessage,
  assignedCustomerMessage,
  completionMessage,
  textWithQuickReply,
  postbackAction,
};
