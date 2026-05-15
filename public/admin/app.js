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
};

const els = {
  sideNavItems: Array.from(document.querySelectorAll('.side-nav__item[data-nav-view]')),
  viewPanels: Array.from(document.querySelectorAll('[data-view-panel]')),
  adminKey: document.querySelector('#adminKey'),
  saveKeyButton: document.querySelector('#saveKeyButton'),
  refreshButton: document.querySelector('#refreshButton'),
  statusTextDashboard: document.querySelector('#statusTextDashboard'),
  statusFilter: document.querySelector('#statusFilter'),
  statusText: document.querySelector('#statusText'),
  casesWaitingValue: document.querySelector('#casesWaitingValue'),
  supportStatusDashboard: document.querySelector('#supportStatusDashboard'),
  customerStatus: document.querySelector('#customerStatus'),
  customerStatusDashboard: document.querySelector('#customerStatusDashboard'),
  customerStatusMirror: document.querySelector('#customerStatusMirror'),
  technicianStatus: document.querySelector('#technicianStatus'),
  technicianStatusDashboard: document.querySelector('#technicianStatusDashboard'),
  technicianStatusMirror: document.querySelector('#technicianStatusMirror'),
  ordersTable: document.querySelector('#ordersTable'),
  casesListStage: document.querySelector('#casesListStage'),
  casesDetailStage: document.querySelector('#casesDetailStage'),
  backToOrdersButton: document.querySelector('#backToOrdersButton'),
  selectedOrderHeadline: document.querySelector('#selectedOrderHeadline'),
  detailHint: document.querySelector('#detailHint'),
  caseDetailStatusPill: document.querySelector('#caseDetailStatusPill'),
  caseDetailNextStep: document.querySelector('#caseDetailNextStep'),
  orderDetail: document.querySelector('#orderDetail'),
  orderReasons: document.querySelector('#orderReasons'),
  orderTimeline: document.querySelector('#orderTimeline'),
  orderProgress: document.querySelector('#orderProgress'),
  adminNotes: document.querySelector('#adminNotes'),
  customerReplies: document.querySelector('#customerReplies'),
  actions: document.querySelector('#actions'),
  supportStatus: document.querySelector('#supportStatus'),
  supportStatusFilter: document.querySelector('#supportStatusFilter'),
  supportTypeFilter: document.querySelector('#supportTypeFilter'),
  supportTicketList: document.querySelector('#supportTicketList'),
  loadSupportButton: document.querySelector('#loadSupportButton'),
  customerList: document.querySelector('#customerList'),
  customerDetail: document.querySelector('#customerDetail'),
  loadCustomersButton: document.querySelector('#loadCustomersButton'),
  memberBroadcastForm: document.querySelector('#memberBroadcastForm'),
  technicianList: document.querySelector('#technicianList'),
  loadTechniciansButton: document.querySelector('#loadTechniciansButton'),
  createTechnicianForm: document.querySelector('#createTechnicianForm'),
  toast: document.querySelector('#toast'),
};

const statusLabels = {
  pending_review: '待審核',
  waiting_customer_info: '待客戶補件',
  pending_dispatch: '待派單',
  dispatching: '派單中',
  assigned: '已指派',
  quoted: '待客戶確認報價',
  in_progress: '進行中',
  arrived: '已到場',
  completed_pending_customer: '待客戶確認完工',
  closed: '已結案',
  customer_cancelled: '客戶取消',
  technician_cancelled: '師傅取消',
  platform_cancelled: '平台取消',
  platform_review: '平台審核中',
  dispute_review: '申訴處理中',
};

function loadSeenConversationState() {
  try {
    return JSON.parse(localStorage.getItem('shiFuDiJiaSeenConversation') || '{}');
  } catch {
    return {};
  }
}

function saveSeenConversationState() {
  localStorage.setItem(
    'shiFuDiJiaSeenConversation',
    JSON.stringify(state.seenConversationByOrder || {})
  );
}

function headers() {
  return {
    'content-type': 'application/json; charset=utf-8',
    'x-admin-api-key': state.adminKey,
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2400);
}

