const SANDBOX_LIFF_ID = '2010103872-fF2upqTo';
const LIFF_INIT_TIMEOUT_MS = 2500;

async function logSandbox(payload) {
  try {
    await fetch('/api/liff/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: 'sandbox',
        href: window.location.href,
        userAgent: navigator.userAgent || '',
        ...payload,
      }),
    });
  } catch (error) {
    console.warn('[sandbox:log:error]', error);
  }
}

function renderSandbox(status, detail, isError) {
  const statusNode = document.getElementById('sandbox-status');
  const outputNode = document.getElementById('sandbox-output');
  statusNode.textContent = status;
  statusNode.className = `notice${isError ? ' error' : ''}`;
  outputNode.textContent =
    typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
}

function browserFallbackUrl(targetPath = '/liff/repair') {
  const next = new URL(targetPath, window.location.origin);
  next.searchParams.set('openExternalBrowser', '1');
  next.searchParams.set('browser_fallback', '1');
  next.searchParams.set('from_liff_sandbox', '1');
  return next.toString();
}

function showBrowserContinue() {
  const panel = document.querySelector('section');
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

function initWithTimeout() {
  return Promise.race([
    window.liff.init({ liffId: SANDBOX_LIFF_ID }),
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error('LIFF_TIMEOUT')), LIFF_INIT_TIMEOUT_MS);
    }),
  ]);
}

async function main() {
  try {
    await initWithTimeout();
    const detail = {
      event: 'sandbox_init_ok',
      liffId: SANDBOX_LIFF_ID,
      sdkVersion: window.liff?.getVersion?.() || '',
      lineVersion: window.liff?.getLineVersion?.() || '',
      inClient: window.liff?.isInClient?.() ?? null,
      isLoggedIn: window.liff?.isLoggedIn?.() ?? null,
      search: window.location.search,
      href: window.location.href,
    };
    renderSandbox('LIFF init 成功', detail, false);
    await logSandbox(detail);
  } catch (error) {
    const detail = {
      event: 'sandbox_init_failed',
      liffId: SANDBOX_LIFF_ID,
      message: error?.message || '',
      code: error?.code || '',
      cause: error?.cause ? String(error.cause) : '',
      sdkVersion: window.liff?.getVersion?.() || '',
      lineVersion: window.liff?.getLineVersion?.() || '',
      inClient: window.liff?.isInClient?.() ?? null,
      search: window.location.search,
      href: window.location.href,
    };
    renderSandbox('LIFF init 失敗', detail, true);
    await logSandbox(detail);

    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent || '');
    const isInLine = /Line\//i.test(navigator.userAgent || '') || /LIFF/i.test(navigator.userAgent || '');
    if (isIOS && isInLine && (detail.message === 'LIFF_TIMEOUT' || detail.message.includes('Load failed'))) {
      showBrowserContinue();
    }
  }
}

main().catch(async (error) => {
  const detail = {
    event: 'sandbox_runtime_failed',
    liffId: SANDBOX_LIFF_ID,
    message: error?.message || String(error),
    href: window.location.href,
  };
  renderSandbox('Sandbox 執行失敗', detail, true);
  await logSandbox(detail);
});
