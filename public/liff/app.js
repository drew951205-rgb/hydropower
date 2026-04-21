const state = {
  profile: null,
  config: null,
};

function params() {
  return new URLSearchParams(window.location.search);
}

function pageName() {
  return document.body.dataset.page;
}

function shouldInitLiff() {
  const search = params();
  return (
    window.location.hostname === 'liff.line.me' ||
    search.has('liff.state') ||
    search.has('liff.referrer') ||
    search.has('access_token')
  );
}

function $(selector) {
  return document.querySelector(selector);
}

function setStatus(message, isError = false) {
  const node = $('#status');
  if (!node) return;
  node.textContent = message || '';
  node.className = `notice${isError ? ' error' : ''}`;
  node.hidden = !message;
}

function showSubmitDone(form, title, message, actions = []) {
  setStatus(message);
  let panel = form.nextElementSibling;
  if (!panel || !panel.classList.contains('submit-done')) {
    panel = document.createElement('section');
    panel.className = 'submit-done notice';
    form.insertAdjacentElement('afterend', panel);
  }
  panel.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(message)}</p>
    ${actions.length ? `
      <div class="actions">
        ${actions.map((action) => `<a href="${escapeHtml(action.href)}"><button type="button">${escapeHtml(action.label)}</button></a>`).join('')}
      </div>
    ` : ''}
  `;
  panel.hidden = false;
  form.hidden = true;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function lineUserId() {
  return (
    state.profile?.userId ||
    params().get('line_user_id') ||
    localStorage.getItem('line_user_id') ||
    ''
  );
}

function withLineUser(url) {
  const next = new URL(url, window.location.origin);
  if (lineUserId()) next.searchParams.set('line_user_id', lineUserId());
  return next.toString();
}

function liffPath(path) {
  const next = new URL(path, window.location.origin);
  if (lineUserId()) next.searchParams.set('line_user_id', lineUserId());
  return `${next.pathname}${next.search}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  const response = await fetch(path, {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || '操作失敗，請稍後再試');
  }
  return payload.data;
}

async function initLineProfile() {
  const config = await api('/api/liff/config');
  state.config = config;

  if (window.liff && config.liffId && shouldInitLiff()) {
    try {
      await window.liff.init({ liffId: config.liffId });
      if (!window.liff.isLoggedIn()) {
        window.liff.login({ redirectUri: window.location.href });
        return;
      }
      state.profile = await window.liff.getProfile();
    } catch (error) {
      console.error('[liff:init:error]', error);
      setStatus(`LIFF 載入失敗：${error.message || '請確認 LIFF ID 與 Endpoint URL 是否一致'}`, true);
    }
  } else if (window.liff && config.liffId) {
    console.info('[liff:init:skipped]', {
      reason: 'opened outside LIFF launch context',
      href: window.location.href,
    });
  }

  if (lineUserId()) localStorage.setItem('line_user_id', lineUserId());
  const lineInput = $('#line_user_id');
  if (lineInput) lineInput.value = lineUserId();
}

function requireLineUser() {
  if (lineUserId()) return true;
  setStatus('請從 LINE 內開啟此頁，或在網址加上 line_user_id 測試。', true);
  return false;
}

function formDataWithProfile(form) {
  const data = new FormData(form);
  data.set('line_user_id', lineUserId());
  if (state.profile?.displayName) data.set('line_display_name', state.profile.displayName);
  if (state.profile?.pictureUrl) data.set('line_picture_url', state.profile.pictureUrl);
  if (state.profile?.language) data.set('line_language', state.profile.language);
  return data;
}

