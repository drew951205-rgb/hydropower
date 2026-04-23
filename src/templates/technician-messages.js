const { orderSummary } = require('../utils/format-message');
const { uriAction } = require('../utils/liff-url');

function postbackAction(label, data, displayText = label) {
  return { type: 'postback', label, data, displayText };
}

const technicianMessages = {
  assignmentText: (order) => `新案件待接單\n\n${orderSummary(order)}`,
  assignedText: (order) =>
    `接單成功\n地址：${order.address}\n電話：${order.contact_phone || '未填寫'}`,
  alreadyTaken: '這張案件已被其他師傅接走，請等待下一張。',
  completed: '完工回報已送出，等待顧客確認結案。',
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
        text: String(value || '未填寫'),
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

function cancelAction(order) {
  return uriAction('取消案件', '/liff/cancel', {
    order_id: order.id,
    role: 'technician',
  });
}

function navigateAction(order) {
  return uriAction('即將趕往現場', '/liff/navigate', {
    order_id: order.id,
  });
}

function photoCount(order) {
  if (Array.isArray(order.images)) return order.images.length;
  return Number(order.image_count || 0);
}

function photoLabel(order) {
  const count = photoCount(order);
  return count ? `${count} 張現場照片` : '未提供照片';
}

function preferredTimeLabel(order) {
  return order.preferred_time_text || '未指定時段';
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
    altText: `新案件 ${order.order_no}`,
    status: '新案件待接單',
    title: '有新案件等待接單',
    summary: '請先確認服務區域、時段與案件描述，再決定是否接單。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('服務類型', order.service_type),
      infoRow('案件區域', order.area),
      infoRow('時間需求', preferredTimeLabel(order)),
      infoRow('案件照片', photoLabel(order)),
      infoRow('問題描述', order.issue_description),
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
    title: '先閱讀案件，再送出報價',
    summary: '顧客會先看到你的報價與預計到場時間，確認後你再出發。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('服務類型', order.service_type),
      infoRow('案件區域', order.area),
      infoRow('時間需求', preferredTimeLabel(order)),
      infoRow('案件地址', order.address),
      infoRow('客戶 / 稱呼', order.contact_name || '未填寫'),
      infoRow('聯絡電話', order.contact_phone || '未填寫'),
      infoRow('案件照片', photoLabel(order)),
      infoRow('問題描述', order.issue_description),
    ],
    actions: [
      button(uriAction('前往報價', '/liff/quote', { order_id: order.id }), 'primary'),
      button(cancelAction(order)),
    ],
  });
}

function quotePromptMessage(order) {
  return technicianCard({
    altText: `等待報價 ${order.order_no}`,
    status: '等待送出報價',
    title: '請確認後送出正式報價',
    summary: '建議把基本費、材料費與工資都算清楚，並填上預計到場時間。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('服務類型', order.service_type),
      infoRow('案件區域', order.area),
      infoRow('時間需求', preferredTimeLabel(order)),
      infoRow('案件地址', order.address),
      infoRow('客戶 / 稱呼', order.contact_name || '未填寫'),
      infoRow('聯絡電話', order.contact_phone || '未填寫'),
      infoRow('案件照片', photoLabel(order)),
      infoRow('問題描述', order.issue_description),
      infoRow('操作提示', '例如：報價 1500 更換止水閥'),
    ],
    actions: [
      button(uriAction('送出報價', '/liff/quote', { order_id: order.id }), 'primary'),
      button(cancelAction(order)),
    ],
  });
}

function changeRequestPromptMessage(order) {
  return technicianCard({
    altText: `等待追加報價 ${order.order_no}`,
    status: '追加報價',
    title: '現場有新增項目就送出追加',
    summary: '請說明追加原因與金額，顧客確認後才能繼續施工。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('原始報價', `${Number(order.quote_amount || 0).toLocaleString('zh-TW')} 元`),
      infoRow('操作提示', '例如：追加 500 更換零件'),
    ],
    actions: [
      button(uriAction('送出追加', '/liff/change-request', { order_id: order.id }), 'primary'),
      button(cancelAction(order)),
    ],
  });
}

function acceptedQuoteTechnicianMessage(order) {
  return technicianCard({
    altText: `客戶已接受報價 ${order.order_no}`,
    status: '第 1 步：準備出發',
    title: '先通知客戶，再前往現場',
    summary:
      '按下「即將趕往現場」後，系統會先通知客戶提前準備，再幫你開啟 Google Maps 導航。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('時間需求', preferredTimeLabel(order)),
      infoRow('案件地址', order.address),
      infoRow('客戶 / 稱呼', order.contact_name || '未填寫'),
      infoRow('聯絡電話', order.contact_phone || '未填寫'),
    ],
    actions: [
      button(navigateAction(order), 'primary'),
      button(postbackAction('已到場', `technician:arrived:${order.id}`, '已到場')),
      button(uriAction('追加報價', '/liff/change-request', { order_id: order.id })),
      button(postbackAction('完工回報', `technician:complete:${order.id}`, '完工回報')),
      button(cancelAction(order)),
    ],
  });
}

function acceptedChangeRequestTechnicianMessage(order) {
  return technicianCard({
    altText: `客戶已同意追加 ${order.order_no}`,
    status: '追加報價已同意',
    title: '可繼續施工，完成後再回報',
    summary: '顧客已確認追加金額，若現場內容都完成了，可以直接送出完工回報。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('原始報價', `${Number(order.quote_amount || 0).toLocaleString('zh-TW')} 元`),
      infoRow('追加金額', `${Number(order.change_request_amount || 0).toLocaleString('zh-TW')} 元`),
      infoRow('追加原因', order.change_request_reason || '未填寫'),
      infoRow('案件地址', order.address),
      infoRow('聯絡電話', order.contact_phone || '未填寫'),
    ],
    actions: [
      button(postbackAction('完工回報', `technician:complete:${order.id}`, '完工回報'), 'primary'),
      button(uriAction('再次追加', '/liff/change-request', { order_id: order.id })),
      button(cancelAction(order)),
    ],
  });
}

function arrivedTechnicianMessage(order) {
  return technicianCard({
    altText: `已到場 ${order.order_no}`,
    status: '第 2 步：已到場',
    title: '確認是否還要追加，再完工回報',
    summary: '若現場發現要新增項目，可先送追加報價；若已施工完成，就直接完工回報。',
    rows: [
      infoRow('案件編號', order.order_no),
      infoRow('原始報價', `${Number(order.quote_amount || 0).toLocaleString('zh-TW')} 元`),
      infoRow('追加金額', `${Number(order.change_request_amount || 0).toLocaleString('zh-TW')} 元`),
      infoRow('案件地址', order.address),
      infoRow('聯絡電話', order.contact_phone || '未填寫'),
    ],
    actions: [
      button(postbackAction('完工回報', `technician:complete:${order.id}`, '完工回報'), 'primary'),
      button(uriAction('追加報價', '/liff/change-request', { order_id: order.id })),
      button(cancelAction(order)),
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
