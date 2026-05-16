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
    await window.liff.init({ liffId });
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