function jsonWithLineUser(payload = {}) {
  return JSON.stringify({
    ...payload,
    line_user_id: lineUserId(),
  });
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('zh-TW')} 元`;
}

function orderSummary(order) {
  return [
    `<strong>${order.order_no}</strong>`,
    `狀態：${order.status}`,
    `服務：${order.service_type || '未填'}`,
    `地區：${order.area || '未填'}`,
    `時間：${order.preferred_time_text || '未填'}`,
    order.address ? `地址：${order.address}` : '',
    order.issue_description ? `問題：${order.issue_description}` : '',
  ].filter(Boolean).join('<br>');
}

function statusText(status) {
  return {
    pending_review: '等待平台審核',
    waiting_customer_info: '等待補充資料',
    pending_dispatch: '等待派單',
    dispatching: '尋找師傅中',
    assigned: '師傅已接單',
    quoted: '等待確認報價',
    in_progress: '師傅準備前往',
    arrived: '師傅已到場',
    completed_pending_customer: '等待確認結案',
    closed: '已結案',
    customer_cancelled: '客戶已取消',
    technician_cancelled: '師傅已取消',
    platform_cancelled: '平台已取消',
    platform_review: '平台處理中',
    dispute_review: '申訴處理中',
  }[status] || status || '未知狀態';
}

function customerCaseActions(order) {
  const actions = [];
  if (
    order.status === 'quoted' ||
    (order.status === 'platform_review' && order.change_request_status === 'pending')
  ) {
    actions.push({
      label: '查看報價',
      href: liffPath(`/liff/confirm?order_id=${order.id}&mode=${order.change_request_status === 'pending' ? 'change' : 'quote'}`),
    });
  }
  if (order.status === 'completed_pending_customer') {
    actions.push({
      label: '確認結案',
      href: liffPath(`/liff/confirm?order_id=${order.id}&mode=completion`),
    });
  }
  if (!['closed', 'customer_cancelled', 'technician_cancelled', 'platform_cancelled'].includes(order.status)) {
    actions.push({
      label: '取消案件',
      href: liffPath(`/liff/cancel?order_id=${order.id}`),
      secondary: true,
    });
  }
  actions.push({
    label: '聯絡客服',
    href: liffPath(`/liff/support?order_id=${order.id}`),
    secondary: true,
  });
  return actions;
}

function technicianCaseActions(order) {
  const actions = [];
  if (order.status === 'assigned') {
    actions.push({ label: '報價', href: liffPath(`/liff/quote?order_id=${order.id}`) });
  }
  if (['in_progress', 'arrived', 'platform_review'].includes(order.status)) {
    actions.push({ label: '追加報價', href: liffPath(`/liff/change-request?order_id=${order.id}`) });
  }
  if (!['closed', 'customer_cancelled', 'technician_cancelled', 'platform_cancelled'].includes(order.status)) {
    actions.push({
      label: '取消案件',
      href: liffPath(`/liff/cancel?order_id=${order.id}&role=technician`),
      secondary: true,
    });
  }
  return actions;
}

function renderCaseCard(order, role) {
  const actions = role === 'technician'
    ? technicianCaseActions(order)
    : customerCaseActions(order);
  return `
    <article class="case-card">
      <div class="case-head">
        <h2>${escapeHtml(order.order_no || '')}</h2>
        <span>${escapeHtml(statusText(order.status))}</span>
      </div>
      <p>${orderSummary(order)}</p>
      ${actions.length ? `
        <div class="actions">
          ${actions.slice(0, 4).map((action) => `
            <a href="${escapeHtml(action.href)}">
              <button type="button" class="${action.secondary ? 'secondary' : ''}">${escapeHtml(action.label)}</button>
            </a>
          `).join('')}
        </div>
      ` : ''}
    </article>
  `;
}

function supportOrderContextHtml(order) {
  return `
    <div class="linked-order">
      <p class="eyebrow">\u95dc\u806f\u5831\u4fee\u55ae</p>
      <h2>${escapeHtml(order.order_no || '')}</h2>
      <dl class="summary-list">
        <dt>\u6848\u4ef6\u72c0\u614b</dt><dd>${escapeHtml(order.status || '')}</dd>
        <dt>\u670d\u52d9\u985e\u578b</dt><dd>${escapeHtml(order.service_type || '')}</dd>
        <dt>\u9810\u7d04\u6642\u9593</dt><dd>${escapeHtml(order.preferred_time_text || '')}</dd>
        <dt>\u5831\u4fee\u5730\u5740</dt><dd>${escapeHtml(order.address || '')}</dd>
      </dl>
      <p class="muted">\u9019\u5c01\u5ba2\u670d\u7533\u8acb\u6703\u7d81\u5b9a\u5230\u4e0a\u65b9\u5831\u4fee\u55ae\uff0c\u5e73\u53f0\u8655\u7406\u6642\u6703\u4e00\u8d77\u67e5\u770b\u6848\u4ef6\u7d00\u9304\u3002</p>
    </div>
  `;
}

function renderPhotos(images = []) {
  const node = $('#photos');
  if (!node) return;
  if (!images.length) {
    node.innerHTML = `
      <div class="photo-head">
        <strong>案件照片</strong>
        <span>尚未提供</span>
      </div>
      <p class="muted">目前沒有照片，請依文字描述評估。</p>
    `;
    return;
  }
  const items = images.map((item) => {
    const url = item.image_url || '';
    if (/^https?:\/\//.test(url)) {
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(url)}" alt="案件照片"></a>`;
    }
    return `<span class="photo-token">${escapeHtml(url)}</span>`;
  }).join('');

  node.innerHTML = `
    <div class="photo-head">
      <strong>案件照片</strong>
      <span>${images.length} 張</span>
    </div>
    ${items}
  `;
}

