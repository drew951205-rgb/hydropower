const state = {
  adminKey: localStorage.getItem('shiFuDiJiaAdminKey') || 'change-me',
  orders: [],
  technicians: [],
  customers: [],
  supportTickets: [],
  dispatchCandidates: [],
  selectedOrderId: null,
  selectedOrder: null,
  selectedSupportTicketId: null,
  selectedSupportTicket: null,
  seenConversationByOrder: loadSeenConversationState(),
  seenConversationBySupport: loadSeenSupportConversationState()
};

const els = {
  adminKey: document.querySelector('#adminKey'),
  saveKeyButton: document.querySelector('#saveKeyButton'),
  refreshButton: document.querySelector('#refreshButton'),
  statusFilter: document.querySelector('#statusFilter'),
  statusText: document.querySelector('#statusText'),
  ordersTable: document.querySelector('#ordersTable'),
  detailHint: document.querySelector('#detailHint'),
  orderDetail: document.querySelector('#orderDetail'),
  customerReplies: document.querySelector('#customerReplies'),
  actions: document.querySelector('#actions'),
  customerStatus: document.querySelector('#customerStatus'),
  customerList: document.querySelector('#customerList'),
  customerDetail: document.querySelector('#customerDetail'),
  loadCustomersButton: document.querySelector('#loadCustomersButton'),
  memberBroadcastForm: document.querySelector('#memberBroadcastForm'),
  supportStatus: document.querySelector('#supportStatus'),
  supportStatusFilter: document.querySelector('#supportStatusFilter'),
  supportTypeFilter: document.querySelector('#supportTypeFilter'),
  supportTicketList: document.querySelector('#supportTicketList'),
  loadSupportButton: document.querySelector('#loadSupportButton'),
  technicianStatus: document.querySelector('#technicianStatus'),
  technicianList: document.querySelector('#technicianList'),
  loadTechniciansButton: document.querySelector('#loadTechniciansButton'),
  createTechnicianForm: document.querySelector('#createTechnicianForm'),
  toast: document.querySelector('#toast')
};

function loadSeenConversationState() {
  try {
    return JSON.parse(localStorage.getItem('shiFuDiJiaSeenConversation') || '{}');
  } catch (error) {
    console.warn('[admin:seen-conversation:reset]', error);
    return {};
  }
}

function saveSeenConversationState() {
  localStorage.setItem(
    'shiFuDiJiaSeenConversation',
    JSON.stringify(state.seenConversationByOrder || {})
  );
}

function loadSeenSupportConversationState() {
  try {
    return JSON.parse(localStorage.getItem('shiFuDiJiaSeenSupportConversation') || '{}');
  } catch (error) {
    console.warn('[admin:seen-support-conversation:reset]', error);
    return {};
  }
}

function saveSeenSupportConversationState() {
  localStorage.setItem(
    'shiFuDiJiaSeenSupportConversation',
    JSON.stringify(state.seenConversationBySupport || {})
  );
}

const statusLabels = {
  pending_review: '待審核',
  waiting_customer_info: '待補資料',
  pending_dispatch: '待派單',
  dispatching: '派單中',
  assigned: '已接單',
  quoted: '已報價',
  in_progress: '客戶已接受報價',
  arrived: '已到場',
  completed_pending_customer: '待客戶確認',
  closed: '已結案',
  customer_cancelled: '客戶取消',
  technician_cancelled: '師傅取消',
  platform_cancelled: '平台取消',
  platform_review: '平台審核',
  dispute_review: '爭議審核'
};

