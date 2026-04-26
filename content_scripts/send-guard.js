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
  let armedButton = null;

  function restoreButton(btn) {
    const state = buttonStates.get(btn);
    if (!state) return;

    clearTimeout(state.timer);
    btn.textContent = state.originalText;
    btn.style.backgroundColor = state.originalBg;
    btn.style.color = state.originalColor;
    btn.style.outline = state.originalOutline;
    btn.style.boxShadow = state.originalBoxShadow;
    btn.title = state.originalTitle;
    buttonStates.delete(btn);

    if (armedButton === btn) {
      armedButton = null;
    }
  }

  function armButton(btn) {
    const originalText = btn.textContent || '';
    const originalBg = btn.style.backgroundColor;
    const originalColor = btn.style.color;
    const originalOutline = btn.style.outline;
    const originalBoxShadow = btn.style.boxShadow;
    const originalTitle = btn.title;

    btn.textContent = I18N.getMessage('guard_warning', uiLang);
    btn.style.backgroundColor = '#d93025';
    btn.style.color = '#fff';
    btn.style.outline = '2px solid rgba(217, 48, 37, 0.18)';
    btn.style.boxShadow = '0 2px 8px rgba(217, 48, 37, 0.25)';
    btn.title = I18N.getMessage('guard_warning', uiLang);

    const timer = setTimeout(() => restoreButton(btn), 5000);

    buttonStates.set(btn, {
      originalText,
      originalBg,
      originalColor,
      originalOutline,
      originalBoxShadow,
      originalTitle,
      timer
    });

    armedButton = btn;
  }

  document.addEventListener('click', (e) => {
    if (!enabled) return;

    const target = e.target;
    if (!(target instanceof Element)) return;

    const sendBtn = target.closest(SEND_BUTTON_SELECTOR);

    if (armedButton && sendBtn !== armedButton) {
      restoreButton(armedButton);
    }

    if (!sendBtn || !sendBtn.isConnected) return;

    if (sendBtn === armedButton) {
      restoreButton(sendBtn);
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    armButton(sendBtn);
  }, true);
})();