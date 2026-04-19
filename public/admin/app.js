const state = {
  adminKey: localStorage.getItem('shiFuDiJiaAdminKey') || 'change-me',
  orders: [],
  technicians: [],
  customers: [],
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
  customerStatus: document.querySelector('#customerStatus'),
  customerList: document.querySelector('#customerList'),
  customerDetail: document.querySelector('#customerDetail'),
  loadCustomersButton: document.querySelector('#loadCustomersButton'),
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

  const technicianReview = [...(order.messages || [])]
    .reverse()
    .find((message) => message.message_type === 'technician_review');

  const rows = [
    ['狀態', statusText(order.status)],
    ['下一步', nextStepText(order)],
    ['案件編號', order.order_no],
    ['服務類型', order.service_type],
    ['服務模式', order.service_mode === 'scheduled' ? '預約' : '急件'],
    ['時間需求', order.preferred_time_text || '越快越好'],
    ['區域', order.area],
    ['地址', order.address],
    ['問題', order.issue_description],
    ['電話', order.contact_phone],
    ['客戶 ID', order.customer_id],
    ['師傅 ID', order.technician_id || ''],
    ['報價', money(order.quote_amount)],
    ['追加', money(order.change_request_amount)],
    ['實收', money(order.paid_amount || order.final_amount)],
    ['客戶評分', order.rating ? `${order.rating} / 5` : ''],
    ['客戶評語', order.customer_comment || ''],
    ['師傅心得', technicianReview?.content || ''],
    ['紀錄', `${order.logs?.length || 0} 筆`]
  ];

  const images = order.images || [];
  const imageGallery = images.length
    ? `
      <dt>照片</dt>
      <dd>
        <div class="image-grid">
          ${images.map((image) => {
            const url = image.image_url || '';
            const isImageUrl = /^https?:\/\//.test(url);
            return isImageUrl
              ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(url)}" alt="案件照片"></a>`
              : `<span class="image-token">${escapeHtml(url)}</span>`;
          }).join('')}
        </div>
      </dd>
    `
    : '<dt>照片</dt><dd>未提供</dd>';

  els.orderDetail.innerHTML = rows.map(([label, value]) => `
    <dt>${escapeHtml(label)}</dt>
    <dd>${escapeHtml(value)}</dd>
  `).join('') + imageGallery;
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
  }

  if (can(order, 'accept-quote')) {
    blocks.push('<button type="button" data-action="accept-quote">客戶接受報價</button>');
  }

  if (can(order, 'cancel')) {
    blocks.push('<button class="warn" type="button" data-action="cancel">平台取消案件</button>');
  }

  els.actions.innerHTML = blocks.length ? blocks.join('') : '<p class="empty">目前沒有可用操作</p>';
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
    await api(`/api/orders/${order.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        cancelled_by: 'platform',
        reason_code: 'admin_cancel',
        reason_text: 'Admin cancelled from CRM'
      })
    });
    showToast('已取消案件');
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

  form.reset();
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
  Promise.all([loadOrders(), loadTechnicians(), loadCustomers()]).catch((error) => showToast(error.message));
}

loadAll();
