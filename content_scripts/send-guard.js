/**
 * content_scripts/send-guard.js
 * Implements a double-confirm mechanism for the Gmail Send button.
 */
(() => {
  if (window.__mailpilotSendGuardInstalled) return;
  window.__mailpilotSendGuardInstalled = true;

  const { storageGet, getUILanguage } = window.MailPilotUtils;
  const I18N = window.i18n;

  let uiLang = 'en';
  let isArmed = false;
  let resetTimer = null;

  // Initial language load
  getUILanguage().then(lang => { uiLang = lang; });

  // Sync language changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.uiLang) uiLang = changes.uiLang.newValue || 'en';
  });

  /**
   * Reset the button to its original state
   */
  function disarmButton(btn, originalLabel, originalColor) {
    isArmed = false;
    btn.textContent = originalLabel;
    btn.style.backgroundColor = originalColor;
    if (resetTimer) clearTimeout(resetTimer);
  }

  /**
   * Handle the Send button click event
   */
  async function handleSendClick(e) {
    const { enableDoubleConfirm } = await storageGet(['enableDoubleConfirm']);
    if (enableDoubleConfirm === false) return;

    const btn = e.currentTarget;
    if (isArmed) {
      // Second click: let the event proceed
      isArmed = false;
      if (resetTimer) clearTimeout(resetTimer);
      return;
    }

    // First click: block and arm
    e.preventDefault();
    e.stopPropagation();

    isArmed = true;
    const originalLabel = btn.textContent;
    const originalColor = btn.style.backgroundColor;

    btn.textContent = I18N.getMessage('guard_warning', uiLang);
    btn.style.backgroundColor = '#d93025'; // Red alert color

    // Auto-disarm after 5 seconds
    resetTimer = setTimeout(() => {
      disarmButton(btn, originalLabel, originalColor);
    }, 5000);
  }

  /**
   * Scan for the Send button and attach listener
   */
  function scanAndGuard() {
    // Standard Gmail send button and mobile/mini compose send buttons
    const sendButtons = document.querySelectorAll('.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3, [aria-label*="Send"], [role="button"][data-tooltip*="Send"]');
    
    sendButtons.forEach(btn => {
      if (btn.hasAttribute('data-mailpilot-guarded')) return;
      btn.setAttribute('data-mailpilot-guarded', '1');
      btn.addEventListener('click', handleSendClick, true); // Use capture to intercept before Gmail
    });
  }

  // Monitor the DOM for new compose windows
  setInterval(scanAndGuard, 1000);
})();