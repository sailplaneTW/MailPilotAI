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
      keyVal.className = 'status-val status-ok';
      modelVal.textContent = items.model || 'gemini-1.5-flash';
      tip.style.display = 'none';
    } else {
      keyVal.textContent = I18N.getMessage('popup_status_missing', lang);
      keyVal.className = 'status-val status-missing';
      modelVal.textContent = '-';
      tip.style.display = 'block';
    }
  }

  // Open settings page
  document.getElementById('openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Initialize
  document.addEventListener('DOMContentLoaded', updateStatus);
})();