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
    if (!model || typeof model !== 'object') return false;
    const id = String(model.name || model.displayName || '').toLowerCase();
    const methods = Array.isArray(model.supportedGenerationMethods) ? model.supportedGenerationMethods : [];

    if (!methods.includes('generateContent')) return false;
    if (id.includes('gemma') || id.includes('embed') || id.includes('embedding')) return false;
    if (id.includes('image') || id.includes('vision') || id.includes('imagen')) return false;
    if (id.includes('aqa') || id.includes('tts')) return false;
    return true;
}

async function fetchAndPopulateModels() {
    const apiKey = document.getElementById('apiKey').value.trim();
    if (!apiKey) return;

    const btn = document.getElementById('fetchModelsBtn');
    const select = document.getElementById('model');
    const uiLang = document.getElementById('uiLang').value;

    const previousValue = select.value;
    const hadExistingOptions = select.options.length > 0;

    btn.textContent = '...';
    btn.disabled = true;
    select.disabled = true;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data = await resp.json();
        const models = Array.isArray(data.models) ? data.models.filter(isCloudLanguageModel) : [];
        if (!models.length) throw new Error('No compatible models');

        const modelIds = models.map(m => String(m.name || '').replace(/^models\//, '')).filter(Boolean);
        const fragment = document.createDocumentFragment();

        modelIds.forEach((id, index) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = models[index].displayName || id;
            fragment.appendChild(opt);
        });

        if (previousValue && !modelIds.includes(previousValue)) {
            const opt = document.createElement('option');
            opt.value = previousValue;
            opt.textContent = previousValue;
            fragment.appendChild(opt);
        }

        select.innerHTML = '';
        select.appendChild(fragment);
        select.disabled = false;

        if (previousValue) select.value = previousValue;

        btn.textContent = window.i18n.getMessage('opt_update_models', uiLang);
    } catch (e) {
        btn.textContent = window.i18n.getMessage('opt_fetch_failed', uiLang);
        if (hadExistingOptions) {
            select.disabled = false;
            select.value = previousValue;
        }
    } finally {
        btn.disabled = false;
    }
}

document.getElementById('apiKey').addEventListener('blur', () => {
    document.getElementById('fetchModelsBtn').disabled = false;
    fetchAndPopulateModels();
});

document.getElementById('fetchModelsBtn').addEventListener('click', () => fetchAndPopulateModels());

function onUILanguageChange(e) {
    const newLang = e.target.value;
    // 立即儲存語系設定，觸發 onChanged 事件給其他分頁 (如 Gmail 內視窗)
    chrome.storage.local.set({ uiLang: newLang }, () => {
        applyI18n(newLang);
        updateDefaultPrompts(newLang);

        // 同步更新密碼顯示/隱藏按鈕的文字
        const apiKeyInput = document.getElementById('apiKey');
        const toggleBtn = document.getElementById('toggleApiKeyBtn');
        toggleBtn.textContent = window.i18n.getMessage(apiKeyInput.type === 'password' ? 'opt_show' : 'opt_hide', newLang);
    });
}

// 輔助函式：判斷當前文字是否為任一語系的預設提示詞
function isAnyDefaultPrompt(value, type) {
    if (!value) return true;
    const langs = ['en', 'zh_TW', 'zh_CN'];
    return langs.some(l => value === window.i18n.getDefaultPrompts(l)[type]);
}

function updateDefaultPrompts(lang) {
    const defaults = window.i18n.getDefaultPrompts(lang);
    const optimizeEl = document.getElementById('optimizePrompt');
    const titleEl = document.getElementById('titlePrompt');

    // 如果文字框是空的，或者內容剛好是某個語系的預設提示詞，就跟著新語系連動切換
    if (isAnyDefaultPrompt(optimizeEl.value, 'optimize')) {
        optimizeEl.value = defaults.optimize;
    }
    if (isAnyDefaultPrompt(titleEl.value, 'title')) {
        titleEl.value = defaults.title;
    }

    // 更新佔位符
    optimizeEl.placeholder = defaults.optimize;
    titleEl.placeholder = defaults.title;
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

        const defaults = window.i18n.getDefaultPrompts(lang);
        const optimizeEl = document.getElementById('optimizePrompt');
        const titleEl = document.getElementById('titlePrompt');

        // 載入預設值
        optimizeEl.value = items.optimizePrompt || defaults.optimize;
        titleEl.value = items.titlePrompt || defaults.title;
        optimizeEl.placeholder = defaults.optimize;
        titleEl.placeholder = defaults.title;

        const apiKeyInput = document.getElementById('apiKey');
        const modelSelect = document.getElementById('model');
        const fetchBtn = document.getElementById('fetchModelsBtn');

        if (items.apiKey) {
            apiKeyInput.value = items.apiKey;
            modelSelect.disabled = false;
            fetchBtn.disabled = false;

            if (items.model) {
                const opt = document.createElement('option');
                opt.value = items.model;
                opt.textContent = items.model;
                modelSelect.appendChild(opt);
                modelSelect.value = items.model;
            }

            await fetchAndPopulateModels();
            if (items.model) modelSelect.value = items.model;
        }

        document.getElementById('translateLang').value = items.translateLang || 'English';
        document.getElementById('checkPrompt').value = items.checkPrompt || '';
        document.getElementById('enableDoubleConfirm').checked = items.enableDoubleConfirm !== false;
        document.getElementById('toggleApiKeyBtn').textContent = window.i18n.getMessage('opt_show', lang);
    });
}