function headers() {
  return {
    'content-type': 'application/json; charset=utf-8',
    'x-admin-api-key': state.adminKey
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 2800);
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function money(value) {
  const amount = Number(value || 0);
  return amount ? `$${amount.toLocaleString('zh-TW')}` : '';
}

function statusText(status) {
  return statusLabels[status] || status || '';
}

function supportStatusText(status) {
  return {
    open: '待處理',
    in_progress: '處理中',
    resolved: '已處理',
    closed: '已關閉'
  }[status] || status || '';
}

function supportTypeText(type) {
  return {
    general: '一般諮詢',
    completion_dispute: '完工申訴',
    quote_dispute: '報價申訴',
    technician_no_show: '師傅未到場',
    service_quality: '施工品質',
    cancel_order: '取消案件爭議',
    customer_cancel: '客戶取消',
    technician_cancel: '師傅取消'
  }[type] || type || '';
}

function isDisputeSupportType(type) {
  return ['completion_dispute', 'quote_dispute', 'technician_no_show', 'service_quality', 'cancel_order']
    .includes(type);
}

function visibleSupportTickets(tickets) {
  return (tickets || []).filter((ticket) =>
    isDisputeSupportType(ticket.type) || ['customer_cancel', 'technician_cancel'].includes(ticket.type)
  );
}

function renderSupportImagePreview(ticket) {
  const images = Array.isArray(ticket.image_urls) ? ticket.image_urls.filter(Boolean) : [];
  if (!images.length) return '';
  return `<div class="support-image-preview">${images.slice(0, 3).map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(url)}" alt="????"></a>`).join('')}</div>`;
}

function nextStepText(order) {
  if (!order) return '';

  const messages = {
    pending_review: '請審核案件內容，確認後按「審核通過」。',
    waiting_customer_info: '請等待顧客補齊案件資料。',
    pending_dispatch: '請選擇合適師傅並送出派單。',
    dispatching: '已通知師傅，請等待師傅接單。',
    assigned: '師傅已接單，請等待師傅先提供報價。',
    quoted: '已送出報價，請等待顧客同意報價。',
    in_progress: '顧客已同意報價，請等待師傅前往並回報到場。',
    arrived: '師傅已到場，請等待師傅完工回報。',
    completed_pending_customer: '師傅已完工，請等待顧客確認結案。',
    closed: '案件已結案，可查看紀錄或客戶評價。',
    customer_cancelled: '顧客已取消案件，請確認是否需要人工追蹤。',
    technician_cancelled: '師傅已取消案件，請重新派單或人工聯繫。',
    platform_cancelled: '平台已取消案件，可查看取消原因。',
    platform_review: '案件需要平台審核，請確認報價、追加或異常原因。',
    dispute_review: '顧客提出爭議，請人工聯繫雙方確認。'
  };

  return messages[order.status] || '請查看案件紀錄確認下一步。';
}

function normalizeListInput(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function can(order, action) {
  if (!order) return false;
  const status = order.status;
  if (action === 'approve') return status === 'pending_review';
  if (action === 'dispatch') return ['pending_dispatch', 'dispatching'].includes(status);
  if (action === 'accept-quote') return ['quoted', 'platform_review'].includes(status);
  if (action === 'cancel') return !['closed', 'customer_cancelled', 'technician_cancelled', 'platform_cancelled'].includes(status);
  return false;
}

async function loadOrders() {
  const params = new URLSearchParams();
  if (els.statusFilter.value) params.set('status', els.statusFilter.value);
  const suffix = params.toString() ? `?${params}` : '';
  els.statusText.textContent = '載入中';
  const result = await api(`/api/orders${suffix}`);
  state.orders = result.data || [];
  els.statusText.textContent = `${state.orders.length} 筆`;
  renderOrders();
}

function renderOrders() {
  if (!state.orders.length) {
    els.ordersTable.innerHTML = '<tr><td colspan="8" class="empty">沒有案件</td></tr>';
    return;
  }

  els.ordersTable.innerHTML = state.orders.map((order) => `
    <tr data-order-id="${order.id}" class="${String(order.id) === String(state.selectedOrderId) ? 'selected' : ''}">
      <td>${escapeHtml(order.order_no || order.id)}</td>
      <td><span class="status-pill">${statusText(order.status)}</span></td>
      <td>${escapeHtml(order.area || '')}</td>
      <td>${escapeHtml(order.service_type || '')}</td>
      <td>${escapeHtml(order.preferred_time_text || '越快越好')}</td>
      <td>${escapeHtml(order.technician_id || '')}</td>
      <td>${escapeHtml(nextStepText(order))}</td>
      <td>${formatDate(order.created_at)}</td>
    </tr>
  `).join('');
}

async function selectOrder(orderId) {
  state.selectedOrderId = orderId;
  state.selectedSupportTicketId = null;
  state.selectedSupportTicket = null;
  const result = await api(`/api/orders/${orderId}`);
  state.selectedOrder = result.data;
  if (can(state.selectedOrder, 'dispatch')) {
    await loadDispatchCandidates(orderId);
  } else {
    state.dispatchCandidates = [];
  }
  els.detailHint.textContent = state.selectedOrder.order_no;
  renderOrders();
  renderSupportTickets();
  renderDetail();
  renderActions();
}

function timelineLabel(log) {
  return {
    customer_create_order: '客戶建立報修單',
    review_approve: '平台審核通過',
    review_request_more_info: '平台要求補充資料',
    review_reject: '平台審核未通過',
    dispatch_order: '平台派單',
    manual_assign_order: '平台指定師傅',
    accept_assignment: '師傅接單',
    submit_quote: '師傅送出報價',
    customer_accept_quote: '客戶同意報價',
    customer_reject_quote: '客戶拒絕報價',
    technician_arrived: '師傅已到場',
    submit_change_request: '師傅送出追加報價',
    customer_accept_change_request: '客戶同意追加報價',
    customer_reject_change_request: '客戶拒絕追加報價',
    technician_complete: '師傅完工回報',
    customer_confirm_completion: '客戶確認結案',
    customer_dispute_completion: '客戶提出申訴',
    cancel_order: '案件取消',
    dispatch_timeout: '派單逾時',
    stale_order_review: '案件停滯提醒',
    admin_note: '管理員內部備註',
  }[log.action] || log.action || '系統紀錄';
}

function renderTimeline(order) {
  const logs = [...(order.logs || [])].sort(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
  );
  if (!logs.length) return '<p class="empty compact-empty">尚無時間軸紀錄</p>';

  return `
    <ol class="timeline">
      ${logs.map((log) => `
        <li>
          <time>${escapeHtml(formatDate(log.created_at))}</time>
          <strong>${escapeHtml(timelineLabel(log))}</strong>
          <span>${escapeHtml(statusText(log.from_status) || '-')} → ${escapeHtml(statusText(log.to_status) || '-')}</span>
          ${log.note ? `<p>${escapeHtml(log.note)}</p>` : ''}
        </li>
      `).join('')}
    </ol>
  `;
}

function renderAdminNotes(order) {
  const notes = (order.messages || [])
    .filter((message) => message.message_type === 'admin_note')
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  if (!notes.length) return '<p class="empty compact-empty">尚無內部備註</p>';

  return `
    <div class="note-list">
      ${notes.map((note) => `
        <article>
          <time>${escapeHtml(formatDate(note.created_at))}</time>
          <p>${escapeHtml(note.content)}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function renderCustomerReplies(order) {
  const replies = (order.messages || [])
    .filter((message) => ['customer_reply', 'support_ticket', 'customer_cancel'].includes(message.message_type))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  if (!replies.length) return '<p class="empty compact-empty">目前沒有客戶回覆</p>';

  return `
    <div class="note-list">
      ${replies.map((reply) => `
        <article>
          <time>${escapeHtml(formatDate(reply.created_at))}</time>
          <strong>${escapeHtml(reply.message_type === 'support_ticket' ? '客服單' : reply.message_type === 'customer_cancel' ? '客戶取消' : '客戶回覆')}</strong>
          <p>${escapeHtml(reply.content)}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function conversationEntries(order) {
  const customerMessages = (order.messages || [])
    .filter((message) => ['customer_reply', 'support_ticket', 'customer_cancel'].includes(message.message_type))
    .map((message) => ({
      id: `message-${message.id || message.created_at}`,
      side: 'left',
      role: message.message_type === 'support_ticket'
        ? '客戶客服'
        : message.message_type === 'customer_cancel'
          ? '客戶取消'
          : '客戶訊息',
      meta: message.message_type === 'support_ticket' ? '已建立客服單' : '',
      content: message.content,
      created_at: message.created_at,
    }));

  const adminReplies = (order.support_tickets || [])
    .filter((ticket) => ticket.admin_reply)
    .map((ticket) => ({
      id: `ticket-reply-${ticket.id || ticket.created_at}`,
      side: 'right',
      role: '平台客服',
      meta: ticket.ticket_no || '',
      content: ticket.admin_reply,
      created_at: ticket.admin_replied_at || ticket.updated_at || ticket.created_at,
    }));

  return [...customerMessages, ...adminReplies]
    .filter((entry) => entry.created_at)
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
}

function latestConversationAt(order) {
  const entries = conversationEntries(order);
  return entries.length ? entries[entries.length - 1].created_at : null;
}

function getSeenConversationAt(orderId) {
  return state.seenConversationByOrder?.[String(orderId)] || null;
}

function getSeenSupportConversationAt(ticketId) {
  return state.seenConversationBySupport?.[String(ticketId)] || null;
}

function markConversationSeen(order) {
  const latestAt = latestConversationAt(order);
  if (!order?.id || !latestAt) return;
  state.seenConversationByOrder[String(order.id)] = latestAt;
  saveSeenConversationState();
}

function latestSupportConversationAt(ticket) {
  const entries = supportConversationEntries(ticket);
  return entries.length ? entries[entries.length - 1].created_at : null;
}

function markSupportConversationSeen(ticket) {
  const latestAt = latestSupportConversationAt(ticket);
  if (!ticket?.id || !latestAt) return;
  state.seenConversationBySupport[String(ticket.id)] = latestAt;
  saveSeenSupportConversationState();
}

function scrollConversationToLatest() {
  window.requestAnimationFrame(() => {
    if (!els.customerReplies) return;
    els.customerReplies.scrollTop = els.customerReplies.scrollHeight;
  });
}

function isUnreadConversationEntry(entry, seenAt) {
  if (!entry?.created_at) return false;
  if (!seenAt) return true;
  return new Date(entry.created_at) > new Date(seenAt);
}

function renderCustomerConversation(order) {
  const timeline = conversationEntries(order);
  const seenAt = getSeenConversationAt(order.id);

  if (!timeline.length) return '<p class="empty compact-empty">目前還沒有客戶對話紀錄</p>';

  return `
    <div class="chat-thread">
      ${timeline.map((entry) => `
        <article class="chat-row ${entry.side === 'right' ? 'is-admin' : 'is-customer'} ${isUnreadConversationEntry(entry, seenAt) ? 'is-unread' : ''}" data-chat-id="${escapeHtml(entry.id)}">
          <div class="chat-meta">
            <strong>${escapeHtml(entry.role)}</strong>
            <time>${escapeHtml(formatDate(entry.created_at))}</time>
          </div>
          <div class="chat-bubble">
            ${entry.meta ? `<span class="chat-tag">${escapeHtml(entry.meta)}</span>` : ''}
            ${isUnreadConversationEntry(entry, seenAt) ? '<span class="chat-unread">未讀</span>' : ''}
            <p>${escapeHtml(entry.content)}</p>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function supportConversationEntries(ticket) {
  const timeline = [];

  if (ticket?.message) {
    timeline.push({
      id: `support-message-${ticket.id || ticket.created_at}`,
      side: 'left',
      role: '客戶',
      meta: ticket.ticket_no || '',
      content: ticket.message,
      created_at: ticket.created_at,
    });
  }

  if (ticket?.admin_reply) {
    timeline.push({
      id: `support-reply-${ticket.id || ticket.admin_replied_at}`,
      side: 'right',
      role: '平台客服',
      meta: ticket.status || '',
      content: ticket.admin_reply,
      created_at: ticket.admin_replied_at || ticket.updated_at || ticket.created_at,
    });
  }

  return timeline
    .filter((entry) => entry.content && entry.created_at)
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
}

function renderSupportConversation(ticket) {
  const timeline = supportConversationEntries(ticket);
  const seenAt = getSeenSupportConversationAt(ticket.id);

  if (!timeline.length) return '<p class="empty compact-empty">目前沒有客服對話紀錄</p>';

  return `
    <div class="chat-thread">
      ${timeline.map((entry) => `
        <article class="chat-row ${entry.side === 'right' ? 'is-admin' : 'is-customer'} ${isUnreadConversationEntry(entry, seenAt) ? 'is-unread' : ''}" data-chat-id="${escapeHtml(entry.id)}">
          <div class="chat-meta">
            <strong>${escapeHtml(entry.role)}</strong>
            <time>${escapeHtml(formatDate(entry.created_at))}</time>
          </div>
          <div class="chat-bubble">
            ${entry.meta ? `<span class="chat-tag">${escapeHtml(entry.meta)}</span>` : ''}
            ${isUnreadConversationEntry(entry, seenAt) ? '<span class="chat-unread">未讀</span>' : ''}
            <p>${escapeHtml(entry.content)}</p>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderConversationPanel() {
  if (state.selectedSupportTicket) {
    els.customerReplies.innerHTML = renderSupportConversation(state.selectedSupportTicket);
    scrollConversationToLatest();
    markSupportConversationSeen(state.selectedSupportTicket);
    return;
  }

  if (state.selectedOrder) {
    els.customerReplies.innerHTML = renderCustomerConversation(state.selectedOrder);
    scrollConversationToLatest();
    markConversationSeen(state.selectedOrder);
    return;
  }

  els.customerReplies.innerHTML = '<p class="empty compact-empty">請先選擇案件或客服單</p>';
}

function renderReasonCards(order) {
  const cards = [];
  if (order.cancel_reason_text) {
    cards.push(`
      <article class="reason-card">
        <strong>取消原因</strong>
        <span>${escapeHtml(order.cancelled_by || '')} / ${escapeHtml(order.cancel_reason_code || '')}</span>
        <p>${escapeHtml(order.cancel_reason_text)}</p>
      </article>
    `);
  }
  if (order.dispute_reason) {
    cards.push(`
      <article class="reason-card">
        <strong>申訴原因</strong>
        <p>${escapeHtml(order.dispute_reason)}</p>
      </article>
    `);
  }
  if (order.platform_review_reason) {
    cards.push(`
      <article class="reason-card">
        <strong>平台審核原因</strong>
        <p>${escapeHtml(order.platform_review_reason)}</p>
      </article>
    `);
  }
  return cards.length ? cards.join('') : '<p class="empty compact-empty">目前沒有取消或申訴原因</p>';
}

function renderDetail() {
  const order = state.selectedOrder;
  if (!order) {
    els.orderDetail.innerHTML = '';
    renderConversationPanel();
    return;
  }

  const technicianReview = [...(order.messages || [])]
    .reverse()
    .find((message) => message.message_type === 'technician_review');

  const rows = [
    ['\u72c0\u614b', statusText(order.status)],
    ['\u4e0b\u4e00\u6b65', nextStepText(order)],
    ['\u6848\u4ef6\u7de8\u865f', order.order_no],
    ['\u670d\u52d9\u985e\u578b', order.service_type],
    ['\u670d\u52d9\u6a21\u5f0f', order.service_mode === 'scheduled' ? '\u9810\u7d04' : '\u7acb\u5373'],
    ['\u9810\u7d04\u6642\u9593', order.preferred_time_text || '\u672a\u586b'],
    ['\u5340\u57df', order.area],
    ['\u5730\u5740', order.address],
    ['\u554f\u984c\u63cf\u8ff0', order.issue_description],
    ['\u806f\u7d61\u4eba', order.contact_name],
    ['\u96fb\u8a71', order.contact_phone],
    ['\u5ba2\u6236 ID', order.customer_id],
    ['\u5e2b\u5085 ID', order.technician_id || ''],
    ['\u539f\u59cb\u5831\u50f9', money(order.quote_amount)],
    ['\u8ffd\u52a0\u5831\u50f9', money(order.change_request_amount)],
    ['\u6700\u7d42\u91d1\u984d', money(order.paid_amount || order.final_amount)],
    ['\u5ba2\u6236\u8a55\u5206', order.rating ? `${order.rating} / 5` : ''],
    ['\u5ba2\u6236\u8a55\u8a9e', order.customer_comment || ''],
    ['\u5e2b\u5085\u5fc3\u5f97', technicianReview?.content || ''],
    ['\u7d00\u9304\u7b46\u6578', `${order.logs?.length || 0} \u7b46`]
  ];

  const images = order.images || [];
  const imageGallery = images.length
    ? `
      <dt>\u6848\u4ef6\u7167\u7247</dt>
      <dd>
        <div class="image-grid">
          ${images.map((image) => {
            const url = image.image_url || '';
            const isImageUrl = /^https?:\/\//.test(url);
            return isImageUrl
              ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(url)}" alt="\u6848\u4ef6\u7167\u7247"></a>`
              : `<span class="image-token">${escapeHtml(url)}</span>`;
          }).join('')}
        </div>
      </dd>
    `
    : '<dt>\u6848\u4ef6\u7167\u7247</dt><dd>\u5c1a\u672a\u4e0a\u50b3</dd>';

  els.orderDetail.innerHTML = rows.map(([label, value]) => `
    <dt>${escapeHtml(label)}</dt>
    <dd>${escapeHtml(value)}</dd>
  `).join('') + imageGallery + `
    <dt>\u539f\u56e0\u6458\u8981</dt>
    <dd>${renderReasonCards(order)}</dd>
    <dt>\u6848\u4ef6\u6642\u9593\u8ef8</dt>
    <dd>${renderTimeline(order)}</dd>
    <dt>\u5167\u90e8\u5099\u8a3b</dt>
    <dd>${renderAdminNotes(order)}</dd>
  `;
  renderConversationPanel();
}

function renderActions() {
  const order = state.selectedOrder;
  if (!order) {
    els.actions.innerHTML = '<p class="empty">選擇案件後可以操作</p>';
    return;
  }

  const blocks = [];
  blocks.push(`
    <div class="action-guide">
      <strong>下一步</strong>
      <p>${escapeHtml(nextStepText(order))}</p>
    </div>
  `);

  blocks.push(`
    <form class="quick-form" data-form="admin-note">
      <h3>內部備註</h3>
      <label>只給後台看的紀錄
        <textarea name="note" maxlength="500" required placeholder="例如：已電話聯繫客戶，客戶希望晚上 7 點後再安排。"></textarea>
      </label>
      <button type="submit">新增備註</button>
    </form>
  `);

  if (can(order, 'approve')) {
    blocks.push('<button type="button" data-action="approve">審核通過</button>');
  }

  if (can(order, 'dispatch')) {
    blocks.push(`
      <form class="quick-form" data-form="dispatch">
        <h3>派單</h3>
        <label>師傅 ID<input name="technician_ids" placeholder="8,9"></label>
        <button type="submit">送出派單</button>
      </form>
    `);
    blocks.push(renderDispatchCandidates());
  }

  if (can(order, 'accept-quote')) {
    blocks.push('<button type="button" data-action="accept-quote">客戶接受報價</button>');
  }

  if (can(order, 'cancel')) {
    blocks.push('<button class="warn" type="button" data-action="cancel">平台取消案件</button>');
  }

  els.actions.innerHTML = blocks.length ? blocks.join('') : '<p class="empty">目前沒有可用操作</p>';
}

function renderDispatchCandidates() {
  if (!state.dispatchCandidates.length) {
    return '<div class="candidate-list"><h3>推薦師傅</h3><p class="empty compact-empty">目前沒有推薦名單</p></div>';
  }

  return `
    <div class="candidate-list">
      <h3>推薦師傅</h3>
      ${state.dispatchCandidates.slice(0, 8).map((candidate) => {
        const blocks = candidate.hard_blocks || [];
        const notes = blocks.length ? blocks : [...(candidate.reasons || []), ...(candidate.warnings || [])];
        return `
          <article class="candidate-item ${candidate.eligible ? '' : 'blocked'}">
            <div>
              <strong>${escapeHtml(candidate.name || `師傅 ${candidate.technician_id}`)}</strong>
              <span>分數 ${candidate.score}｜今日 ${candidate.stats.today_assigned_count}/${candidate.stats.daily_job_limit}｜進行中 ${candidate.stats.active_job_count}/${candidate.stats.active_job_limit}</span>
              <small>${escapeHtml(notes.join('、') || '尚無評分資料')}</small>
            </div>
            <button type="button" data-dispatch-candidate="${candidate.technician_id}" ${candidate.eligible ? '' : 'disabled'}>
              派給這位
            </button>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

async function loadDispatchCandidates(orderId) {
  const result = await api(`/api/orders/${orderId}/dispatch-candidates`);
  state.dispatchCandidates = result.data || [];
}

async function loadCustomers() {
  els.customerStatus.textContent = '載入中';
  const result = await api('/api/admin/customers');
  state.customers = result.data || [];
  els.customerStatus.textContent = `${state.customers.length} 位`;
  renderCustomers();
}

function customerName(customer) {
  return customer.name || customer.line_display_name || customer.line_user_id || `客戶 ${customer.id}`;
}

function renderCustomers() {
  if (!state.customers.length) {
    els.customerList.innerHTML = '<p class="empty">沒有客戶資料</p>';
    return;
  }

  els.customerList.innerHTML = state.customers.map((customer) => `
    <button class="customer-item" type="button" data-customer-id="${customer.id}">
      <span class="customer-row">
        ${customer.line_picture_url ? `<img src="${escapeHtml(customer.line_picture_url)}" alt="">` : '<b></b>'}
        <span>${escapeHtml(customerName(customer))}</span>
      </span>
      <small>${escapeHtml(customer.phone || '未留電話')}｜${customer.order_count || 0} 件｜評分 ${customer.average_rating ? Number(customer.average_rating).toFixed(1) : '-'}｜${formatDate(customer.last_interaction_at)}</small>
    </button>
  `).join('');
}

async function selectCustomer(customerId) {
  const result = await api(`/api/admin/customers/${customerId}`);
  const customer = result.data;
  const orders = customer.orders || [];

  els.customerDetail.innerHTML = `
    <div class="profile-head">
      ${customer.line_picture_url ? `<img src="${escapeHtml(customer.line_picture_url)}" alt="">` : '<div class="avatar-fallback"></div>'}
      <div>
        <strong>${escapeHtml(customerName(customer))}</strong>
        <span>${escapeHtml(customer.line_language || '')}</span>
      </div>
    </div>
    <dl class="detail-list">
      <dt>名稱</dt><dd>${escapeHtml(customerName(customer))}</dd>
      <dt>電話</dt><dd>${escapeHtml(customer.phone || '')}</dd>
      <dt>常用地址</dt><dd>${escapeHtml(customer.default_address || '')}</dd>
      <dt>LINE ID</dt><dd>${escapeHtml(customer.line_user_id || '')}</dd>
      <dt>累計案件</dt><dd>${customer.order_count || 0} 件</dd>
      <dt>完成案件</dt><dd>${customer.closed_order_count || 0} 件</dd>
      <dt>取消案件</dt><dd>${customer.cancelled_order_count || 0} 件</dd>
      <dt>平均評分</dt><dd>${customer.average_rating ? Number(customer.average_rating).toFixed(1) : ''}</dd>
      <dt>成交金額</dt><dd>${money(customer.total_amount)}</dd>
    </dl>
    <h3>歷史案件</h3>
    <div class="mini-list">
      ${orders.length ? orders.map((order) => `
        <button type="button" data-order-id="${order.id}">
          ${escapeHtml(order.order_no)}｜${escapeHtml(order.service_type)}｜${statusText(order.status)}｜照片 ${order.image_count || 0} 張
        </button>
      `).join('') : '<p class="empty">沒有歷史案件</p>'}
    </div>
  `;
}

async function loadSupportTickets() {
  const params = new URLSearchParams();
  if (els.supportStatusFilter.value) params.set('status', els.supportStatusFilter.value);
  if (els.supportTypeFilter.value) params.set('type', els.supportTypeFilter.value);
  const suffix = params.toString() ? `?${params}` : '';
  els.supportStatus.textContent = '\u8f09\u5165\u4e2d...';
  const result = await api(`/api/admin/support-tickets${suffix}`);
  state.supportTickets = result.data || [];
  state.selectedSupportTicket = state.selectedSupportTicketId
    ? state.supportTickets.find((ticket) => String(ticket.id) === String(state.selectedSupportTicketId)) || null
    : null;
  if (!state.selectedSupportTicket) state.selectedSupportTicketId = null;
  const tickets = visibleSupportTickets(state.supportTickets);
  const openCount = tickets.filter((ticket) => ticket.status === 'open').length;
  els.supportStatus.textContent = `${tickets.length} 筆，${openCount} 筆待處理`;
  renderSupportTickets();
  renderConversationPanel();
}

function supportCustomerName(ticket) {
  const customer = ticket.customer || {};
  return customer.name || customer.line_display_name || customer.line_user_id || `\u5ba2\u6236 ${ticket.user_id || ''}`;
}

function selectSupportTicket(ticketId) {
  const ticket = state.supportTickets.find((item) => String(item.id) === String(ticketId));
  if (!ticket) return;

  state.selectedSupportTicketId = ticket.id;
  state.selectedSupportTicket = ticket;
  state.selectedOrderId = null;
  state.selectedOrder = null;
  state.dispatchCandidates = [];
  els.detailHint.textContent = ticket.order?.order_no || ticket.ticket_no;
  renderOrders();
  renderSupportTickets();
  renderDetail();
  renderActions();
}

function renderSupportTickets() {
  const tickets = visibleSupportTickets(state.supportTickets);
  if (!tickets.length) {
    els.supportTicketList.innerHTML = '<p class="empty compact-empty">目前沒有申訴單</p>';
    return;
  }

  els.supportTicketList.innerHTML = tickets.map((ticket) => {
    const order = ticket.order || {};
    const customer = ticket.customer || {};
    const reporter = ticket.reporter || {};
    const phone = ticket.phone || customer.phone || order.contact_phone || '';
    const reporterName = reporter.id && String(reporter.id) !== String(customer.id || '')
            ? ` / 代報人：${supportCustomerName({ customer: reporter })}`
      : '';
    const adminReply = ticket.admin_reply
      ? `<p class="support-reply">平台回覆：${escapeHtml(ticket.admin_reply)}</p>`
      : '';
    const ticketHint = isDisputeSupportType(ticket.type)
      ? '<small class="support-ticket-hint">??? / ?????????????????</small>'
      : '<small class="support-ticket-hint">???? / ?????????????</small>';
    return `
      <article
        class="support-ticket-item ${String(ticket.id) === String(state.selectedSupportTicketId) ? 'selected' : ''}"
        data-ticket-id="${ticket.id}"
        data-support-ticket="${ticket.id}">
        <strong>${escapeHtml(ticket.ticket_no)} / ${escapeHtml(supportTypeText(ticket.type))}</strong>
        <span>${escapeHtml(supportStatusText(ticket.status))} / ${escapeHtml(supportCustomerName(ticket))}</span>
        <small>${escapeHtml(order.order_no || '未綁定案件')} / ${escapeHtml(phone || '未填電話')} / ${escapeHtml(formatDate(ticket.created_at))}${escapeHtml(reporterName)}</small>
        ${ticketHint}
        <p>${escapeHtml(ticket.message || '')}</p>
        ${renderSupportImagePreview(ticket)}
        ${adminReply}
        <div class="support-ticket-actions">
          ${order.id ? `<button type="button" data-support-order="${order.id}">看訂單</button>` : ''}
          <button type="button" data-support-status="in_progress">看訂單</button>
          <button type="button" data-support-status="resolved">看訂單</button>
          <button type="button" class="secondary" data-support-status="closed">看訂單</button>
        </div>
        <form class="support-reply-form">
          <textarea name="reply_message" maxlength="500" required placeholder="輸入申訴回覆，會直接透過 LINE 傳給客戶。"></textarea>
          <button type="submit">回覆 LINE</button>
        </form>
      </article>`;
  }).join('');
}

async function updateSupportTicketStatus(ticketId, status) {
  await api(`/api/admin/support-tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  showToast('客服單狀態已更新');
  await loadSupportTickets();
}

async function replySupportTicket(ticketId, message) {
  await api(`/api/admin/support-tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify({ reply_message: message })
  });
  showToast('已回覆並推送 LINE');
  await loadSupportTickets();
}

async function loadTechnicians() {
  els.technicianStatus.textContent = '載入中';
  const result = await api('/api/technicians');
  state.technicians = result.data || [];
  els.technicianStatus.textContent = `${state.technicians.length} 位`;
  renderTechnicians();
}

function renderTechnicians() {
  if (!state.technicians.length) {
    els.technicianList.innerHTML = '<p class="empty">沒有師傅</p>';
    return;
  }

  els.technicianList.innerHTML = state.technicians.map((technician) => `
    <div class="technician-item">
      <div>
        <strong>${escapeHtml(technician.name || technician.line_user_id)}</strong>
        <span>ID ${escapeHtml(technician.id)} ｜ ${technician.available ? '可接案' : '暫停'}</span>
        <span>可接時段：${escapeHtml(technician.available_time_text || '未填')}</span>
      </div>
      <button type="button" data-copy-technician="${technician.id}">使用</button>
    </div>
  `).join('');
}

async function refreshSelectedOrder() {
  await loadOrders();
  if (state.selectedOrderId) await selectOrder(state.selectedOrderId);
}

async function runOrderAction(action) {
  const order = state.selectedOrder;
  if (!order) return;

  if (action === 'approve') {
    await api(`/api/orders/${order.id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', note: '審核通過' })
    });
    showToast('已通過審核');
  }

  if (action === 'accept-quote') {
    await api(`/api/orders/${order.id}/customer-confirm-quote`, {
      method: 'POST',
      body: JSON.stringify({ accepted: true, customer_id: order.customer_id })
    });
    showToast('已接受報價');
  }

  if (action === 'cancel') {
    const reason = window.prompt('請輸入取消原因，系統會通知客戶：', '平台取消案件');
    if (reason === null) return;
    const reasonText = reason.trim();
    if (!reasonText) {
      showToast('請輸入取消原因');
      return;
    }

    await api(`/api/orders/${order.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        cancelled_by: 'platform',
        reason_code: 'admin_cancel',
        reason_text: reasonText
      })
    });
    showToast('已取消案件並通知客戶');
  }

  await refreshSelectedOrder();
}

async function handleActionForm(form) {
  const order = state.selectedOrder;
  if (!order) return;
  const formData = new FormData(form);
  const kind = form.dataset.form;

  if (kind === 'dispatch') {
    const technicianIds = normalizeListInput(formData.get('technician_ids')).map(Number).filter(Boolean);
    await api(`/api/orders/${order.id}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ technician_ids: technicianIds })
    });
    showToast('已派單');
  }

  if (kind === 'admin-note') {
    await api(`/api/orders/${order.id}/admin-notes`, {
      method: 'POST',
      body: JSON.stringify({ note: formData.get('note') })
    });
    showToast('已新增內部備註');
  }

  form.reset();
  await refreshSelectedOrder();
}

async function dispatchToCandidate(technicianId) {
  const order = state.selectedOrder;
  if (!order) return;
  await api(`/api/orders/${order.id}/dispatch`, {
    method: 'POST',
    body: JSON.stringify({ technician_ids: [Number(technicianId)] })
  });
  showToast('已派單給推薦師傅');
  await refreshSelectedOrder();
}

els.adminKey.value = state.adminKey;
els.saveKeyButton.addEventListener('click', () => {
  state.adminKey = els.adminKey.value.trim();
  localStorage.setItem('shiFuDiJiaAdminKey', state.adminKey);
  showToast('管理金鑰已儲存');
  loadAll();
});

els.refreshButton.addEventListener('click', () => loadOrders().catch((error) => showToast(error.message)));
els.statusFilter.addEventListener('change', () => loadOrders().catch((error) => showToast(error.message)));
els.ordersTable.addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-order-id]');
  if (row) selectOrder(row.dataset.orderId).catch((error) => showToast(error.message));
});
els.actions.addEventListener('click', (event) => {
  const candidateButton = event.target.closest('button[data-dispatch-candidate]');
  if (candidateButton) {
    dispatchToCandidate(candidateButton.dataset.dispatchCandidate)
      .catch((error) => showToast(error.message));
    return;
  }

  const button = event.target.closest('button[data-action]');
  if (button) runOrderAction(button.dataset.action).catch((error) => showToast(error.message));
});
els.actions.addEventListener('submit', (event) => {
  event.preventDefault();
  handleActionForm(event.target).catch((error) => showToast(error.message));
});
els.loadCustomersButton.addEventListener('click', () => loadCustomers().catch((error) => showToast(error.message)));
els.customerList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-customer-id]');
  if (button) selectCustomer(button.dataset.customerId).catch((error) => showToast(error.message));
});
els.customerDetail.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-order-id]');
  if (button) selectOrder(button.dataset.orderId).catch((error) => showToast(error.message));
});
els.memberBroadcastForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const button = event.target.querySelector('button');
  button.disabled = true;
  try {
    const result = await api('/api/admin/broadcasts/members', {
      method: 'POST',
      body: JSON.stringify({
        title: formData.get('title'),
        message: formData.get('message')
      })
    });
    event.target.reset();
    showToast(`已發送給 ${result.data.sent_count}/${result.data.target_count} 位會員`);
  } finally {
    button.disabled = false;
  }
});
els.loadSupportButton.addEventListener('click', () => loadSupportTickets().catch((error) => showToast(error.message)));
els.supportStatusFilter.addEventListener('change', () => loadSupportTickets().catch((error) => showToast(error.message)));
els.supportTypeFilter.addEventListener('change', () => loadSupportTickets().catch((error) => showToast(error.message)));
els.supportTicketList.addEventListener('click', (event) => {
  const orderButton = event.target.closest('button[data-support-order]');
  if (orderButton) {
    selectOrder(orderButton.dataset.supportOrder).catch((error) => showToast(error.message));
    return;
  }

  const interactiveTarget = event.target.closest('textarea, input, select, option, button, label, .support-reply-form');
  if (interactiveTarget) {
    return;
  }

  const ticketCard = event.target.closest('[data-support-ticket]');
  if (ticketCard) {
    selectSupportTicket(ticketCard.dataset.supportTicket);
    return;
  }

  const statusButton = event.target.closest('button[data-support-status]');
  const item = event.target.closest('[data-ticket-id]');
  if (statusButton && item) {
    updateSupportTicketStatus(item.dataset.ticketId, statusButton.dataset.supportStatus)
      .catch((error) => showToast(error.message));
  }
});
els.supportTicketList.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target.closest('.support-reply-form');
  const item = event.target.closest('[data-ticket-id]');
  if (!form || !item) return;
  const formData = new FormData(form);
  const message = String(formData.get('reply_message') || '').trim();
  if (!message) {
    showToast('請輸入回覆內容');
    return;
  }
  replySupportTicket(item.dataset.ticketId, message)
    .then(() => form.reset())
    .catch((error) => showToast(error.message));
});
els.loadTechniciansButton.addEventListener('click', () => loadTechnicians().catch((error) => showToast(error.message)));
els.technicianList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-copy-technician]');
  const input = document.querySelector('form[data-form="dispatch"] input[name="technician_ids"]');
  if (button && input) {
    input.value = button.dataset.copyTechnician;
    showToast('已填入師傅 ID');
  }
});
els.createTechnicianForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  await api('/api/technicians', {
    method: 'POST',
    body: JSON.stringify({
      line_user_id: formData.get('line_user_id'),
      name: formData.get('name'),
      phone: formData.get('phone'),
      available: true,
      service_areas: normalizeListInput(formData.get('service_areas')),
      service_types: normalizeListInput(formData.get('service_types')),
      available_time_text: formData.get('available_time_text')
    })
  });
  event.target.reset();
  showToast('已建立師傅');
  await loadTechnicians();
});

function loadAll() {
  Promise.all([loadOrders(), loadTechnicians(), loadCustomers(), loadSupportTickets()]).catch((error) => showToast(error.message));
}

loadAll();
