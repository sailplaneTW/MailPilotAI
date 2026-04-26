// content_scripts/send-guard.js
(() => {
  if (window.__mailpilotSendGuardInstalled) return;
  window.__mailpilotSendGuardInstalled = true;

  const SEND_BUTTON_SELECTOR = 'div[role="button"][data-tooltip*="Send"], div[role="button"][data-tooltip*="傳送"], div[role="button"][aria-label*="Send"], div[role="button"][aria-label*="傳送"], button[aria-label*="Send"], button[aria-label*="傳送"]';
  const I18N = window.i18n || { getMessage: (k) => k };

  let enabled = true;
  let uiLang = 'en';

  chrome.storage.local.get(['enableDoubleConfirm', 'uiLang'], data => {
    enabled = data.enableDoubleConfirm !== false;
    if (data.uiLang) uiLang = data.uiLang;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.enableDoubleConfirm) enabled = changes.enableDoubleConfirm.newValue !== false;
      if (changes.uiLang) uiLang = changes.uiLang.newValue;
    }
  });

  const buttonStates = new WeakMap();

  function restoreButton(btn) {
    const state = buttonStates.get(btn);
    if (!state) return;
    clearTimeout(state.timer);
    btn.textContent = state.originalText;
    btn.style.backgroundColor = state.originalBg;
    btn.style.color = state.originalColor;
    buttonStates.delete(btn);
  }

  const activeConfirmedButtons = new Set();

  document.addEventListener('click', (e) => {
    if (!enabled) return;
    const target = e.target;
    if (!(target instanceof Element)) return;

    const sendBtn = target.closest(SEND_BUTTON_SELECTOR);
    if (!sendBtn) return;
    if (!sendBtn.isConnected) return;

    const state = buttonStates.get(sendBtn);
    if (state && state.confirmed) {
      // Second click: restore before letting it pass
      restoreButton(sendBtn);
      activeConfirmedButtons.delete(sendBtn);
      document.removeEventListener('click', cancelExternalClick, true);
      return;
    }

    // First click: intercept
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const originalText = sendBtn.textContent;
    const originalBg = sendBtn.style.backgroundColor;
    const originalColor = sendBtn.style.color;

    sendBtn.textContent = I18N.getMessage('guard_warning', uiLang);
    sendBtn.style.backgroundColor = '#d93025';
    sendBtn.style.color = '#fff';

    const timer = setTimeout(() => {
      restoreButton(sendBtn);
      activeConfirmedButtons.delete(sendBtn);
      document.removeEventListener('click', cancelExternalClick, true);
    }, 5000);

    buttonStates.set(sendBtn, {
      confirmed: true,
      originalText, originalBg, originalColor, timer
    });
    activeConfirmedButtons.add(sendBtn);

    // Cancel on external click
    const cancelExternalClick = (ev) => {
      if (!sendBtn.contains(ev.target)) {
        restoreButton(sendBtn);
        activeConfirmedButtons.delete(sendBtn);
        document.removeEventListener('click', cancelExternalClick, true);
      }
    };
    document.addEventListener('click', cancelExternalClick, true);
  }, true);
})();