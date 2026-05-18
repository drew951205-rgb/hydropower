(() => {
  const GUEST_KEY = 'browser_guest_user_id';
  const LINE_USER_KEY = 'line_user_id';
  const BROWSER_SUCCESS_NOTE =
    '案件送出後，平台會先審核內容，再依你留下的聯絡方式安排後續服務。';

  function search() {
    return new URLSearchParams(window.location.search);
  }

  function isLineContext() {
    const agent = navigator.userAgent || '';
    return /Line\//i.test(agent) ||
      /LIFF/i.test(agent) ||
      search().has('liff.state') ||
      search().has('liff.referrer') ||
      search().has('access_token');
  }

  function currentUserId() {
    return search().get('line_user_id') || localStorage.getItem(LINE_USER_KEY) || '';
  }

  function ensureGuestUserId() {
    const existing = localStorage.getItem(GUEST_KEY) || '';
    if (existing) return existing;

    const created = `web-guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(GUEST_KEY, created);
    return created;
  }

  const hiddenInput = document.getElementById('line_user_id');
  const browserHint = document.getElementById('browser-fallback-hint');
  const form = document.getElementById('repair-form');

  if (isLineContext()) {
    if (browserHint) browserHint.hidden = true;
    return;
  }

  const effectiveUserId = currentUserId() || ensureGuestUserId();
  localStorage.setItem(LINE_USER_KEY, effectiveUserId);

  if (hiddenInput) hiddenInput.value = effectiveUserId;
  if (browserHint) browserHint.hidden = false;

  if (form) {
    const observer = new MutationObserver(() => {
      const panel = document.querySelector('.submit-done');
      if (!panel || panel.dataset.browserNoteApplied === 'true') return;

      const note = document.createElement('p');
      note.className = 'muted';
      note.textContent = BROWSER_SUCCESS_NOTE;
      panel.append(note);
      panel.dataset.browserNoteApplied = 'true';
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
})();