function showReviewThanks(actionsNode) {
  setStatus('謝謝你的評價，平台已收到。感謝你使用師傅抵嘉，期待下次繼續為你服務。');
  if (!actionsNode) return;
  actionsNode.innerHTML = `
    <div class="actions">
      <a href="${liffPath('/liff/repair')}"><button type="button">再次報修</button></a>
    </div>
  `;
}

function handledCard(message) {
  return `
    <div class="notice">
      ${escapeHtml(message)}
    </div>
    <div class="actions">
      <a href="${liffPath('/liff/repair')}"><button type="button">再次報修</button></a>
    </div>
  `;
}

function canUseQuoteConfirm(order) {
  return (
    order.status === 'quoted' ||
    (order.status === 'platform_review' && order.change_request_status === 'pending')
  );
}

async function loadOrder() {
  const orderId = params().get('order_id');
  if (!orderId) throw new Error('缺少案件 ID');
  return api(withLineUser(`/api/liff/orders/${orderId}`));
}

async function prefillRepairProfile(form) {
  if (!lineUserId()) return;
  try {
    const profile = await api(withLineUser('/api/liff/customer-profile'));
    if (!profile) return;

    const phone = form.querySelector('[name="contact_phone"]');
    const address = form.querySelector('[name="address"]');
    const contactName = form.querySelector('[name="contact_name"]');
    if (contactName && (profile.name || profile.line_display_name) && !contactName.value) {
      contactName.value = profile.name || profile.line_display_name;
    }
    if (phone && profile.phone && !phone.value) phone.value = profile.phone;
    if (address && profile.default_address && !address.value) {
      address.value = profile.default_address;
    }
  } catch (error) {
    console.warn('[repair:profile-prefill:skip]', error);
  }
}

async function prefillPhone(form) {
  if (!lineUserId()) return;
  try {
    const profile = await api(withLineUser('/api/liff/customer-profile'));
    const phone = form.querySelector('[name="phone"]');
    if (phone && profile?.phone && !phone.value) phone.value = profile.phone;
  } catch (error) {
    console.warn('[profile:phone-prefill:skip]', error);
  }
}

function isActiveCustomerOrder(order) {
  return [
    'pending_review',
    'waiting_customer_info',
    'pending_dispatch',
    'dispatching',
    'assigned',
    'quoted',
    'in_progress',
    'arrived',
    'completed_pending_customer',
    'platform_review',
    'dispute_review',
  ].includes(order?.status);
}

async function findLatestCustomerActiveOrder() {
  if (!lineUserId()) return null;
  try {
    const orders = await api(withLineUser('/api/liff/customer/orders'));
    return (orders || []).find((order) => isActiveCustomerOrder(order)) || null;
  } catch (error) {
    console.warn('[support:latest-order:skip]', error);
    return null;
  }
}

