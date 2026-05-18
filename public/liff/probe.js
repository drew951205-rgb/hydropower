const LIFF_INIT_TIMEOUT_MS = 2500;

async function logClient(payload) {
  try {
    await fetch('/api/liff/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: 'probe',
        href: window.location.href,
        userAgent: navigator.userAgent || '',
        ...payload,
      }),
    });
  } catch (error) {
    console.warn('[probe:log:error]', error);
  }
}

function render(status, detail, isError) {
  const statusNode = document.getElementById('probe-status');
  const outputNode = document.getElementById('probe-output');
  statusNode.textContent = status;
  statusNode.className = 'notice' + (isError ? ' error' : '');
  outputNode.textContent =
    typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
}

function browserFallbackUrl(targetPath = '/liff/repair') {
  const next = new URL(targetPath, window.location.origin);
  next.searchParams.set('openExternalBrowser', '1');
  next.searchParams.set('browser_fallback', '1');
  next.searchParams.set('from_liff_probe', '1');
  return next.toString();
}

function showBrowserContinue() {
  const panel = document.querySelector('.launch-panel');
  if (!panel || panel.querySelector('[data-browser-fallback-link]')) return;

  const wrap = document.createElement('div');
  wrap.style.marginTop = '16px';
  wrap.innerHTML = `
    <a data-browser-fallback-link href="${browserFallbackUrl()}">
      <button type="button">改用瀏覽器繼續</button>
    </a>
  `;
  panel.appendChild(wrap);
}

function triggerBrowserFallback() {
  showBrowserContinue();
  window.setTimeout(() => {
    window.location.assign(browserFallbackUrl());
  }, 800);
}

function initWithTimeout(liffId) {
  return Promise.race([
    window.liff.init({ liffId }),
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error('LIFF_TIMEOUT')), LIFF_INIT_TIMEOUT_MS);
    }),
  ]);
}

async function main() {
  const configResponse = await fetch('/api/liff/config');
  const configPayload = await configResponse.json();
  const liffId = configPayload?.data?.liffId || '';

  if (!liffId) {
    render('缺少 LIFF ID', { configPayload }, true);
    await logClient({ event: 'probe_missing_liff_id', configPayload });
    return;
  }

  try {
    await initWithTimeout(liffId);
    const detail = {
      event: 'probe_init_ok',
      sdkVersion: window.liff?.getVersion?.() || '',
      lineVersion: window.liff?.getLineVersion?.() || '',
      inClient: window.liff?.isInClient?.() ?? null,
      isLoggedIn: window.liff?.isLoggedIn?.() ?? null,
      search: window.location.search,
      href: window.location.href,
    };
    render('LIFF init 成功', detail, false);
    await logClient(detail);
  } catch (error) {
    const detail = {
      event: 'probe_init_failed',
      message: error?.message || '',
      code: error?.code || '',
      cause: error?.cause ? String(error.cause) : '',
      search: window.location.search,
      sdkVersion: window.liff?.getVersion?.() || '',
      lineVersion: window.liff?.getLineVersion?.() || '',
      inClient: window.liff?.isInClient?.() ?? null,
      href: window.location.href,
    };
    render('LIFF init 失敗', detail, true);
    await logClient(detail);

    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent || '');
    const isInLine = /Line\//i.test(navigator.userAgent || '') || /LIFF/i.test(navigator.userAgent || '');
    if (isIOS && isInLine && (detail.message === 'LIFF_TIMEOUT' || detail.message.includes('Load failed'))) {
      render('LIFF init 失敗，正在改用瀏覽器繼續...', detail, true);
      triggerBrowserFallback();
    }
  }
}

main().catch(async (error) => {
  const detail = {
    event: 'probe_runtime_failed',
    message: error?.message || String(error),
    href: window.location.href,
  };
  render('Probe 執行失敗', detail, true);
  await logClient(detail);
});
