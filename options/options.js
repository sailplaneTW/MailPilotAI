// options/options.js

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);
document.getElementById('fetchModelsBtn').addEventListener('click', () => fetchAndPopulateModels(true));
document.getElementById('uiLang').addEventListener('change', (e) => applyI18n(e.target.value));

function applyI18n(lang) {
    document.title = window.i18n.getMessage('opt_title', lang);
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = window.i18n.getMessage(key, lang);
    });

    const optEl = document.getElementById('optimizePrompt');
    const titleEl = document.getElementById('titlePrompt');
    
    const knownOptDefaults = [
        ...['en', 'zh_TW', 'zh_CN'].map(l => window.i18n.getDefaultPrompts(l).optimize),
        "You are a professional email assistant. Please rewrite the following email to be clear, polite, and professional.",
        "請以商業 email 的慣例邏輯，替我改寫內文。不用過度客氣但請要有禮貌，也刪除不必要的冗字",
        "请以商业 email 的惯例逻辑，替我改写正文。不用过度客气但请要有礼貌，也删除不必要的冗字",
        "請依據商務 Email 溝通慣例改寫以下內容。語氣需專業禮貌且邏輯清晰，請刪除不必要的贅字與過度客套的修辭，直接切入重點。輸出時僅需提供改寫後的內文（不含標題），以便我直接貼上使用。字數請在 1500 字內。",
        "请依据商务 Email 沟通惯例改写以下内容。语气需专业礼貌且逻辑清晰，请删除不必要的赘字与过度客套的修辞，直接切入重点。输出时仅需提供改写后的内文（不含标题），以便我直接贴上使用。字数请在 1500 字内。",
        "Please rewrite the following content according to business email communication conventions. The tone should be professional, polite, and logically clear. Please remove unnecessary words and overly polite rhetoric, and get straight to the point. When submitting your email, only provide the rewritten body text (excluding the title) so I can use it directly. Please keep the word count under 1500 words."
    ];

    // Check if current value matches ANY language's default prompt (including old versions)
    const isDefaultOpt = knownOptDefaults.some(d => optEl.value.trim() === d.trim());
    if (isDefaultOpt || optEl.value.trim() === '') {
        optEl.value = window.i18n.getDefaultPrompts(lang).optimize;
    }

    const isDefaultTitle = ['en', 'zh_TW', 'zh_CN'].some(l => titleEl.value.trim() === window.i18n.getDefaultPrompts(l).title);
    if (isDefaultTitle || titleEl.value.trim() === '') {
        titleEl.value = window.i18n.getDefaultPrompts(lang).title;
    }
}

let debounceTimer;
document.getElementById('apiKey').addEventListener('input', (e) => {
    const apiKey = e.target.value.trim();
    const modelSelect = document.getElementById('model');
    const fetchBtn = document.getElementById('fetchModelsBtn');

    if (!apiKey) {
        modelSelect.disabled = true;
        fetchBtn.disabled = true;
        return;
    }

    modelSelect.disabled = false;
    fetchBtn.disabled = false;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if (apiKey.length > 20) fetchAndPopulateModels(false);
    }, 800);
});

function isCloudLanguageModel(model) {
    const id = model.name.toLowerCase();
    if (!model.supportedGenerationMethods.includes('generateContent')) return false;
    if (id.includes('gemma')) return false;
    if (id.includes('tts')) return false;
    if (id.includes('image') || id.includes('vision') || id.includes('imagen')) return false;
    if (id.includes('embed') || id.includes('embedding')) return false;
    if (id.includes('aqa')) return false;
    return true;
}

async function getGeminiLLMModels(apiKey, showAlert = false) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.models.filter(isCloudLanguageModel);
    } catch (error) {
        console.error('Failed to fetch model list:', error);
        if (showAlert) alert('Failed to fetch model list: ' + error.message);
        return null;
    }
}

async function fetchAndPopulateModels(isManualClick = false) {
    const apiKey = document.getElementById('apiKey').value.trim();
    if (!apiKey) {
        if (isManualClick) alert('Please enter an API Key first.');
        return;
    }

    const fetchBtn = document.getElementById('fetchModelsBtn');
    const modelSelect = document.getElementById('model');
    const uiLang = document.getElementById('uiLang').value;

    fetchBtn.textContent = '...';
    fetchBtn.disabled = true;
    modelSelect.disabled = true;

    const models = await getGeminiLLMModels(apiKey, isManualClick);

    fetchBtn.textContent = window.i18n.getMessage('opt_update_models', uiLang);
    fetchBtn.disabled = false;
    modelSelect.disabled = false;

    if (models && models.length > 0) {
        const currentSelected = modelSelect.value;
        modelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            const modelId = model.name.replace('models/', '');
            option.value = modelId;
            option.textContent = `${model.displayName} (${modelId})`;
            modelSelect.appendChild(option);
        });
        if (Array.from(modelSelect.options).some(opt => opt.value === currentSelected)) {
            modelSelect.value = currentSelected;
        }
    }
}

function saveOptions() {
    const uiLang = document.getElementById('uiLang').value;
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('model').value;
    const optimizePrompt = document.getElementById('optimizePrompt').value.trim();
    const translateLang = document.getElementById('translateLang').value;
    const titlePrompt = document.getElementById('titlePrompt').value.trim();
    const checkPrompt = document.getElementById('checkPrompt').value.trim();
    const enableDoubleConfirm = document.getElementById('enableDoubleConfirm').checked;

    chrome.storage.local.set(
        { uiLang, apiKey, model, optimizePrompt, translateLang, titlePrompt, checkPrompt, enableDoubleConfirm },
        () => {
            const status = document.getElementById('status');
            status.textContent = window.i18n.getMessage('opt_saved', uiLang);
            setTimeout(() => { status.textContent = ''; }, 2000);
        }
    );
}

function restoreOptions() {
    chrome.storage.local.get(
        ['uiLang', 'apiKey', 'model', 'optimizePrompt', 'translateLang', 'titlePrompt', 'checkPrompt',
            'enableDoubleConfirm', 'systemPrompt' /* Backward compatibility */],
        async (items) => {
            const uiLang = items.uiLang || 'en';
            document.getElementById('uiLang').value = uiLang;
            applyI18n(uiLang);

            if (items.apiKey) {
                document.getElementById('apiKey').value = items.apiKey;
                document.getElementById('model').disabled = false;
                document.getElementById('fetchModelsBtn').disabled = false;
                await fetchAndPopulateModels(false);
            } else {
                document.getElementById('model').disabled = true;
                document.getElementById('fetchModelsBtn').disabled = true;
            }

            if (items.model) {
                const modelSelect = document.getElementById('model');
                if (!Array.from(modelSelect.options).some(opt => opt.value === items.model)) {
                    const option = document.createElement('option');
                    option.value = items.model;
                    option.textContent = items.model;
                    modelSelect.appendChild(option);
                }
                modelSelect.value = items.model;
            }

            const defaults = window.i18n.getDefaultPrompts(uiLang);

            // Backward compatibility for systemPrompt -> optimizePrompt
            const optimizeVal = items.optimizePrompt || items.systemPrompt || defaults.optimize;
            document.getElementById('optimizePrompt').value = optimizeVal;

            document.getElementById('translateLang').value = items.translateLang || 'English';
            document.getElementById('titlePrompt').value = items.titlePrompt || defaults.title;
            document.getElementById('checkPrompt').value = items.checkPrompt || '';

            if (items.enableDoubleConfirm !== undefined) {
                document.getElementById('enableDoubleConfirm').checked = items.enableDoubleConfirm;
            }
        }
    );
}