async function setupRepair() {
  const form = $('#repair-form');
  await prefillRepairProfile(form);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireLineUser()) return;
    const button = form.querySelector('button');
    button.disabled = true;
    setStatus('正在送出報修...');
    try {
      const order = await api('/api/liff/repair', {
        method: 'POST',
        body: formDataWithProfile(form),
      });
      form.reset();
      showSubmitDone(
        form,
        '\u5831\u4fee\u5df2\u9001\u51fa',
        '\u5df2\u5efa\u7acb\u6848\u4ef6 ' + order.order_no + '\uff0c\u5e73\u53f0\u6703\u5148\u5be9\u6838\u8cc7\u6599\uff0c\u5be9\u6838\u901a\u904e\u5f8c\u6703\u99ac\u4e0a\u5e6b\u4f60\u627e\u9644\u8fd1\u7684\u5e2b\u5085\u3002',
        [{ label: '\u67e5\u770b\u6211\u7684\u6848\u4ef6', href: liffPath('/liff/my-cases') }]
      );
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

async function setupQuote() {
  const order = await loadOrder();
  $('#order-panel').innerHTML = orderSummary(order);
  renderPhotos(order.images || []);

  const form = $('#quote-form');
  form.addEventListener('input', () => {
    const basic = Number(form.basic_fee.value || 0);
    const material = Number(form.material_fee.value || 0);
    const labor = Number(form.labor_fee.value || 0);
    $('#quote-total').textContent = formatMoney(basic + material + labor);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireLineUser()) return;
    setStatus('正在送出報價...');
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      await api(`/api/liff/orders/${order.id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonWithLineUser(data),
      });
      showSubmitDone(form, '\u5831\u50f9\u5df2\u9001\u51fa', '\u5df2\u901a\u77e5\u9867\u5ba2\u78ba\u8a8d\u5831\u50f9\uff0c\u9867\u5ba2\u540c\u610f\u5f8c\u4f60\u6703\u6536\u5230\u4e0b\u4e00\u6b65\u901a\u77e5\u3002');
    } catch (error) {
      setStatus(error.message, true);
    }
  });
}

async function setupChangeRequest() {
  const order = await loadOrder();
  $('#order-panel').innerHTML = orderSummary(order);
  renderPhotos(order.images || []);

  const form = $('#change-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireLineUser()) return;
    setStatus('正在送出追加報價...');
    try {
      await api(`/api/liff/orders/${order.id}/change-request`, {
        method: 'POST',
        body: formDataWithProfile(form),
      });
      showSubmitDone(form, '\u8ffd\u52a0\u5831\u50f9\u5df2\u9001\u51fa', '\u5df2\u901a\u77e5\u9867\u5ba2\u78ba\u8a8d\u8ffd\u52a0\u5831\u50f9\uff0c\u9867\u5ba2\u540c\u610f\u5f8c\u4f60\u6703\u6536\u5230\u5b8c\u5de5\u56de\u5831\u6307\u5f15\u3002');
    } catch (error) {
      setStatus(error.message, true);
    }
  });
}

async function setupSupport() {
  const form = $('#support-form');
  let orderId = params().get('order_id') || '';
  const type = params().get('type') || 'general';
  form.type.value = type;
  await prefillPhone(form);

  if (!orderId) {
    const latestOrder = await findLatestCustomerActiveOrder();
    if (latestOrder?.id) {
      orderId = String(latestOrder.id);
    }
  }

  $('#support-order-id').value = orderId;

  if (orderId) {
    const order = await loadOrder();
    const panel = $('#order-panel');
    panel.hidden = false;
    panel.innerHTML = supportOrderContextHtml(order);
  } else {
    const panel = $('#order-panel');
    panel.hidden = false;
    panel.innerHTML = `
      <div class="linked-order">
        <p class="eyebrow">\u4e00\u822c\u5ba2\u670d</p>
        <h2>\u672a\u6307\u5b9a\u5831\u4fee\u55ae</h2>
        <p class="muted">\u5982\u679c\u4f60\u662f\u8981\u8a62\u554f\u67d0\u5f35\u6848\u4ef6\uff0c\u5efa\u8b70\u5f9e\u6848\u4ef6\u8a0a\u606f\u6216\u300c\u6211\u7684\u6848\u4ef6\u300d\u9032\u5165\uff0c\u7cfb\u7d71\u6703\u81ea\u52d5\u5e36\u5165\u5831\u4fee\u55ae\u3002</p>
      </div>
    `;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireLineUser()) return;
    const button = form.querySelector('button');
    button.disabled = true;
    setStatus('\u6b63\u5728\u9001\u51fa\u5ba2\u670d\u7533\u8acb...');
    try {
      const ticket = await api('/api/liff/support-tickets', {
        method: 'POST',
        body: formDataWithProfile(form),
      });
      showSubmitDone(
        form,
        '\u5df2\u6536\u5230\u4f60\u7684\u5ba2\u670d\u7533\u8acb',
        '\u7de8\u865f ' + ticket.ticket_no + '\uff0c\u5e73\u53f0\u6703\u4f9d\u7167\u6848\u4ef6\u7d00\u9304\u5354\u52a9\u4e86\u89e3\u72c0\u6cc1\uff0c\u8acb\u7559\u610f LINE \u901a\u77e5\u3002',
        [
          { label: '\u67e5\u770b\u6211\u7684\u6848\u4ef6', href: liffPath('/liff/my-cases') },
          { label: '\u518d\u6b21\u5831\u4fee', href: liffPath('/liff/repair') },
        ]
      );
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

async function setupCancel() {
  const form = $('#cancel-form');
  const order = await loadOrder();
  const role = params().get('role') || 'customer';
  const isTechnician = role === 'technician';
  if (isTechnician) {
    document.querySelector('h1').textContent = '\u5e2b\u5085\u53d6\u6d88\u63a5\u6848';
    const lead = $('#cancel-lead');
    if (lead) {
      lead.textContent = '\u8acb\u586b\u5beb\u53d6\u6d88\u539f\u56e0\uff0c\u5e73\u53f0\u6703\u4fdd\u7559\u7d00\u9304\u3001\u901a\u77e5\u5ba2\u6236\uff0c\u4e26\u5c07\u6848\u4ef6\u9000\u56de\u91cd\u65b0\u6d3e\u55ae\u3002';
    }
  }
  $('#order-panel').innerHTML = orderSummary(order);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireLineUser()) return;
    const button = form.querySelector('button');
    button.disabled = true;
    setStatus('\u6b63\u5728\u53d6\u6d88\u6848\u4ef6...');
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const endpoint = isTechnician
        ? `/api/liff/orders/${order.id}/technician-cancel`
        : `/api/liff/orders/${order.id}/cancel`;
      const result = await api(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonWithLineUser(data),
      });
      showSubmitDone(
        form,
        isTechnician ? '\u5df2\u53d6\u6d88\u63a5\u6848' : '\u6848\u4ef6\u5df2\u53d6\u6d88',
        isTechnician
          ? '\u5df2\u53d6\u6d88\u6848\u4ef6 ' + result.order.order_no + '\uff0c\u5e73\u53f0\u5df2\u901a\u77e5\u5ba2\u6236\uff0c\u4e26\u5c07\u6848\u4ef6\u9000\u56de\u91cd\u65b0\u6d3e\u55ae\u3002'
          : '\u5df2\u53d6\u6d88\u6848\u4ef6 ' + result.order.order_no + '\uff0c\u53d6\u6d88\u539f\u56e0\u5df2\u7559\u5b58\u5728\u5e73\u53f0\u7d00\u9304\u3002',
        [
          { label: isTechnician ? '\u67e5\u770b\u6211\u7684\u6848\u4ef6' : '\u67e5\u770b\u6211\u7684\u6848\u4ef6', href: liffPath('/liff/my-cases') },
          { label: '\u518d\u6b21\u5831\u4fee', href: liffPath('/liff/repair') },
        ]
      );
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

function confirmDetailHtml(order, mode) {
  const baseQuote = Number(order.quote_amount || 0);
  const changeAmount = Number(order.change_request_amount || 0);
  const finalAmount = Number(order.final_amount || order.paid_amount || baseQuote + changeAmount || 0);
  const isChange = mode === 'change' || order.change_request_status === 'pending';

  if (mode === 'completion') {
    return `
      <h2>完工確認</h2>
      <dl class="summary-list">
        <dt>原始報價</dt><dd>${formatMoney(baseQuote)}</dd>
        <dt>追加報價</dt><dd>${formatMoney(changeAmount)}</dd>
        <dt>實付金額</dt><dd>${formatMoney(finalAmount)}</dd>
      </dl>
    `;
  }

  if (isChange) {
    return `
      <h2>追加報價確認</h2>
      <dl class="summary-list">
        <dt>原始報價</dt><dd>${formatMoney(baseQuote)}</dd>
        <dt>追加金額</dt><dd>${formatMoney(changeAmount)}</dd>
        <dt>追加原因</dt><dd>${escapeHtml(order.change_request_reason || '未填寫')}</dd>
      </dl>
    `;
  }

  return `
    <h2>報價確認</h2>
    <dl class="summary-list">
      <dt>報價金額</dt><dd>${formatMoney(baseQuote)}</dd>
      <dt>服務類型</dt><dd>${escapeHtml(order.service_type || '')}</dd>
      <dt>客戶希望時間</dt><dd>${escapeHtml(order.preferred_time_text || '')}</dd>
      <dt>師傅預計到場</dt><dd>${escapeHtml(order.estimated_arrival_time || '師傅尚未填寫')}</dd>
    </dl>
  `;
}

async function setupConfirm() {
  const order = await loadOrder();
  $('#order-panel').innerHTML = orderSummary(order);
  renderPhotos(order.images || []);
  const mode = params().get('mode') || (
    order.status === 'completed_pending_customer' ? 'completion' : 'quote'
  );

  const detail = $('#confirm-detail');
  const actions = $('#confirm-actions');
  if (mode === 'completion') {
    detail.innerHTML = confirmDetailHtml(order, mode);
    if (order.status !== 'completed_pending_customer') {
      actions.innerHTML = handledCard(
        order.status === 'closed'
          ? '此案件已完成結案，這個確認按鈕已失效。'
          : `此案件目前狀態為 ${order.status}，暫時不能確認結案。`
      );
      return;
    }
    actions.innerHTML = `
      <form id="completion-form">
        <label>實付金額
          <input name="paid_amount" type="number" min="0" value="${Number(order.final_amount || order.quote_amount || 0)}" required>
        </label>
        <label>評分
          <select name="rating" required>
            <option value="5">5 分，非常滿意</option>
            <option value="4">4 分，滿意</option>
            <option value="3">3 分，普通</option>
            <option value="2">2 分，不太滿意</option>
            <option value="1">1 分，不滿意</option>
          </select>
        </label>
        <label>評語
          <textarea name="comment" placeholder="可以留下這次服務心得"></textarea>
        </label>
        <button type="submit">確認結案並送出評價</button>
      </form>
      <div class="dispute-box">
        <a href="${liffPath(`/liff/support?order_id=${order.id}&type=completion_dispute`)}">
          <button type="button" class="danger">\u6211\u8981\u7533\u8a34</button>
        </a>
      </div>
    `;
    $('#completion-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      await api(`/api/liff/orders/${order.id}/confirm-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonWithLineUser({ ...data, confirmed: true }),
      });
      showReviewThanks(actions);
    });
    return;
  }

  const isChange = order.change_request_status === 'pending';
  detail.innerHTML = confirmDetailHtml(order, isChange ? 'change' : mode);
  if (!canUseQuoteConfirm(order)) {
    actions.innerHTML = handledCard(
      order.status === 'closed'
        ? '此案件已完成結案，這個報價確認按鈕已失效。'
        : `此案件目前狀態為 ${order.status}，這個報價確認按鈕已失效。`
    );
    return;
  }
  actions.innerHTML = `
    <div class="actions">
      <button id="accept-button">同意</button>
      <button id="reject-button" class="secondary">拒絕</button>
    </div>
  `;
  $('#accept-button').addEventListener('click', () => submitQuoteConfirmSafe(order.id, true));
  $('#reject-button').addEventListener('click', () => submitQuoteConfirmSafe(order.id, false));
}

