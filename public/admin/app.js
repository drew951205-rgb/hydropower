const state = {
  adminKey: localStorage.getItem('shiFuDiJiaAdminKey') || 'change-me',
  orders: [],
  technicians: [],
  selectedOrderId: null,
  selectedOrder: null
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
  actions: document.querySelector('#actions'),
  technicianStatus: document.querySelector('#technicianStatus'),
  technicianList: document.querySelector('#technicianList'),
  loadTechniciansButton: document.querySelector('#loadTechniciansButton'),
  createTechnicianForm: document.querySelector('#createTechnicianForm'),
  toast: document.querySelector('#toast')
};

const statusLabels = {
  pending_review: '待審核',
  waiting_customer_info: '待補資料',
  pending_dispatch: '待派單',
  dispatching: '派單中',
  assigned: '已接單',
  arrived: '已到場',
  quoted: '已報價',
  in_progress: '施工中',
  completed_pending_customer: '待顧客確認',
  closed: '已結案',
  customer_cancelled: '顧客取消',
  technician_cancelled: '師傅取消',
  platform_cancelled: '平台取消',
  platform_review: '平台介入',
  dispute_review: '爭議審核'
};

const changeRequestLabels = {
  pending: '待確認',
  approved: '已同意',
  rejected: '已拒絕'
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

function statusText(status) {
  return statusLabels[status] || status || '';
}

function changeRequestText(status) {
  return changeRequestLabels[status] || status || '';
}

function normalizeListInput(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function suggestedTotal(order) {
  return toNumber(order?.quote_amount) + toNumber(order?.change_request_amount);
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
  if (action === 'platform-review') return !['closed', 'customer_cancelled', 'technician_cancelled', 'platform_cancelled'].includes(status);
  if (action === 'dispatch') return ['pending_dispatch', 'dispatching'].includes(status);
  if (action === 'arrive') return status === 'assigned';
  if (action === 'quote') return status === 'arrived';
  if (action === 'accept-quote') return status === 'quoted';
  if (action === 'change-request') return status === 'in_progress';
  if (action === 'accept-change-request') return status === 'platform_review' && order.change_request_status === 'pending';
  if (action === 'complete') return status === 'in_progress';
  if (action === 'confirm-completion') return status === 'completed_pending_customer';
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
    els.ordersTable.innerHTML = '<tr><td colspan="6" class="empty">沒有訂單</td></tr>';
    return;
  }

  els.ordersTable.innerHTML = state.orders.map((order) => `
    <tr data-order-id="${order.id}" class="${String(order.id) === String(state.selectedOrderId) ? 'selected' : ''}">
      <td>${escapeHtml(order.order_no || order.id)}</td>
      <td><span class="status-pill">${statusText(order.status)}</span></td>
      <td>${escapeHtml(order.area || '')}</td>
      <td>${escapeHtml(order.service_type || '')}</td>
      <td>${escapeHtml(order.technician_id || '')}</td>
      <td>${formatDate(order.created_at)}</td>
    </tr>
  `).join('');
}

async function selectOrder(orderId) {
  state.selectedOrderId = orderId;
  const result = await api(`/api/orders/${orderId}`);
  state.selectedOrder = result.data;
  els.detailHint.textContent = state.selectedOrder.order_no;
  renderOrders();
  renderDetail();
  renderActions();
}

function renderDetail() {
  const order = state.selectedOrder;
  if (!order) {
    els.orderDetail.innerHTML = '';
    return;
  }

  const rows = [
    ['狀態', statusText(order.status)],
    ['訂單編號', order.order_no],
    ['服務類型', order.service_type],
    ['區域', order.area],
    ['地址', order.address],
    ['問題', order.issue_description],
    ['電話', order.contact_phone],
    ['客戶 ID', order.customer_id],
    ['師傅 ID', order.technician_id || ''],
    ['報價', order.quote_amount || ''],
    ['追加', order.change_request_amount || ''],
    ['追加狀態', changeRequestText(order.change_request_status)],
    ['預估總額', suggestedTotal(order) || ''],
    ['實收', order.paid_amount || order.final_amount || ''],
    ['紀錄', `${order.logs?.length || 0} 筆`]
  ];

  els.orderDetail.innerHTML = rows.map(([label, value]) => `
    <dt>${escapeHtml(label)}</dt>
    <dd>${escapeHtml(value)}</dd>
  `).join('');
}

function renderActions() {
  const order = state.selectedOrder;
  if (!order) {
    els.actions.innerHTML = '<p class="empty">選擇一筆訂單</p>';
    return;
  }

  const total = suggestedTotal(order);
  const finalAmount = order.final_amount || total || order.quote_amount || '';
  const paidAmount = order.paid_amount || order.final_amount || total || order.quote_amount || '';
  const blocks = [];

  if (can(order, 'approve')) {
    blocks.push(`
      <div class="action-row">
        <button type="button" data-action="approve">審核通過</button>
        <button type="button" data-action="platform-review" class="secondary">平台介入</button>
      </div>
    `);
  }

  if (can(order, 'dispatch')) {
    blocks.push(`
      <form class="quick-form" data-form="dispatch">
        <h3>派單</h3>
        <label>師傅 ID<input name="technician_ids" placeholder="8,9"></label>
        <button type="submit">送出派單</button>
      </form>
    `);
  }

  if (can(order, 'arrive')) {
    blocks.push('<button type="button" data-action="arrive">到場</button>');
  }

  if (can(order, 'quote')) {
    blocks.push(`
      <form class="quick-form" data-form="quote">
        <h3>報價</h3>
        <label>金額<input name="amount" type="number" min="1" placeholder="1500"></label>
        <label>備註<textarea name="note" placeholder="漏水檢測與管線處理"></textarea></label>
        <button type="submit">提交報價</button>
      </form>
    `);
  }

  if (can(order, 'accept-quote')) {
    blocks.push('<button type="button" data-action="accept-quote">顧客同意報價</button>');
  }

  if (can(order, 'change-request')) {
    blocks.push(`
      <form class="quick-form" data-form="change-request">
        <h3>追加報價</h3>
        <label>追加金額<input name="amount" type="number" min="1" placeholder="600"></label>
        <label>原因<textarea name="reason" placeholder="拆開後發現額外零件需要更換"></textarea></label>
        <button type="submit">提出追加</button>
      </form>
    `);
  }

  if (can(order, 'accept-change-request')) {
    blocks.push('<button type="button" data-action="accept-quote">顧客同意追加</button>');
  }

  if (can(order, 'complete')) {
    blocks.push(`
      <form class="quick-form" data-form="complete">
        <h3>完工</h3>
        <label>最終金額<input name="final_amount" type="number" min="0" value="${escapeHtml(finalAmount)}"></label>
        <label>完工摘要<textarea name="summary" placeholder="已完成施工，現場測試正常"></textarea></label>
        <button type="submit">完工回報</button>
      </form>
    `);
  }

  if (can(order, 'confirm-completion')) {
    blocks.push(`
      <form class="quick-form" data-form="confirm-completion">
        <h3>顧客確認</h3>
        <label>實付金額<input name="paid_amount" type="number" min="0" value="${escapeHtml(paidAmount)}"></label>
        <label>評分<input name="rating" type="number" min="1" max="5" value="${escapeHtml(order.rating || 5)}"></label>
        <label>評語<textarea name="comment" placeholder="處理很快，問題已解決"></textarea></label>
        <button type="submit">確認結案</button>
      </form>
    `);
  }

  if (!blocks.length) {
    blocks.push('<p class="empty">目前沒有可用操作</p>');
  }

  els.actions.innerHTML = blocks.join('');
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
        <span>ID ${escapeHtml(technician.id)} · ${technician.available ? '可接單' : '暫停接單'}</span>
      </div>
      <button type="button" data-copy-technician="${technician.id}">選用</button>
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
      body: JSON.stringify({ action: 'approve', note: '資料完整，進入派單' })
    });
    showToast('已通過審核');
  }

  if (action === 'platform-review') {
    await api(`/api/orders/${order.id}/platform-review`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'manual_review' })
    });
    showToast('已標記平台介入');
  }

  if (action === 'arrive') {
    await api(`/api/orders/${order.id}/arrive`, {
      method: 'POST',
      body: JSON.stringify({ technician_id: order.technician_id })
    });
    showToast('已記錄到場');
  }

  if (action === 'accept-quote') {
    await api(`/api/orders/${order.id}/customer-confirm-quote`, {
      method: 'POST',
      body: JSON.stringify({ accepted: true, customer_id: order.customer_id })
    });
    showToast(order.change_request_status === 'pending' ? '顧客已同意追加' : '顧客已同意報價');
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

  if (kind === 'quote') {
    await api(`/api/orders/${order.id}/quote`, {
      method: 'POST',
      body: JSON.stringify({
        technician_id: order.technician_id,
        amount: Number(formData.get('amount')),
        note: formData.get('note')
      })
    });
    showToast('已提交報價');
  }

  if (kind === 'change-request') {
    await api(`/api/orders/${order.id}/change-request`, {
      method: 'POST',
      body: JSON.stringify({
        technician_id: order.technician_id,
        amount: Number(formData.get('amount')),
        reason: formData.get('reason'),
        images: []
      })
    });
    showToast('已提出追加報價');
  }

  if (kind === 'complete') {
    await api(`/api/orders/${order.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        technician_id: order.technician_id,
        final_amount: Number(formData.get('final_amount')),
        summary: formData.get('summary'),
        images: []
      })
    });
    showToast('已回報完工');
  }

  if (kind === 'confirm-completion') {
    await api(`/api/orders/${order.id}/customer-confirm-completion`, {
      method: 'POST',
      body: JSON.stringify({
        confirmed: true,
        customer_id: order.customer_id,
        paid_amount: Number(formData.get('paid_amount')),
        rating: Number(formData.get('rating')),
        comment: formData.get('comment')
      })
    });
    showToast('已結案');
  }

  form.reset();
  await refreshSelectedOrder();
}

els.adminKey.value = state.adminKey;
els.saveKeyButton.addEventListener('click', () => {
  state.adminKey = els.adminKey.value.trim();
  localStorage.setItem('shiFuDiJiaAdminKey', state.adminKey);
  showToast('管理金鑰已套用');
  loadOrders().catch((error) => showToast(error.message));
});

els.refreshButton.addEventListener('click', () => loadOrders().catch((error) => showToast(error.message)));
els.statusFilter.addEventListener('change', () => loadOrders().catch((error) => showToast(error.message)));

els.ordersTable.addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-order-id]');
  if (row) selectOrder(row.dataset.orderId).catch((error) => showToast(error.message));
});

els.actions.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (button) runOrderAction(button.dataset.action).catch((error) => showToast(error.message));
});

els.actions.addEventListener('submit', (event) => {
  event.preventDefault();
  handleActionForm(event.target).catch((error) => showToast(error.message));
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
      service_types: normalizeListInput(formData.get('service_types'))
    })
  });
  event.target.reset();
  showToast('已建立師傅');
  await loadTechnicians();
});

Promise.all([loadOrders(), loadTechnicians()]).catch((error) => showToast(error.message));
