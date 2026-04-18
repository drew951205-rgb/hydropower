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

function renderPhotos(images = []) {
  const node = $('#photos');
  if (!node) return;
  const publicImages = images.filter((item) => /^https?:\/\//.test(item.image_url));
  if (!publicImages.length) {
    node.innerHTML = '<p class="muted">目前沒有照片。</p>';
    return;
  }
  node.innerHTML = publicImages
    .map((item) => `<img src="${item.image_url}" alt="案件照片">`)
    .join('');
}

async function loadOrder() {
  const orderId = params().get('order_id');
  if (!orderId) throw new Error('缺少案件 ID');
  return api(withLineUser(`/api/liff/orders/${orderId}`));
}

async function setupRepair() {
  const form = $('#repair-form');
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
      setStatus(`已建立案件 ${order.order_no}，平台會先審核資料。`);
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
      setStatus('報價已送出，已通知顧客確認。');
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
      setStatus('追加報價已送出，已通知顧客確認。');
    } catch (error) {
      setStatus(error.message, true);
    }
  });
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
    detail.innerHTML = `實付金額：${formatMoney(order.final_amount || order.quote_amount)}`;
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
      <button id="dispute-button" class="danger">我要申訴</button>
    `;
    $('#completion-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      await api(`/api/liff/orders/${order.id}/confirm-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonWithLineUser({ ...data, confirmed: true }),
      });
      setStatus('已確認結案，謝謝你的評價。');
    });
    $('#dispute-button').addEventListener('click', async () => {
      await api(`/api/liff/orders/${order.id}/confirm-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonWithLineUser({ confirmed: false, comment: 'Customer disputed from LIFF' }),
      });
      setStatus('已收到申訴，平台會協助處理。');
    });
    return;
  }

  const isChange = order.change_request_status === 'pending';
  detail.innerHTML = isChange
    ? `追加金額：${formatMoney(order.change_request_amount)}<br>原因：${order.change_request_reason || '未填'}`
    : `報價金額：${formatMoney(order.quote_amount)}`;
  actions.innerHTML = `
    <div class="actions">
      <button id="accept-button">同意</button>
      <button id="reject-button" class="secondary">拒絕</button>
    </div>
  `;
  $('#accept-button').addEventListener('click', () => submitQuoteConfirm(order.id, true));
  $('#reject-button').addEventListener('click', () => submitQuoteConfirm(order.id, false));
}

async function submitQuoteConfirm(orderId, accepted) {
  await api(`/api/liff/orders/${orderId}/confirm-quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: jsonWithLineUser({ accepted }),
  });
  setStatus(accepted ? '已同意，師傅會依案件資訊前往。' : '已拒絕，平台會協助後續安排。');
}

async function setupMyCases() {
  if (!requireLineUser()) return;
  const orders = await api(withLineUser('/api/liff/technician/orders'));
  const list = $('#case-list');
  if (!orders.length) {
    list.innerHTML = '<p class="notice">目前沒有進行中的案件。</p>';
    return;
  }
  list.innerHTML = orders.map((order) => `
    <article class="case-card">
      <h2>${order.order_no}</h2>
      <p>${orderSummary(order)}</p>
      <div class="actions">
        <a href="/liff/quote?order_id=${order.id}&line_user_id=${encodeURIComponent(lineUserId())}"><button>報價</button></a>
        <a href="/liff/change-request?order_id=${order.id}&line_user_id=${encodeURIComponent(lineUserId())}"><button class="secondary">追加報價</button></a>
      </div>
    </article>
  `).join('');
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
    setStatus('評價已送出，謝謝。');
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
    if (page === 'review') await setupReview();
  } catch (error) {
    setStatus(error.message, true);
  }
}

main();
