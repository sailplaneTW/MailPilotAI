// options/options.js
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);
document.getElementById('uiLang').addEventListener('change', onUILanguageChange);

document.getElementById('toggleApiKeyBtn').addEventListener('click', function () {
    const input = document.getElementById('apiKey');
    const uiLang = document.getElementById('uiLang').value;
    if (input.type === 'password') {
        input.type = 'text';
        this.textContent = window.i18n.getMessage('opt_hide', uiLang);
    } else {
        input.type = 'password';
        this.textContent = window.i18n.getMessage('opt_show', uiLang);
    }
});

function applyI18n(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = window.i18n.getMessage(key, lang);
    });
}

function isCloudLanguageModel(model) {
    const id = model.name.toLowerCase();
    if (!model.supportedGenerationMethods.includes('generateContent')) return false;
    if (id.includes('gemma') || id.includes('embed') || id.includes('embedding')) return false;
    if (id.includes('image') || id.includes('vision') || id.includes('imagen')) return false;
    if (id.includes('aqa') || id.includes('tts')) return false;
    return true;
}

async function fetchAndPopulateModels(isManual = false) {
    const apiKey = document.getElementById('apiKey').value.trim();
    if (!apiKey) return;
    const btn = document.getElementById('fetchModelsBtn');
    const select = document.getElementById('model');
    const uiLang = document.getElementById('uiLang').value;

    btn.textContent = '...';
    btn.disabled = true;
    select.disabled = true;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const models = data.models.filter(isCloudLanguageModel);

        select.innerHTML = '';
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name.replace('models/', '');
            opt.textContent = m.displayName;
            select.appendChild(opt);
        });
        select.disabled = false;
        btn.textContent = window.i18n.getMessage('opt_update_models', uiLang);
    } catch (e) {
        console.error('Fetch Failed:', e);
        btn.textContent = window.i18n.getMessage('opt_fetch_failed', uiLang);
        // Explicitly leave select disabled if fetch fails so user knows it failed, 
        // but ensure btn is re-enabled to retry
    } finally {
        btn.disabled = false;
    }
}

document.getElementById('apiKey').addEventListener('blur', () => {
    document.getElementById('fetchModelsBtn').disabled = false;
    fetchAndPopulateModels(false);
});
document.getElementById('fetchModelsBtn').addEventListener('click', () => fetchAndPopulateModels(true));

function onUILanguageChange(e) {
    const newLang = e.target.value;
    applyI18n(newLang);
    updateDefaultPrompts(newLang);

    // Update dynamic button texts
    const apiKeyInput = document.getElementById('apiKey');
    const toggleBtn = document.getElementById('toggleApiKeyBtn');
    toggleBtn.textContent = window.i18n.getMessage(apiKeyInput.type === 'password' ? 'opt_show' : 'opt_hide', newLang);
}

function updateDefaultPrompts(lang) {
    const defaults = window.i18n.getDefaultPrompts(lang);
    const optimizeEl = document.getElementById('optimizePrompt');
    const titleEl = document.getElementById('titlePrompt');

    const langKeys = ['en', 'zh_TW', 'zh_CN'];
    let optimizeIsDefault = !optimizeEl.value.trim();
    let titleIsDefault = !titleEl.value.trim();

    if (!optimizeIsDefault) {
        for (const l of langKeys) {
            if (optimizeEl.value === window.i18n.getDefaultPrompts(l).optimize) {
                optimizeIsDefault = true;
                break;
            }
        }
    }
    if (!titleIsDefault) {
        for (const l of langKeys) {
            if (titleEl.value === window.i18n.getDefaultPrompts(l).title) {
                titleIsDefault = true;
                break;
            }
        }
    }

    if (optimizeIsDefault) optimizeEl.value = defaults.optimize;
    if (titleIsDefault) titleEl.value = defaults.title;
}

function saveOptions() {
    const uiLang = document.getElementById('uiLang').value;
    const data = {
        uiLang,
        apiKey: document.getElementById('apiKey').value.trim(),
        model: document.getElementById('model').value,
        optimizePrompt: document.getElementById('optimizePrompt').value,
        translateLang: document.getElementById('translateLang').value,
        titlePrompt: document.getElementById('titlePrompt').value,
        checkPrompt: document.getElementById('checkPrompt').value,
        enableDoubleConfirm: document.getElementById('enableDoubleConfirm').checked
    };

    chrome.storage.local.set(data, () => {
        const status = document.getElementById('status');
        status.textContent = window.i18n.getMessage('opt_saved', uiLang);
        setTimeout(() => { status.textContent = ''; }, 2000);
    });
}

function restoreOptions() {
    chrome.storage.local.get([
        'uiLang', 'apiKey', 'model', 'optimizePrompt', 'translateLang',
        'titlePrompt', 'checkPrompt', 'enableDoubleConfirm'
    ], async (items) => {
        const lang = items.uiLang || 'en';
        document.getElementById('uiLang').value = lang;
        applyI18n(lang);

        if (items.apiKey) {
            document.getElementById('apiKey').value = items.apiKey;
            document.getElementById('model').disabled = false;
            document.getElementById('fetchModelsBtn').disabled = false;
            await fetchAndPopulateModels(false);
            if (items.model) {
                const select = document.getElementById('model');
                if (!Array.from(select.options).some(o => o.value === items.model)) {
                    const opt = document.createElement('option');
                    opt.value = items.model;
                    opt.textContent = items.model;
                    select.appendChild(opt);
                }
                select.value = items.model;
            }
        }

        document.getElementById('translateLang').value = items.translateLang || 'English';
        document.getElementById('checkPrompt').value = items.checkPrompt || '';
        document.getElementById('enableDoubleConfirm').checked = items.enableDoubleConfirm !== false;

        const defaults = window.i18n.getDefaultPrompts(lang);
        document.getElementById('optimizePrompt').value = items.optimizePrompt || defaults.optimize;
        document.getElementById('titlePrompt').value = items.titlePrompt || defaults.title;

        // Init toggle button text
        document.getElementById('toggleApiKeyBtn').textContent = window.i18n.getMessage('opt_show', lang);
    });
}