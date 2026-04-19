const { orderSummary } = require('../utils/format-message');
const { uriAction } = require('../utils/liff-url');

function postbackAction(label, data, displayText = label) {
  return { type: 'postback', label, data, displayText };
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

function photoCount(order) {
  if (Array.isArray(order.images)) return order.images.length;
  return Number(order.image_count || 0);
}

function photoLabel(order) {
  const count = photoCount(order);
  return count ? `${count} 張` : '未提供';
}

function preferredTimeLabel(order) {
  return order.preferred_time_text || '越快越好';
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
      infoRow('時間需求', preferredTimeLabel(order)),
      infoRow('顧客照片', photoLabel(order)),
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
    title: '請依案件資訊提供報價',
    summary: '報價前請先看問題、地址與電話。客戶同意後再前往現場。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('服務類型', order.service_type),
      infoRow('區域', order.area),
      infoRow('時間需求', preferredTimeLabel(order)),
      infoRow('地址', order.address),
      infoRow('姓名 / 稱呼', order.contact_name || '未提供'),
      infoRow('電話', order.contact_phone || '未提供'),
      infoRow('顧客照片', photoLabel(order)),
      infoRow('問題描述', order.issue_description),
    ],
    actions: [
      button(
        uriAction('報價', '/liff/quote', { order_id: order.id }),
        'primary'
      ),
      button(postbackAction('取消案件', `technician:cancel:${order.id}`, '取消案件')),
    ],
  });
}

function quotePromptMessage(order) {
  return technicianCard({
    altText: `請提供報價 ${order.order_no}`,
    status: '等待報價',
    title: '請輸入本次預估報價',
    summary: '請把基本工資、材料或可能處理項目一起寫在備註，讓客戶清楚知道報價內容。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('服務類型', order.service_type),
      infoRow('區域', order.area),
      infoRow('時間需求', preferredTimeLabel(order)),
      infoRow('地址', order.address),
      infoRow('姓名 / 稱呼', order.contact_name || '未提供'),
      infoRow('電話', order.contact_phone || '未提供'),
      infoRow('顧客照片', photoLabel(order)),
      infoRow('問題描述', order.issue_description),
      infoRow('輸入範例', '報價 1500 基本檢修含更換墊片'),
    ],
    actions: [
      button(
        uriAction('開啟報價頁', '/liff/quote', { order_id: order.id }),
        'primary'
      ),
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
      button(
        uriAction('開啟追加頁', '/liff/change-request', { order_id: order.id }),
        'primary'
      ),
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
      infoRow('時間需求', preferredTimeLabel(order)),
      infoRow('地址', order.address),
      infoRow('姓名 / 稱呼', order.contact_name || '未提供'),
      infoRow('電話', order.contact_phone || '未提供'),
    ],
    actions: [
      button(postbackAction('已到場', `technician:arrived:${order.id}`, '已到場'), 'primary'),
      button(uriAction('追加報價', '/liff/change-request', { order_id: order.id })),
      button(postbackAction('完工回報', `technician:complete:${order.id}`, '完工回報')),
      button(postbackAction('取消案件', `technician:cancel:${order.id}`, '取消案件')),
    ],
  });
}

function acceptedChangeRequestTechnicianMessage(order) {
  return technicianCard({
    altText: `客戶已同意追加報價 ${order.order_no}`,
    status: '追加報價已同意',
    title: '若已處理完成，請按完工回報',
    summary:
      '客戶已同意追加報價。請依現場狀況繼續處理；若已完工，請直接送出完工回報。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow(
        '原始報價',
        `${Number(order.quote_amount || 0).toLocaleString('zh-TW')} 元`
      ),
      infoRow(
        '追加報價',
        `${Number(order.change_request_amount || 0).toLocaleString('zh-TW')} 元`
      ),
      infoRow('追加原因', order.change_request_reason || '未提供'),
      infoRow('地址', order.address),
      infoRow('姓名 / 稱呼', order.contact_name || '未提供'),
      infoRow('電話', order.contact_phone || '未提供'),
    ],
    actions: [
      button(postbackAction('完工回報', `technician:complete:${order.id}`, '完工回報'), 'primary'),
      button(uriAction('再次追加報價', '/liff/change-request', { order_id: order.id })),
      button(postbackAction('取消案件', `technician:cancel:${order.id}`, '取消案件')),
    ],
  });
}

function arrivedTechnicianMessage(order) {
  return technicianCard({
    altText: `已到場 ${order.order_no}`,
    status: '已到場',
    title: '接下來可以追加報價或完工回報',
    summary: '若現場發現需要加價，請先送追加報價讓客戶確認。若已處理完成，請直接送出完工回報。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('目前報價', `${Number(order.quote_amount || 0).toLocaleString('zh-TW')} 元`),
      infoRow('追加報價', `${Number(order.change_request_amount || 0).toLocaleString('zh-TW')} 元`),
      infoRow('地址', order.address),
      infoRow('電話', order.contact_phone || '未提供'),
    ],
    actions: [
      button(uriAction('追加報價', '/liff/change-request', { order_id: order.id }), 'primary'),
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
  acceptedChangeRequestTechnicianMessage,
  arrivedTechnicianMessage,
  technicianCard,
};