function handleError(error) {
  showToast(error.message || '發生錯誤');
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function money(value) {
  const amount = Number(value || 0);
  return amount ? `$${amount.toLocaleString('zh-TW')}` : '未填';
}

function statusText(status) {
  return statusLabels[status] || status || '未設定';
}

function supportStatusText(status) {
  return {
    open: '待處理',
    in_progress: '處理中',
    resolved: '已處理',
    closed: '已結束',
  }[status] || status || '未設定';
}

function supportTypeText(type) {
  return {
    general: '一般詢問',
    completion_dispute: '完工申訴',
    quote_dispute: '報價申訴',
    technician_no_show: '師傅未到場',
    service_quality: '施工品質',
    cancel_order: '取消爭議',
    customer_cancel: '客戶取消',
    technician_cancel: '師傅取消',
  }[type] || type || '未分類';
}

function nextStepText(order) {
  return {
    pending_review: '平台需要先審核案件資料',
    waiting_customer_info: '等待客戶補充資料',
    pending_dispatch: '請挑選合適師傅派單',
    dispatching: '派單中，等待師傅回應',
    assigned: '師傅已接單，等待報價',
    quoted: '等待客戶確認報價',
    in_progress: '師傅施工中，注意現場更新',
    arrived: '師傅已到場，可留意完工回報',
    completed_pending_customer: '等待客戶確認完工',
    closed: '案件已結案，可追蹤評價',
    customer_cancelled: '客戶已取消，確認後續處理',
    technician_cancelled: '師傅已取消，視情況重新派單',
    platform_cancelled: '平台已取消案件',
    platform_review: '平台審核中，等待內部決定',
    dispute_review: '案件正在申訴處理中',
  }[order?.status] || '請查看案件狀態後再決定下一步';
}

function progressStepIndex(order) {
  const status = order?.status;
  switch (status) {
    case 'pending_review':
    case 'waiting_customer_info':
      return 0;
    case 'pending_dispatch':
    case 'dispatching':
    case 'assigned':
    case 'quoted':
      return 1;
    case 'in_progress':
    case 'arrived':
      return 2;
    case 'completed_pending_customer':
    case 'platform_review':
    case 'dispute_review':
      return 3;
    case 'closed':
    case 'customer_cancelled':
    case 'technician_cancelled':
    case 'platform_cancelled':
      return 4;
    default:
      return 0;
  }
}

function progressStepTimes(order) {
  const logs = Array.isArray(order?.logs) ? order.logs : [];
  const statusToStep = {
    pending_review: 0,
    waiting_customer_info: 0,
    pending_dispatch: 1,
    dispatching: 1,
    assigned: 1,
    quoted: 1,
    in_progress: 2,
    arrived: 2,
    completed_pending_customer: 3,
    platform_review: 3,
    dispute_review: 3,
    closed: 4,
    customer_cancelled: 4,
    technician_cancelled: 4,
    platform_cancelled: 4,
  };

  const times = ['', '', '', '', ''];
  logs.forEach((log) => {
    const index = statusToStep[log.status];
    if (index === undefined || times[index]) return;
    times[index] = formatDate(log.created_at);
  });

  if (!times[0] && order?.created_at) {
    times[0] = formatDate(order.created_at);
  }

  if (
    !times[4] &&
    ['closed', 'customer_cancelled', 'technician_cancelled', 'platform_cancelled'].includes(order?.status) &&
    order?.updated_at
  ) {
    times[4] = formatDate(order.updated_at);
  }

  return times;
}

function renderProgress(order) {
  if (!order) {
    return '<p class="empty compact-empty">請先選一張案件查看進度</p>';
  }

  const currentIndex = progressStepIndex(order);
  const stepTimes = progressStepTimes(order);
  const steps = [
    { label: '待審核', fallback: '平台接收案件' },
    { label: '已派案', fallback: '媒合與指派師傅' },
    { label: '處理中', fallback: '師傅到場施工' },
    { label: '結案審批', fallback: '等待確認或申訴' },
    { label: '已結案', fallback: '案件流程完成' },
  ];

  return `
    <div class="progress-track">
      ${steps
        .map((step, index) => {
          const stateClass =
            index < currentIndex
              ? 'progress-step--done'
              : index === currentIndex
                ? 'progress-step--current'
                : 'progress-step--upcoming';
          const marker = index < currentIndex ? '✓' : index === currentIndex ? '•' : '';
          return `
            <div class="progress-step ${stateClass}">
              ${index > 0 ? `<span class="progress-step__connector ${index <= currentIndex ? 'is-active' : ''}"></span>` : ''}
              <span class="progress-step__dot">${marker}</span>
              <div class="progress-step__content">
                <strong>${step.label}</strong>
                <span>${stepTimes[index] || step.fallback}</span>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function normalizeListInput(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function activateAdminView(view) {
  els.sideNavItems.forEach((item) => {
    item.classList.toggle('side-nav__item--active', item.dataset.navView === view);
  });

  els.viewPanels.forEach((panel) => {
    panel.classList.toggle('view-panel--active', panel.dataset.viewPanel === view);
  });

  if (view === 'cases') {
    setCaseStage(state.selectedOrder ? 'detail' : 'list');
  }

  if (view === 'customers' && !state.customers.length) loadCustomers().catch(handleError);
  if (view === 'technicians' && !state.technicians.length) loadTechnicians().catch(handleError);
  if (view === 'disputes' && !state.supportTickets.length) loadSupportTickets().catch(handleError);
}

function setCaseStage(stage) {
  const isDetail = stage === 'detail';
  els.casesListStage?.classList.toggle('case-stage--active', !isDetail);
  els.casesDetailStage?.classList.toggle('case-stage--active', isDetail);
}

function updateCaseSummaryCards() {
  const activeCount = state.orders.filter((order) =>
    ['pending_review', 'pending_dispatch', 'dispatching', 'assigned', 'quoted', 'in_progress', 'arrived', 'platform_review', 'dispute_review'].includes(order.status)
  ).length;

  if (els.statusText) els.statusText.textContent = `${state.orders.length} 件`;
  if (els.statusTextDashboard) els.statusTextDashboard.textContent = `${state.orders.length} 件`;
  if (els.casesWaitingValue) els.casesWaitingValue.textContent = `${activeCount} 件`;
  if (els.customerStatusMirror) els.customerStatusMirror.textContent = `${state.customers.length} 位`;
  if (els.technicianStatusMirror) els.technicianStatusMirror.textContent = `${state.technicians.length} 位`;
}

function can(order, action) {
  if (!order) return false;
  const status = order.status;
  if (action === 'approve') return status === 'pending_review';
  if (action === 'dispatch') return ['pending_dispatch', 'dispatching'].includes(status);
  if (action === 'accept-quote') return ['quoted', 'platform_review'].includes(status);
  if (action === 'cancel') {
    return !['closed', 'customer_cancelled', 'technician_cancelled', 'platform_cancelled'].includes(status);
  }
  return false;
}

async function loadOrders() {
  const params = new URLSearchParams();
  if (els.statusFilter?.value) params.set('status', els.statusFilter.value);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  if (els.statusText) els.statusText.textContent = '載入中';
  const result = await api(`/api/orders${suffix}`);
  state.orders = result.data || [];
  updateCaseSummaryCards();
  renderOrders();
}

function renderOrders() {
  if (!els.ordersTable) return;
  if (!state.orders.length) {
    els.ordersTable.innerHTML = '<tr><td colspan="8" class="empty">目前沒有案件</td></tr>';
    return;
  }

  els.ordersTable.innerHTML = state.orders
    .map((order) => {
      const selected = String(order.id) === String(state.selectedOrderId);
      return `
        <tr data-order-id="${order.id}" class="${selected ? 'selected' : ''}">
          <td><strong>${escapeHtml(order.order_no || '')}</strong></td>
          <td><span class="status-pill">${escapeHtml(statusText(order.status))}</span></td>
          <td>${escapeHtml(order.area || '')}</td>
          <td>${escapeHtml(order.service_type || '')}</td>
          <td>${escapeHtml(order.preferred_time_text || '未填')}</td>
          <td>${escapeHtml(order.technician_id ? `#${order.technician_id}` : '未指派')}</td>
          <td>${escapeHtml(nextStepText(order))}</td>
          <td>${escapeHtml(formatDate(order.created_at))}</td>
        </tr>
      `;
    })
    .join('');
}

async function loadDispatchCandidates(orderId) {
  const result = await api(`/api/orders/${orderId}/dispatch-candidates`);
  state.dispatchCandidates = result.data || [];
}

async function selectOrder(orderId) {
  state.selectedSupportTicketId = null;
  state.selectedSupportTicket = null;
  state.selectedOrderId = orderId;

  const result = await api(`/api/orders/${orderId}`);
  state.selectedOrder = result.data || null;
  if (state.selectedOrder && can(state.selectedOrder, 'dispatch')) {
    await loadDispatchCandidates(orderId).catch(() => {
      state.dispatchCandidates = [];
    });
  } else {
    state.dispatchCandidates = [];
  }

  renderOrders();
  renderDetail();
  renderActions();
  renderConversationPanel();
  setCaseStage('detail');
  activateAdminView('cases');
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

  return cards.length ? cards.join('') : '<p class="empty compact-empty">目前沒有補充說明</p>';
}

function renderTimeline(order) {
  const logs = Array.isArray(order.logs) ? [...order.logs] : [];
  if (!logs.length) return '<p class="empty compact-empty">目前沒有案件軌跡</p>';

  return `
    <ul class="timeline">
      ${logs
        .slice()
        .reverse()
        .map(
          (log) => `
            <li>
              <strong>${escapeHtml(statusText(log.to_status) || log.action || '狀態更新')}</strong>
              <span>${escapeHtml(log.note || '系統更新')}</span>
              <time>${escapeHtml(formatDate(log.created_at))}</time>
            </li>
          `
        )
        .join('')}
    </ul>
  `;
}

function renderAdminNotes(order) {
  const notes = (order.messages || []).filter((message) => message.message_type === 'admin_note');
  if (!notes.length) return '<p class="empty compact-empty">目前沒有內部備註</p>';

  return `
    <div class="note-list">
      ${notes
        .slice()
        .reverse()
        .map(
          (note) => `
            <article>
              <time>${escapeHtml(formatDate(note.created_at))}</time>
              <p>${escapeHtml(note.content || '')}</p>
            </article>
          `
        )
        .join('')}
    </div>
  `;
}

function renderDetail() {
  const order = state.selectedOrder;

  if (!order) {
    if (els.selectedOrderHeadline) els.selectedOrderHeadline.textContent = '請先選一張案件';
    if (els.detailHint) els.detailHint.textContent = '案件概要';
    if (els.caseDetailStatusPill) els.caseDetailStatusPill.textContent = '未選擇';
    if (els.caseDetailNextStep) els.caseDetailNextStep.textContent = '請先回到案件列表點選案件';
    if (els.orderProgress) els.orderProgress.innerHTML = '<p class="empty compact-empty">請先選一張案件查看進度</p>';
    if (els.orderDetail) els.orderDetail.innerHTML = '<div class="empty">請先從案件列表點進一張案件</div>';
    if (els.orderReasons) els.orderReasons.innerHTML = '<p class="empty compact-empty">尚未選擇案件</p>';
    if (els.orderTimeline) els.orderTimeline.innerHTML = '<p class="empty compact-empty">尚未選擇案件</p>';
    if (els.adminNotes) els.adminNotes.innerHTML = '<p class="empty compact-empty">尚未選擇案件</p>';
    return;
  }

  const technicianReview = [...(order.messages || [])]
    .reverse()
    .find((message) => message.message_type === 'technician_review');

  if (els.selectedOrderHeadline) {
    els.selectedOrderHeadline.textContent = `${order.order_no || '案件'} 詳細與操作區`;
  }
  if (els.detailHint) {
    els.detailHint.textContent = order.order_no || '案件概要';
  }
  if (els.caseDetailStatusPill) {
    els.caseDetailStatusPill.textContent = statusText(order.status);
  }
  if (els.caseDetailNextStep) {
    els.caseDetailNextStep.textContent = nextStepText(order);
  }
  if (els.orderProgress) {
    els.orderProgress.innerHTML = renderProgress(order);
  }

  const rows = [
    ['案件狀態', statusText(order.status)],
    ['下一步', nextStepText(order)],
    ['服務類型', order.service_type],
    ['服務模式', order.service_mode === 'scheduled' ? '預約案件' : '立即案件'],
    ['預約時間', order.preferred_time_text || '未填'],
    ['區域', order.area],
    ['地址', order.address],
    ['問題描述', order.issue_description],
    ['客戶姓名', order.contact_name],
    ['客戶電話', order.contact_phone],
    ['客戶 ID', order.customer_id],
    ['師傅 ID', order.technician_id || '未指派'],
    ['原始報價', money(order.quote_amount)],
    ['追加報價', money(order.change_request_amount)],
    ['最終金額', money(order.paid_amount || order.final_amount)],
    ['客戶評分', order.rating ? `${order.rating} / 5` : '未填'],
    ['客戶評論', order.customer_comment || ''],
    ['師傅評論', technicianReview?.content || ''],
  ];

  const images = order.images || [];
  const imageGallery = images.length
    ? `
      <dt>案件照片</dt>
      <dd>
        <div class="image-grid">
          ${images
            .map((image) => {
              const url = image.image_url || '';
              return /^https?:\/\//.test(url)
                ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(url)}" alt="案件照片"></a>`
                : `<span class="image-token">${escapeHtml(url)}</span>`;
            })
            .join('')}
        </div>
      </dd>
    `
    : '<dt>案件照片</dt><dd>沒有上傳照片</dd>';

  if (els.orderDetail) {
    els.orderDetail.innerHTML =
      rows
        .map(
          ([label, value]) => `
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value || '未填')}</dd>
          `
        )
        .join('') + imageGallery;
  }

  if (els.orderReasons) els.orderReasons.innerHTML = renderReasonCards(order);
  if (els.orderTimeline) els.orderTimeline.innerHTML = renderTimeline(order);
  if (els.adminNotes) els.adminNotes.innerHTML = renderAdminNotes(order);
}

function conversationEntriesForOrder(order) {
  const orderMessages = (order.messages || []).map((message) => ({
    id: `msg-${message.id}`,
    created_at: message.created_at,
    sender_role: message.sender_role || 'system',
    content: message.content || '',
    message_type: message.message_type || 'text',
  }));

  const supportMessages = (order.support_tickets || []).flatMap((ticket) => {
    const entries = [
      {
        id: `ticket-${ticket.id}`,
        created_at: ticket.created_at,
        sender_role: 'customer',
        content: ticket.message || '',
        message_type: 'support_ticket',
      },
    ];

    if (ticket.admin_reply) {
      entries.push({
        id: `ticket-reply-${ticket.id}`,
        created_at: ticket.admin_replied_at || ticket.updated_at || ticket.created_at,
        sender_role: 'admin',
        content: ticket.admin_reply,
        message_type: 'support_reply',
      });
    }

    return entries;
  });

  return [...orderMessages, ...supportMessages]
    .filter((entry) => entry.content)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function chatTagText(type) {
  return {
    text: '一般訊息',
    admin_note: '內部備註',
    technician_review: '師傅評論',
    support_ticket: '客服單',
    support_reply: '平台回覆',
  }[type] || '訊息';
}

function isConversationEntryUnread(order, entry) {
  const seenAt = state.seenConversationByOrder[String(order.id)];
  if (!seenAt) return true;
  return new Date(entry.created_at).getTime() > new Date(seenAt).getTime();
}

function markConversationSeen(order) {
  const entries = conversationEntriesForOrder(order);
  const latest = entries.at(-1);
  if (!latest) return;
  state.seenConversationByOrder[String(order.id)] = latest.created_at;
  saveSeenConversationState();
}

function renderCustomerConversation(order) {
  const entries = conversationEntriesForOrder(order);
  if (!entries.length) return '<p class="empty compact-empty">目前沒有對話紀錄</p>';

  return `
    <div class="chat-thread">
      ${entries
        .map((entry) => {
          const role = entry.sender_role === 'admin' ? 'admin' : 'customer';
          const unread = isConversationEntryUnread(order, entry) ? ' is-unread' : '';
          return `
            <article class="chat-row is-${role}${unread}">
              <div class="chat-meta">
                <span>${escapeHtml(role === 'admin' ? '平台管理員' : '客戶')}</span>
                <time>${escapeHtml(formatDate(entry.created_at))}</time>
              </div>
              <div class="chat-bubble">
                <span class="chat-tag">${escapeHtml(chatTagText(entry.message_type))}</span>
                <p>${escapeHtml(entry.content)}</p>
                ${unread ? '<span class="chat-unread">未讀</span>' : ''}
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function scrollConversationToLatest() {
  if (!els.customerReplies) return;
  els.customerReplies.scrollTop = els.customerReplies.scrollHeight;
}

function renderConversationPanel() {
  if (state.selectedOrder) {
    els.customerReplies.innerHTML = renderCustomerConversation(state.selectedOrder);
    scrollConversationToLatest();
    markConversationSeen(state.selectedOrder);
    return;
  }

  if (state.selectedSupportTicket) {
    const ticket = state.selectedSupportTicket;
    els.customerReplies.innerHTML = `
      <div class="chat-thread">
        <article class="chat-row is-customer">
          <div class="chat-meta">
            <span>客戶</span>
            <time>${escapeHtml(formatDate(ticket.created_at))}</time>
          </div>
          <div class="chat-bubble">
            <span class="chat-tag">申訴內容</span>
            <p>${escapeHtml(ticket.message || '')}</p>
          </div>
        </article>
        ${
          ticket.admin_reply
            ? `
              <article class="chat-row is-admin">
                <div class="chat-meta">
                  <span>平台管理員</span>
                  <time>${escapeHtml(formatDate(ticket.admin_replied_at || ticket.updated_at))}</time>
                </div>
                <div class="chat-bubble">
                  <span class="chat-tag">平台回覆</span>
                  <p>${escapeHtml(ticket.admin_reply)}</p>
                </div>
              </article>
            `
            : ''
        }
      </div>
    `;
    return;
  }

  els.customerReplies.innerHTML = '<p class="empty compact-empty">請先選擇案件或申訴單</p>';
}

function renderDispatchCandidates() {
  if (!state.dispatchCandidates.length) {
    return '<div class="candidate-list"><h3>推薦師傅</h3><p class="empty compact-empty">目前沒有推薦名單</p></div>';
  }

  return `
    <div class="candidate-list">
      <h3>推薦師傅</h3>
      ${state.dispatchCandidates
        .slice(0, 8)
        .map((candidate) => {
          const reasons = [...(candidate.reasons || []), ...(candidate.warnings || [])].filter(Boolean);
          return `
            <article class="candidate-item ${candidate.eligible ? '' : 'blocked'}">
              <div>
                <strong>${escapeHtml(candidate.name || `師傅 ${candidate.technician_id}`)}</strong>
                <span>分數 ${candidate.score} / 今日 ${candidate.stats.today_assigned_count}/${candidate.stats.daily_job_limit}</span>
                <small>${escapeHtml(reasons.join('、') || '條件符合，可以優先派單')}</small>
              </div>
              <button type="button" data-dispatch-candidate="${candidate.technician_id}" ${candidate.eligible ? '' : 'disabled'}>派給這位</button>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderActions() {
  const order = state.selectedOrder;
  if (!order) {
    els.actions.innerHTML = '<p class="empty">選擇案件後才會顯示可操作項目</p>';
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
      <h3>新增內部備註</h3>
      <label>給平台內部看的備註
        <textarea name="note" maxlength="500" required placeholder="例如：客戶要求先電話通知、申訴處理需留意照片內容"></textarea>
      </label>
      <button type="submit">新增備註</button>
    </form>
  `);

  if (can(order, 'approve')) {
    blocks.push('<button type="button" data-action="approve">核准案件</button>');
  }

  if (can(order, 'dispatch')) {
    blocks.push(`
      <form class="quick-form" data-form="dispatch">
        <h3>手動派單</h3>
        <label>師傅 ID
          <input name="technician_ids" placeholder="8,9">
        </label>
        <button type="submit">送出派單</button>
      </form>
    `);
    blocks.push(renderDispatchCandidates());
  }

  if (can(order, 'accept-quote')) {
    blocks.push('<button type="button" data-action="accept-quote">代客戶確認報價</button>');
  }

  if (can(order, 'cancel')) {
    blocks.push('<button class="warn" type="button" data-action="cancel">平台取消案件</button>');
  }

  els.actions.innerHTML = blocks.join('');
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
      body: JSON.stringify({ action: 'approve', note: '平台核准案件' }),
    });
    showToast('案件已核准');
  }

  if (action === 'accept-quote') {
    await api(`/api/orders/${order.id}/customer-confirm-quote`, {
      method: 'POST',
      body: JSON.stringify({ accepted: true, customer_id: order.customer_id }),
    });
    showToast('已代客戶確認報價');
  }

  if (action === 'cancel') {
    const reason = window.prompt('請輸入平台取消原因', '平台判斷需取消此案件');
    if (reason === null) return;
    if (!reason.trim()) {
      showToast('請填寫取消原因');
      return;
    }
    await api(`/api/orders/${order.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        cancelled_by: 'platform',
        reason_code: 'admin_cancel',
        reason_text: reason.trim(),
      }),
    });
    showToast('案件已取消並通知客戶');
  }

  await refreshSelectedOrder();
}

async function handleActionForm(form) {
  const order = state.selectedOrder;
  if (!order) return;
  const formData = new FormData(form);
  const kind = form.dataset.form;

  if (kind === 'dispatch') {
    const technicianIds = normalizeListInput(formData.get('technician_ids'))
      .map(Number)
      .filter(Boolean);
    await api(`/api/orders/${order.id}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ technician_ids: technicianIds }),
    });
    showToast('派單已送出');
  }

  if (kind === 'admin-note') {
    await api(`/api/orders/${order.id}/admin-notes`, {
      method: 'POST',
      body: JSON.stringify({ note: formData.get('note') }),
    });
    showToast('內部備註已新增');
  }

  form.reset();
  await refreshSelectedOrder();
}

async function dispatchToCandidate(technicianId) {
  const order = state.selectedOrder;
  if (!order) return;
  await api(`/api/orders/${order.id}/dispatch`, {
    method: 'POST',
    body: JSON.stringify({ technician_ids: [Number(technicianId)] }),
  });
  showToast('已派給推薦師傅');
  await refreshSelectedOrder();
}

async function loadCustomers() {
  if (els.customerStatus) els.customerStatus.textContent = '載入中';
  const result = await api('/api/admin/customers');
  state.customers = result.data || [];
  if (els.customerStatus) els.customerStatus.textContent = `${state.customers.length} 位`;
  if (els.customerStatusDashboard) els.customerStatusDashboard.textContent = `${state.customers.length} 位`;
  if (els.customerStatusMirror) els.customerStatusMirror.textContent = `${state.customers.length} 位`;
  renderCustomers();
}

function customerName(customer) {
  return customer.name || customer.line_display_name || customer.line_user_id || `客戶 ${customer.id}`;
}

function renderCustomers() {
  if (!els.customerList) return;
  if (!state.customers.length) {
    els.customerList.innerHTML = '<p class="empty">目前沒有客戶資料</p>';
    return;
  }

  els.customerList.innerHTML = state.customers
    .map(
      (customer) => `
        <button class="customer-item" type="button" data-customer-id="${customer.id}">
          <span class="customer-row">
            ${customer.line_picture_url ? `<img src="${escapeHtml(customer.line_picture_url)}" alt="">` : '<b></b>'}
            <span>${escapeHtml(customerName(customer))}</span>
          </span>
          <small>${escapeHtml(customer.phone || '未填電話')} / ${customer.order_count || 0} 件 / ${customer.average_rating ? Number(customer.average_rating).toFixed(1) : '-'} 分</small>
        </button>
      `
    )
    .join('');
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
      <dt>姓名</dt><dd>${escapeHtml(customerName(customer))}</dd>
      <dt>電話</dt><dd>${escapeHtml(customer.phone || '')}</dd>
      <dt>地址</dt><dd>${escapeHtml(customer.default_address || '')}</dd>
      <dt>常用區域</dt><dd>${escapeHtml(customer.preferred_area || '')}</dd>
      <dt>LINE ID</dt><dd>${escapeHtml(customer.line_user_id || '')}</dd>
      <dt>總案件數</dt><dd>${customer.order_count || 0} 件</dd>
      <dt>已結案件</dt><dd>${customer.closed_order_count || 0} 件</dd>
      <dt>取消案件</dt><dd>${customer.cancelled_order_count || 0} 件</dd>
      <dt>平均評分</dt><dd>${customer.average_rating ? Number(customer.average_rating).toFixed(1) : ''}</dd>
      <dt>累計金額</dt><dd>${money(customer.total_amount)}</dd>
    </dl>
    <h3>歷史案件</h3>
    <div class="mini-list">
      ${
        orders.length
          ? orders
              .map(
                (order) => `
                  <button type="button" data-order-id="${order.id}">
                    ${escapeHtml(order.order_no)} / ${escapeHtml(order.service_type)} / ${escapeHtml(statusText(order.status))}
                  </button>
                `
              )
              .join('')
          : '<p class="empty">目前沒有歷史案件</p>'
      }
    </div>
  `;
}

async function loadSupportTickets() {
  const params = new URLSearchParams();
  if (els.supportStatusFilter?.value) params.set('status', els.supportStatusFilter.value);
  if (els.supportTypeFilter?.value) params.set('type', els.supportTypeFilter.value);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  if (els.supportStatus) els.supportStatus.textContent = '載入中...';
  const result = await api(`/api/admin/support-tickets${suffix}`);
  state.supportTickets = result.data || [];
  const openCount = state.supportTickets.filter((ticket) => ticket.status === 'open').length;
  if (els.supportStatus) els.supportStatus.textContent = `${state.supportTickets.length} 筆，${openCount} 筆待處理`;
  if (els.supportStatusDashboard) els.supportStatusDashboard.textContent = `${state.supportTickets.length} 筆`;
  renderSupportTickets();
}

function supportCustomerName(ticket) {
  const customer = ticket.customer || {};
  return customer.name || customer.line_display_name || customer.line_user_id || `客戶 ${ticket.user_id || ''}`;
}

function selectSupportTicket(ticketId) {
  const ticket = state.supportTickets.find((item) => String(item.id) === String(ticketId));
  if (!ticket) return;
  state.selectedSupportTicketId = ticket.id;
  state.selectedSupportTicket = ticket;
  state.selectedOrderId = null;
  state.selectedOrder = null;
  renderSupportTickets();
  renderConversationPanel();
}

function renderSupportTickets() {
  if (!els.supportTicketList) return;
  if (!state.supportTickets.length) {
    els.supportTicketList.innerHTML = '<p class="empty compact-empty">目前沒有申訴單</p>';
    return;
  }

  els.supportTicketList.innerHTML = state.supportTickets
    .map((ticket) => {
      const order = ticket.order || {};
      const customer = supportCustomerName(ticket);
      return `
        <article class="support-ticket-item ${String(ticket.id) === String(state.selectedSupportTicketId) ? 'selected' : ''}" data-ticket-id="${ticket.id}" data-support-ticket="${ticket.id}">
          <strong>${escapeHtml(ticket.ticket_no)} / ${escapeHtml(supportTypeText(ticket.type))}</strong>
          <span>${escapeHtml(supportStatusText(ticket.status))} / ${escapeHtml(customer)}</span>
          <small>${escapeHtml(order.order_no || '未綁定案件')} / ${escapeHtml(formatDate(ticket.created_at))}</small>
          <p>${escapeHtml(ticket.message || '')}</p>
          <div class="support-ticket-actions">
            ${order.id ? `<button type="button" data-support-order="${order.id}">看訂單</button>` : ''}
            <button type="button" data-support-status="in_progress">處理中</button>
            <button type="button" data-support-status="resolved">已處理</button>
            <button type="button" class="secondary" data-support-status="closed">已結束</button>
          </div>
          <form class="support-reply-form">
            <textarea name="reply_message" maxlength="500" required placeholder="輸入回覆內容，送出後會回到客戶 LINE"></textarea>
            <button type="submit">回覆 LINE</button>
          </form>
        </article>
      `;
    })
    .join('');
}

async function updateSupportTicketStatus(ticketId, status) {
  await api(`/api/admin/support-tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  showToast('申訴狀態已更新');
  await loadSupportTickets();
}

async function replySupportTicket(ticketId, message) {
  await api(`/api/admin/support-tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify({ reply_message: message }),
  });
  showToast('已回覆客戶 LINE');
  await loadSupportTickets();
}

async function loadTechnicians() {
  if (els.technicianStatus) els.technicianStatus.textContent = '載入中';
  const result = await api('/api/technicians');
  state.technicians = result.data || [];
  if (els.technicianStatus) els.technicianStatus.textContent = `${state.technicians.length} 位`;
  if (els.technicianStatusDashboard) els.technicianStatusDashboard.textContent = `${state.technicians.length} 位`;
  if (els.technicianStatusMirror) els.technicianStatusMirror.textContent = `${state.technicians.length} 位`;
  renderTechnicians();
}

function renderTechnicians() {
  if (!els.technicianList) return;
  if (!state.technicians.length) {
    els.technicianList.innerHTML = '<p class="empty">目前沒有師傅資料</p>';
    return;
  }

  els.technicianList.innerHTML = state.technicians
    .map(
      (technician) => `
        <div class="technician-item">
          <div>
            <strong>${escapeHtml(technician.name || technician.line_user_id)}</strong>
            <span>ID ${escapeHtml(technician.id)} / ${technician.available ? '可接案' : '暫停接案'}</span>
            <span>${escapeHtml(technician.available_time_text || '未填可接時段')}</span>
          </div>
          <button type="button" data-copy-technician="${technician.id}">使用</button>
        </div>
      `
    )
    .join('');
}

async function createTechnician(formData) {
  await api('/api/technicians', {
    method: 'POST',
    body: JSON.stringify({
      line_user_id: formData.get('line_user_id'),
      name: formData.get('name'),
      phone: formData.get('phone'),
      available: true,
      service_areas: normalizeListInput(formData.get('service_areas')),
      service_types: normalizeListInput(formData.get('service_types')),
      available_time_text: formData.get('available_time_text'),
    }),
  });
}

async function broadcastMembers(formData) {
  const result = await api('/api/admin/broadcasts/members', {
    method: 'POST',
    body: JSON.stringify({
      title: formData.get('title'),
      message: formData.get('message'),
    }),
  });
  showToast(`已發送 ${result.data.sent_count}/${result.data.target_count} 位會員`);
}

function bindEvents() {
  if (els.adminKey) els.adminKey.value = state.adminKey;

  els.sideNavItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      activateAdminView(item.dataset.navView || 'cases');
    });
  });

  els.saveKeyButton?.addEventListener('click', () => {
    state.adminKey = els.adminKey.value.trim();
    localStorage.setItem('shiFuDiJiaAdminKey', state.adminKey);
    showToast('管理員金鑰已儲存');
    loadAll();
  });

  els.refreshButton?.addEventListener('click', () => loadOrders().catch(handleError));
  els.statusFilter?.addEventListener('change', () => loadOrders().catch(handleError));
  els.backToOrdersButton?.addEventListener('click', () => {
    state.selectedOrderId = null;
    state.selectedOrder = null;
    state.dispatchCandidates = [];
    renderOrders();
    renderDetail();
    renderActions();
    renderConversationPanel();
    setCaseStage('list');
  });

  els.ordersTable?.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-order-id]');
    if (row) selectOrder(row.dataset.orderId).catch(handleError);
  });

  els.actions?.addEventListener('click', (event) => {
    const candidateButton = event.target.closest('button[data-dispatch-candidate]');
    if (candidateButton) {
      dispatchToCandidate(candidateButton.dataset.dispatchCandidate).catch(handleError);
      return;
    }

    const button = event.target.closest('button[data-action]');
    if (button) runOrderAction(button.dataset.action).catch(handleError);
  });

  els.actions?.addEventListener('submit', (event) => {
    event.preventDefault();
    handleActionForm(event.target).catch(handleError);
  });

  els.loadCustomersButton?.addEventListener('click', () => loadCustomers().catch(handleError));
  els.customerList?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-customer-id]');
    if (button) selectCustomer(button.dataset.customerId).catch(handleError);
  });

  els.customerDetail?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-order-id]');
    if (button) selectOrder(button.dataset.orderId).catch(handleError);
  });

  els.memberBroadcastForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    await broadcastMembers(formData).catch(handleError);
    event.target.reset();
  });

  els.loadSupportButton?.addEventListener('click', () => loadSupportTickets().catch(handleError));
  els.supportStatusFilter?.addEventListener('change', () => loadSupportTickets().catch(handleError));
  els.supportTypeFilter?.addEventListener('change', () => loadSupportTickets().catch(handleError));
  els.supportTicketList?.addEventListener('click', (event) => {
    const orderButton = event.target.closest('button[data-support-order]');
    if (orderButton) {
      selectOrder(orderButton.dataset.supportOrder).catch(handleError);
      return;
    }

    const statusButton = event.target.closest('button[data-support-status]');
    const item = event.target.closest('[data-ticket-id]');
    if (statusButton && item) {
      updateSupportTicketStatus(item.dataset.ticketId, statusButton.dataset.supportStatus).catch(handleError);
      return;
    }

    const ticketCard = event.target.closest('[data-support-ticket]');
    if (ticketCard && !event.target.closest('textarea, button, form')) {
      selectSupportTicket(ticketCard.dataset.supportTicket);
    }
  });

  els.supportTicketList?.addEventListener('submit', (event) => {
    event.preventDefault();
    const item = event.target.closest('[data-ticket-id]');
    const formData = new FormData(event.target);
    const message = String(formData.get('reply_message') || '').trim();
    if (!item || !message) {
      showToast('請輸入回覆內容');
      return;
    }
    replySupportTicket(item.dataset.ticketId, message)
      .then(() => event.target.reset())
      .catch(handleError);
  });

  els.loadTechniciansButton?.addEventListener('click', () => loadTechnicians().catch(handleError));
  els.technicianList?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-copy-technician]');
    const input = document.querySelector('form[data-form="dispatch"] input[name="technician_ids"]');
    if (button && input) {
      input.value = button.dataset.copyTechnician;
      showToast('已帶入師傅 ID');
    }
  });

  els.createTechnicianForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    await createTechnician(formData).catch(handleError);
    event.target.reset();
    showToast('師傅資料已新增');
    await loadTechnicians().catch(handleError);
  });
}

function loadAll() {
  Promise.all([loadOrders(), loadTechnicians(), loadCustomers(), loadSupportTickets()]).catch(handleError);
}

bindEvents();
renderDetail();
renderActions();
renderConversationPanel();
loadAll();
activateAdminView(window.location.hash.replace('#', '') || 'cases');
