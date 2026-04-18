const { orderSummary } = require('../utils/format-message');

function postbackAction(label, data, displayText = label) {
  return { type: 'postback', label, data, displayText };
}

function messageAction(label, text) {
  return { type: 'message', label, text };
}

const technicianMessages = {
  assignmentText: (order) => `新派單可接單：\n\n${orderSummary(order)}`,
  assignedText: (order) =>
    `接單成功。\n地址：${order.address}\n電話：${order.contact_phone || '未提供'}`,
  alreadyTaken: '這張派單已被其他師傅接走。',
  completed: '已送出完工回報，請等待客戶確認。',
};

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

function technicianCard({ altText, title, status, summary, rows, actions = [] }) {
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

function assignmentMessage(order, assignment) {
  return technicianCard({
    altText: `新派單 ${order.order_no}`,
    status: '新派單',
    title: '有新的案件可接',
    summary: '請確認區域、類型與問題描述，能處理再接單。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('服務類型', order.service_type),
      infoRow('區域', order.area),
      infoRow('問題', order.issue_description),
    ],
    actions: [
      button(
        postbackAction('接單', `technician:accept_assignment:${assignment.id}`, '接單'),
        'primary'
      ),
    ],
  });
}

function assignedMessage(order) {
  return technicianCard({
    altText: `已接單 ${order.order_no}`,
    status: '已接單',
    title: '請先提供報價',
    summary: '客戶接受報價後，系統會再傳地址與到場按鈕。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('服務類型', order.service_type),
      infoRow('區域', order.area),
    ],
    actions: [
      button(postbackAction('報價', `technician:quote:${order.id}`, '報價'), 'primary'),
      button(postbackAction('取消案件', `technician:cancel:${order.id}`, '取消案件')),
    ],
  });
}

function quotePromptMessage(order) {
  return technicianCard({
    altText: `請提供報價 ${order.order_no}`,
    status: '等待報價',
    title: '輸入報價金額',
    summary: '可直接按範例，也可以輸入「報價 1500」或「報價 案件ID 1500 備註」。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('輸入範例', '報價 1500'),
    ],
    actions: [
      button(messageAction('填入範例', '報價 1500'), 'primary'),
      button(postbackAction('取消案件', `technician:cancel:${order.id}`, '取消案件')),
    ],
  });
}

function changeRequestPromptMessage(order) {
  return technicianCard({
    altText: `請輸入追加報價 ${order.order_no}`,
    status: '追加報價',
    title: '請輸入追加金額與原因',
    summary: '請用「追加 金額 原因」送出，例如：追加 500 更換止水閥。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('目前報價', `${Number(order.quote_amount || 0).toLocaleString('zh-TW')} 元`),
      infoRow('輸入範例', '追加 500 更換零件'),
    ],
    actions: [
      button(messageAction('填入範例', '追加 500 更換零件'), 'primary'),
      button(postbackAction('取消案件', `technician:cancel:${order.id}`, '取消案件')),
    ],
  });
}

function acceptedQuoteTechnicianMessage(order) {
  return technicianCard({
    altText: `客戶已接受報價 ${order.order_no}`,
    status: '客戶已接受報價',
    title: '可以前往現場',
    summary: '請依案件資訊前往。若現場有額外項目，請按「追加報價」讓客戶確認。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('地址', order.address),
      infoRow('電話', order.contact_phone || '未提供'),
    ],
    actions: [
      button(postbackAction('已到場', `technician:arrived:${order.id}`, '已到場'), 'primary'),
      button(postbackAction('追加報價', `technician:change_request:${order.id}`, '追加報價')),
      button(postbackAction('完工回報', `technician:complete:${order.id}`, '完工回報')),
      button(postbackAction('取消案件', `technician:cancel:${order.id}`, '取消案件')),
    ],
  });
}

module.exports = {
  technicianMessages,
  assignmentMessage,
  assignedMessage,
  quotePromptMessage,
  changeRequestPromptMessage,
  acceptedQuoteTechnicianMessage,
  technicianCard,
};
