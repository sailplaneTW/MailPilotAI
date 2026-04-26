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
        if (apiKey.length > 20) { // Avoid spamming API on very short inputs
            fetchAndPopulateModels(false);
        }
    }, 800);
});

async function getGeminiLLMModels(apiKey, showAlert = false) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.models.filter(model =>
            model.supportedGenerationMethods.includes('generateContent')
        );
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
