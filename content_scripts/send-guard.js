// content_scripts/send-guard.js
(() => {
  if (window.__mailpilotSendGuardInstalled) return;
  window.__mailpilotSendGuardInstalled = true;

  const SEND_BUTTON_SELECTOR = 'div[role="button"][data-tooltip*="Send"], div[role="button"][data-tooltip*="傳送"], div[role="button"][aria-label*="Send"], div[role="button"][aria-label*="傳送"], button[aria-label*="Send"], button[aria-label*="傳送"]';
  const I18N = window.i18n || { getMessage: (k) => k };

  let enabled = true;
  chrome.storage.local.get(['enableDoubleConfirm'], data => {
    enabled = data.enableDoubleConfirm !== false;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enableDoubleConfirm) {
      enabled = changes.enableDoubleConfirm.newValue !== false;
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

  function cancelIfConfirmed(e) {
    // 找出所有處於確認狀態的按鈕，若點擊目標不是它們，就取消
    for (const [btn, state] of (() => {
      // WeakMap 無法直接迭代，所以改用其他方式記錄
      // 此處改為在 document 上暫存按鈕陣列
    })()) { }
  }
  // (為了簡化，這裡使用全域的 activeConfirmedButtons Set 來追蹤)

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
      // 第二次點擊：放行前先恢復原狀
      restoreButton(sendBtn);
      activeConfirmedButtons.delete(sendBtn);
      document.removeEventListener('click', cancelExternalClick, true);
      return;
    }

    // 第一次點擊：攔截
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const originalText = sendBtn.textContent;
    const originalBg = sendBtn.style.backgroundColor;
    const originalColor = sendBtn.style.color;

    sendBtn.textContent = I18N.getMessage('guard_warning');
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

    // 點擊其他區域取消
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