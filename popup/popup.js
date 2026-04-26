/**
 * popup/popup.js
 * Logic for the MailPilot Browser Action popup.
 */
(() => {
  const { storageGet } = window.MailPilotUtils;
  const I18N = window.i18n;

  /**
   * Update UI with status info from storage
   */
  async function updateStatus() {
    const items = await storageGet(['uiLang', 'apiKey', 'model']);
    const lang = items.uiLang || 'en';

    // Translate static elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = I18N.getMessage(key, lang);
    });

    // Dynamic status indicators
    const keyVal = document.getElementById('keyStatus');
    const modelVal = document.getElementById('modelStatus');
    const tip = document.getElementById('setupTip');

    if (items.apiKey) {
      keyVal.textContent = I18N.getMessage('popup_status_set', lang);
      keyVal.className = 'status-val';
      modelVal.textContent = items.model || 'gemini-1.5-flash';
      if (tip) tip.style.display = 'none';
    } else {
      keyVal.textContent = I18N.getMessage('popup_status_missing', lang);
      keyVal.className = 'status-missing';
      modelVal.textContent = '-';
      if (tip) tip.style.display = 'block';
    }
  }

  // Open settings page
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', updateStatus);
})();