async function submitQuoteConfirm(orderId, accepted) {
  await api(`/api/liff/orders/${orderId}/confirm-quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: jsonWithLineUser({ accepted }),
  });
  setStatus(accepted ? '已同意，師傅會依案件資訊前往。' : '已拒絕，平台會協助後續安排。');
}

async function submitQuoteConfirmSafe(orderId, accepted) {
  await api(`/api/liff/orders/${orderId}/confirm-quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: jsonWithLineUser({ accepted }),
  });
  setStatus(accepted ? '已送出同意，師傅會依案件資訊處理。' : '已送出拒絕，平台會協助後續安排。');
  const actions = $('#confirm-actions');
  if (actions) {
    actions.innerHTML = handledCard(
      accepted
        ? '已送出同意，這個確認按鈕已關閉。'
        : '已送出拒絕，這個確認按鈕已關閉。'
    );
  }
}

async function setupMyCases() {
  if (!requireLineUser()) return;
  setStatus('正在載入案件...');
  const [customerOrders, technicianOrders] = await Promise.all([
    api(withLineUser('/api/liff/customer/orders')).catch(() => []),
    api(withLineUser('/api/liff/technician/orders')).catch(() => []),
  ]);
  const list = $('#case-list');
  const customerList = customerOrders || [];
  const technicianList = technicianOrders || [];
  setStatus('');

  if (!customerList.length && !technicianList.length) {
    list.innerHTML = `
      <p class="notice">目前沒有案件。</p>
      <div class="actions">
        <a href="${liffPath('/liff/repair')}"><button type="button">我要報修</button></a>
      </div>
    `;
    return;
  }

  list.innerHTML = [
    customerList.length ? `
      <section class="case-section">
        <h2>我的報修</h2>
        ${customerList.map((order) => renderCaseCard(order, 'customer')).join('')}
      </section>
    ` : '',
    technicianList.length ? `
      <section class="case-section">
        <h2>我接的案件</h2>
        ${technicianList.map((order) => renderCaseCard(order, 'technician')).join('')}
      </section>
    ` : '',
  ].join('');
}

