const SANDBOX_LIFF_ID = '2010103872-fF2upqTo';

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

async function main() {
  try {
    await window.liff.init({ liffId: SANDBOX_LIFF_ID });
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
