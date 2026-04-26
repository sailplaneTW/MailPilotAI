// options/options.js

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
        if (apiKey.length > 20) {
            fetchAndPopulateModels(false);
        }
    }, 800);
});

function isCloudLanguageModel(model) {
    const id = model.name.toLowerCase();

    // 必須支援 generateContent
    if (!model.supportedGenerationMethods.includes('generateContent')) return false;

    // 排除地端模型（Gemma 系列）
    if (id.includes('gemma')) return false;

    // 排除 TTS（語音合成）模型
    if (id.includes('tts')) return false;

    // 排除圖像生成 / 視覺模型
    if (id.includes('image') || id.includes('vision') || id.includes('imagen')) return false;

    // 排除嵌入向量模型
    if (id.includes('embed') || id.includes('embedding')) return false;

    // 排除 AQA 問答檢索模型
    if (id.includes('aqa')) return false;

    return true;
}

async function getGeminiLLMModels(apiKey, showAlert = false) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.models.filter(isCloudLanguageModel);
    } catch (error) {
        console.error("無法取得模型清單:", error);
        if (showAlert) alert("無法取得模型清單: " + error.message);
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
    const systemPrompt = document.getElementById('systemPrompt').value;
    const enableDoubleConfirm = document.getElementById('enableDoubleConfirm').checked;

    chrome.storage.local.set(
        { apiKey, model, systemPrompt, enableDoubleConfirm },
        () => {
            const status = document.getElementById('status');
            status.textContent = 'Settings saved!';
            setTimeout(() => { status.textContent = ''; }, 2000);
        }
    );
}

function restoreOptions() {
    chrome.storage.local.get(
        ['apiKey', 'model', 'systemPrompt', 'enableDoubleConfirm'],
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
                document.getElementById('model').value = items.model;
            }

            if (items.systemPrompt) document.getElementById('systemPrompt').value = items.systemPrompt;
            if (items.enableDoubleConfirm !== undefined) {
                document.getElementById('enableDoubleConfirm').checked = items.enableDoubleConfirm;
            }
        }
    );
}