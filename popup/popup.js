// popup/popup.js
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['apiKey', 'model', 'uiLang'], (data) => {
    const lang = data.uiLang || 'en';
    const keyStatus = document.getElementById('keyStatus');
    const modelStatus = document.getElementById('modelStatus');

    // Apply basic i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = window.i18n.getMessage(key, lang);
    });

    if (data.apiKey) {
      keyStatus.textContent = window.i18n.getMessage('popup_status_set', lang);
      keyStatus.className = 'status-val';
    } else {
      keyStatus.textContent = window.i18n.getMessage('popup_status_missing', lang);
      keyStatus.className = 'status-missing';
    }

    if (data.model) {
      modelStatus.textContent = data.model;
      modelStatus.className = 'status-val';
    } else {
      modelStatus.textContent = window.i18n.getMessage('popup_status_missing', lang);
      modelStatus.className = 'status-missing';
    }
  });
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options/options.html'));
  }
});