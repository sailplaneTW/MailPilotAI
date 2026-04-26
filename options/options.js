// options/options.js

const DEFAULTS = {
    optimizePrompt: '請以商業 email 的慣例邏輯，替我改寫內文。不用過度客氣但請要有禮貌，也刪除不必要的冗字',
    translateLang: '英文',
    titlePrompt: '請根據內文的內容及語系替我產生信件標題',
    checkPrompt: '',
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);
document.getElementById('fetchModelsBtn').addEventListener('click', () => fetchAndPopulateModels(true));

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
        console.error('無法取得模型清單:', error);
        if (showAlert) alert('無法取得模型清單: ' + error.message);
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
    fetchBtn.textContent = 'Loading...';
    fetchBtn.disabled = true;
    modelSelect.disabled = true;

    const models = await getGeminiLLMModels(apiKey, isManualClick);

    fetchBtn.textContent = 'Update Models';
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
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('model').value;
    const optimizePrompt = document.getElementById('optimizePrompt').value.trim() || DEFAULTS.optimizePrompt;
    const translateLang = document.getElementById('translateLang').value;
    const titlePrompt = document.getElementById('titlePrompt').value.trim() || DEFAULTS.titlePrompt;
    const checkPrompt = document.getElementById('checkPrompt').value.trim();
    const enableDoubleConfirm = document.getElementById('enableDoubleConfirm').checked;

    chrome.storage.local.set(
        { apiKey, model, optimizePrompt, translateLang, titlePrompt, checkPrompt, enableDoubleConfirm },
        () => {
            const status = document.getElementById('status');
            status.textContent = 'Settings saved!';
            setTimeout(() => { status.textContent = ''; }, 2000);
        }
    );
}

function restoreOptions() {
    chrome.storage.local.get(
        ['apiKey', 'model', 'optimizePrompt', 'translateLang', 'titlePrompt', 'checkPrompt',
            'enableDoubleConfirm', 'systemPrompt' /* 舊版相容 */],
        async (items) => {
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

            // 舊版 systemPrompt → 新版 optimizePrompt 相容
            const optimizeVal = items.optimizePrompt || items.systemPrompt || DEFAULTS.optimizePrompt;
            document.getElementById('optimizePrompt').value = optimizeVal;
            document.getElementById('translateLang').value = items.translateLang || DEFAULTS.translateLang;
            document.getElementById('titlePrompt').value = items.titlePrompt || DEFAULTS.titlePrompt;
            document.getElementById('checkPrompt').value = items.checkPrompt || DEFAULTS.checkPrompt;

            if (items.enableDoubleConfirm !== undefined) {
                document.getElementById('enableDoubleConfirm').checked = items.enableDoubleConfirm;
            }
        }
    );
}