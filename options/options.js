/**
 * options/options.js
 * Logic for the MailPilot AI Settings page.
 */
(() => {
  const { storageGet, storageSet, getUILanguage } = window.MailPilotUtils;
  const I18N = window.i18n;

  // --- UI Elements ---
  const el = {
    uiLang: document.getElementById('uiLang'),
    apiKey: document.getElementById('apiKey'),
    model: document.getElementById('model'),
    optimizePrompt: document.getElementById('optimizePrompt'),
    titlePrompt: document.getElementById('titlePrompt'),
    checkPrompt: document.getElementById('checkPrompt'),
    translateLang: document.getElementById('translateLang'),
    enableDoubleConfirm: document.getElementById('enableDoubleConfirm'),
    status: document.getElementById('status'),
    saveBtn: document.getElementById('saveBtn'),
    fetchModelsBtn: document.getElementById('fetchModelsBtn'),
    toggleApiKeyBtn: document.getElementById('toggleApiKeyBtn')
  };

  /**
   * Translate UI elements based on current language
   */
  function applyI18n(lang) {
    document.querySelectorAll('[data-i18n]').forEach(item => {
      const key = item.getAttribute('data-i18n');
      item.textContent = I18N.getMessage(key, lang);
    });
  }

  /**
   * Update placeholder prompts when language changes
   */
  function updatePromptPlaceholders(lang) {
    const defaults = I18N.getDefaultPrompts(lang);
    el.optimizePrompt.placeholder = defaults.optimize;
    el.titlePrompt.placeholder = defaults.title;
  }

  /**
   * Helper to determine if a prompt is one of the defaults
   */
  function isDefaultPrompt(val, type) {
    if (!val) return true;
    const langs = ['en', 'zh_TW', 'zh_CN'];
    return langs.some(l => val === I18N.getDefaultPrompts(l)[type]);
  }

  /**
   * Fetch available Gemini models from the API
   */
  async function refreshModels() {
    const key = el.apiKey.value.trim();
    if (!key) return;

    el.fetchModelsBtn.disabled = true;
    el.fetchModelsBtn.textContent = '...';

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      const models = (data.models || [])
        .filter(m => m.supportedGenerationMethods.includes('generateContent'))
        .filter(m => !m.name.includes('vision') && !m.name.includes('embed'));

      if (!models.length) throw new Error('No compatible models');

      const currentVal = el.model.value;
      el.model.innerHTML = '';
      models.forEach(m => {
        const id = m.name.replace(/^models\//, '');
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = m.displayName || id;
        el.model.appendChild(opt);
      });

      if (currentVal) el.model.value = currentVal;
      el.model.disabled = false;
      el.fetchModelsBtn.textContent = I18N.getMessage('opt_update_models', el.uiLang.value);
    } catch (err) {
      console.error('[MailPilot] Model fetch failed:', err);
      el.fetchModelsBtn.textContent = I18N.getMessage('opt_fetch_failed', el.uiLang.value);
    } finally {
      el.fetchModelsBtn.disabled = false;
    }
  }

  /**
   * Save settings to storage
   */
  async function saveSettings() {
    const data = {
      uiLang: el.uiLang.value,
      apiKey: el.apiKey.value.trim(),
      model: el.model.value,
      optimizePrompt: el.optimizePrompt.value,
      titlePrompt: el.titlePrompt.value,
      checkPrompt: el.checkPrompt.value,
      translateLang: el.translateLang.value,
      enableDoubleConfirm: el.enableDoubleConfirm.checked
    };

    await storageSet(data);
    el.status.textContent = I18N.getMessage('opt_saved', el.uiLang.value);
    setTimeout(() => { el.status.textContent = ''; }, 2000);
  }

  /**
   * Load settings and initialize UI
   */
  async function loadSettings() {
    const items = await storageGet([
      'uiLang', 'apiKey', 'model', 'optimizePrompt', 
      'titlePrompt', 'checkPrompt', 'translateLang', 'enableDoubleConfirm'
    ]);

    const lang = items.uiLang || 'en';
    el.uiLang.value = lang;
    applyI18n(lang);
    updatePromptPlaceholders(lang);

    el.apiKey.value = items.apiKey || '';
    if (items.apiKey) {
      el.model.disabled = false;
      el.fetchModelsBtn.disabled = false;
      // Add existing model if it's not in the default list
      if (items.model) {
        const opt = document.createElement('option');
        opt.value = items.model;
        opt.textContent = items.model;
        el.model.appendChild(opt);
        el.model.value = items.model;
      }
      refreshModels();
    }

    el.translateLang.value = items.translateLang || 'English';
    el.checkPrompt.value = items.checkPrompt || '';
    el.enableDoubleConfirm.checked = items.enableDoubleConfirm !== false;

    // Load prompts with auto-sync logic
    const defaults = I18N.getDefaultPrompts(lang);
    el.optimizePrompt.value = items.optimizePrompt || defaults.optimize;
    el.titlePrompt.value = items.titlePrompt || defaults.title;

    el.toggleApiKeyBtn.textContent = I18N.getMessage('opt_show', lang);
  }

  // --- Listeners ---
  el.uiLang.addEventListener('change', async (e) => {
    const lang = e.target.value;
    await storageSet({ uiLang: lang });
    applyI18n(lang);
    updatePromptPlaceholders(lang);

    if (isDefaultPrompt(el.optimizePrompt.value, 'optimize')) {
      el.optimizePrompt.value = I18N.getDefaultPrompts(lang).optimize;
    }
    if (isDefaultPrompt(el.titlePrompt.value, 'title')) {
      el.titlePrompt.value = I18N.getDefaultPrompts(lang).title;
    }
    
    el.toggleApiKeyBtn.textContent = I18N.getMessage(el.apiKey.type === 'password' ? 'opt_show' : 'opt_hide', lang);
  });

  el.toggleApiKeyBtn.addEventListener('click', () => {
    const isPass = el.apiKey.type === 'password';
    el.apiKey.type = isPass ? 'text' : 'password';
    el.toggleApiKeyBtn.textContent = I18N.getMessage(isPass ? 'opt_hide' : 'opt_show', el.uiLang.value);
  });

  el.apiKey.addEventListener('blur', refreshModels);
  el.fetchModelsBtn.addEventListener('click', refreshModels);
  el.saveBtn.addEventListener('click', saveSettings);

  // Initialize
  document.addEventListener('DOMContentLoaded', loadSettings);
})();