async function setupProfile() {
  if (!requireLineUser()) return;
  const form = $('#profile-form');
  const profile = await api(withLineUser('/api/liff/customer-profile'));

  form.name.value = profile.name || profile.line_display_name || '';
  form.phone.value = profile.phone || '';
  form.default_address.value = profile.default_address || '';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('正在儲存資料...');
    const data = Object.fromEntries(new FormData(form).entries());
    await api('/api/liff/customer-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonWithLineUser(data),
    });
    setStatus('會員資料已儲存，後台客戶名單也會看到這筆資料。之後報修會更快。');
  });
}

async function setupReview() {
  const order = await loadOrder();
  $('#order-panel').innerHTML = orderSummary(order);
  const role = params().get('role') || 'customer';
  const form = $('#review-form');
  if (role === 'technician') {
    $('#rating-field').hidden = true;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const endpoint = role === 'technician'
      ? `/api/liff/orders/${order.id}/technician-review`
      : `/api/liff/orders/${order.id}/customer-review`;
    await api(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonWithLineUser(data),
    });
    if (role === 'customer') {
      showReviewThanks(form.parentElement);
    } else {
      setStatus('評價已送出，謝謝。');
    }
  });
}

async function main() {
  try {
    await initLineProfile();
    const page = pageName();
    if (page === 'repair') await setupRepair();
    if (page === 'quote') await setupQuote();
    if (page === 'change-request') await setupChangeRequest();
    if (page === 'confirm') await setupConfirm();
    if (page === 'my-cases') await setupMyCases();
    if (page === 'profile') await setupProfile();
    if (page === 'review') await setupReview();
    if (page === 'support') await setupSupport();
    if (page === 'cancel') await setupCancel();
  } catch (error) {
    setStatus(error.message, true);
  }
}

main();
