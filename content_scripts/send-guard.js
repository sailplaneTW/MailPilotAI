(() => {
  if (window.__mailrefineSendGuardInstalled) return;
  window.__mailrefineSendGuardInstalled = true;

  const SEND_BUTTON_SELECTORS = [
    'div[role="button"][data-tooltip*="Send"]',
    'div[role="button"][data-tooltip*="傳送"]',
    'div[role="button"][aria-label*="Send"]',
    'div[role="button"][aria-label*="傳送"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="傳送"]'
  ].join(',');

  const I18N = window.i18n || {
    getMessage: (key) => {
      if (key === 'guard_warning') return '⚠️ Confirm Send?';
      return key;
    }
  };

  let enabled = true;
  const buttonState = new WeakMap();

  chrome.storage.local.get(['enableDoubleConfirm'], (data) => {
    enabled = data.enableDoubleConfirm !== false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enableDoubleConfirm) {
      enabled = changes.enableDoubleConfirm.newValue !== false;
    }
  });

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function restoreButton(btn) {
    const state = buttonState.get(btn);
    if (!state) return;

    clearTimeout(state.timer);
    btn.textContent = state.originalText;
    btn.style.backgroundColor = state.originalBg;
    btn.style.color = state.originalColor;
    buttonState.delete(btn);
  }

  document.addEventListener('click', (e) => {
    if (!enabled) return;
    const target = e.target;
    if (!(target instanceof Element)) return;

    const sendButton = target.closest(SEND_BUTTON_SELECTORS);
    if (!sendButton || !isVisible(sendButton)) return;

    const state = buttonState.get(sendButton);

    // 第二次點擊：放行
    if (state && state.confirmed) {
      restoreButton(sendButton);
      return;
    }

    // 第一次點擊：攔截
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const originalText = sendButton.textContent;
    const originalBg = sendButton.style.backgroundColor;
    const originalColor = sendButton.style.color;

    sendButton.textContent = I18N.getMessage('guard_warning');
    sendButton.style.backgroundColor = '#d93025';
    sendButton.style.color = '#fff';

    const timer = setTimeout(() => {
      restoreButton(sendButton);
    }, 5000);

    buttonState.set(sendButton, {
      confirmed: true,
      originalText,
      originalBg,
      originalColor,
      timer
    });
  }, true);
})();