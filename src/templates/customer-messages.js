const { orderSummary } = require('../utils/format-message');

const customerMessages = {
  welcome:
    '歡迎來到師傅抵嘉。需要水電維修時，請點選「我要報修」或直接輸入「報修」。',
  askServiceType:
    '請輸入需要的服務類型，例如：漏水、馬桶堵塞、插座故障、熱水器問題。',
  askArea: '請輸入案件所在區域，例如：東區、西區、水上、民雄。',
  askAddress: '請輸入完整地址，方便師傅前往。',
  askIssueDescription:
    '請描述問題狀況與發生位置，例如：廚房水槽下方漏水、浴室排水不順。也可以直接傳照片補充現場狀況。',
  askPreferredTime:
    '請輸入希望服務時間，例如：越快越好、今天下午、明天下午 2-5 點、週六上午。',
  askPhone: '請輸入聯絡電話。',
  orderCreated: (order) =>
    `已建立報修案件，平台會先審核資料。\n\n${orderSummary(order)}`,
};

function postbackAction(label, data, displayText = label) {
  return { type: 'postback', label, data, displayText };
}

function messageAction(label, text) {
  return { type: 'message', label, text };
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

function textBlock(text, options = {}) {
  return {
    type: 'text',
    text: String(text ?? ''),
    wrap: true,
    size: options.size || 'sm',
    weight: options.weight,
    color: options.color || '#333333',
    margin: options.margin,
  };
}

function infoRow(label, value) {
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      {
        type: 'text',
        text: label,
        size: 'xs',
        color: '#6B7280',
        flex: 3,
      },
      {
        type: 'text',
        text: String(value || '未提供'),
        size: 'xs',
        color: '#111827',
        wrap: true,
        flex: 7,
      },
    ],
  };
}

function button(action, style = 'secondary') {
  return {
    type: 'button',
    style,
    height: 'sm',
    action,
  };
}

function orderCard({ altText, title, status, summary, rows, actions = [] }) {
  return {
    type: 'flex',
    altText,
    contents: {
      type: 'bubble',
      size: 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          textBlock(status, {
            size: 'xs',
            weight: 'bold',
            color: '#1F8A70',
          }),
          textBlock(title, {
            size: 'lg',
            weight: 'bold',
            color: '#111827',
            margin: 'sm',
          }),
          textBlock(summary, {
            size: 'sm',
            color: '#4B5563',
            margin: 'md',
          }),
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            contents: rows,
          },
        ],
      },
      footer: actions.length
        ? {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: actions,
          }
        : undefined,
    },
  };
}

function welcomeMessage() {
  return textWithQuickReply(customerMessages.welcome, [
    postbackAction('我要報修', 'customer:start_repair', '我要報修'),
  ]);
}

function reviewApprovedMessage(order) {
  return orderCard({
    altText: `案件已審核通過 ${order.order_no}`,
    status: '審核通過',
    title: '我們馬上幫你找附近的師傅',
    summary: '平台已確認案件資料，接下來會通知合適師傅接單。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('服務類型', order.service_type),
      infoRow('區域', order.area),
      infoRow('時間需求', order.preferred_time_text || '越快越好'),
    ],
  });
}

function quoteMessage(order) {
  const amount = Number(order.quote_amount || 0);
  return orderCard({
    altText: `報價確認 ${amount} 元`,
    status: '待你確認',
    title: '師傅已提供報價',
    summary: '同意後師傅會依案件資訊前往處理；若不接受，平台會協助後續安排。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('報價金額', `${amount.toLocaleString('zh-TW')} 元`),
    ],
    actions: [
      button(postbackAction('同意報價', `customer:accept_quote:${order.id}`, '同意報價'), 'primary'),
      button(postbackAction('拒絕報價', `customer:reject_quote:${order.id}`, '拒絕報價')),
      button(postbackAction('取消案件', `customer:cancel_order:${order.id}`, '取消案件')),
    ],
  });
}

function changeRequestMessage(order) {
  const amount = Number(order.change_request_amount || 0);
  return orderCard({
    altText: `追加報價 ${amount} 元`,
    status: '待你確認',
    title: '師傅提出追加報價',
    summary: order.change_request_reason || '師傅回報現場需要追加處理項目。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('追加金額', `${amount.toLocaleString('zh-TW')} 元`),
    ],
    actions: [
      button(postbackAction('同意追加', `customer:accept_quote:${order.id}`, '同意追加'), 'primary'),
      button(postbackAction('拒絕追加', `customer:reject_quote:${order.id}`, '拒絕追加')),
      button(postbackAction('取消案件', `customer:cancel_order:${order.id}`, '取消案件')),
    ],
  });
}

function assignedCustomerMessage(order, technician) {
  const technicianName = technician?.name || '師傅';
  const technicianPhone = technician?.phone || '暫無電話';

  return orderCard({
    altText: `師傅已接單 ${order.order_no}`,
    status: '師傅已接單',
    title: '請等待師傅先提供報價',
    summary: '報價送出後，你會收到確認按鈕；同意後師傅再前往。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('服務類型', order.service_type),
      infoRow('師傅', technicianName),
      infoRow('師傅電話', technicianPhone),
      infoRow('時間需求', order.preferred_time_text || '越快越好'),
    ],
  });
}

function dispatchTimeoutMessage(order) {
  return orderCard({
    altText: `案件正在重新媒合 ${order.order_no}`,
    status: '重新媒合中',
    title: '目前附近師傅都在忙',
    summary: '我們正在協助尋找其他可接案師傅，會盡快通知你。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('服務類型', order.service_type),
      infoRow('區域', order.area),
      infoRow('時間需求', order.preferred_time_text || '越快越好'),
    ],
  });
}

function completionMessage(order) {
  const amount = Number(order.final_amount || order.quote_amount || 0);
  return orderCard({
    altText: `完工確認 ${amount} 元`,
    status: '待你確認',
    title: '師傅已回報完工',
    summary: '請確認服務是否完成。若有問題，可以提出申訴讓平台協助。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('實付金額', `${amount.toLocaleString('zh-TW')} 元`),
    ],
    actions: [
      button(postbackAction('確認結案', `customer:confirm_completion:${order.id}`, '確認結案'), 'primary'),
      button(postbackAction('我要申訴', `customer:dispute_completion:${order.id}`, '我要申訴')),
    ],
  });
}

function customerReviewRatingMessage(order) {
  return textWithQuickReply(
    [
      '謝謝你確認結案。',
      `案件編號：${order.order_no}`,
      '',
      '請給這次服務 1 到 5 分，5 分代表非常滿意。'
    ].join('\n'),
    [1, 2, 3, 4, 5].map((score) => messageAction(`${score} 分`, String(score)))
  );
}

function customerReviewCommentPrompt(rating) {
  return [
    `已收到 ${rating} 分。`,
    '請留下這次服務評語，或輸入「略過」。'
  ].join('\n');
}

module.exports = {
  customerMessages,
  welcomeMessage,
  reviewApprovedMessage,
  quoteMessage,
  changeRequestMessage,
  assignedCustomerMessage,
  dispatchTimeoutMessage,
  completionMessage,
  customerReviewRatingMessage,
  customerReviewCommentPrompt,
  textWithQuickReply,
  postbackAction,
  orderCard,
};
