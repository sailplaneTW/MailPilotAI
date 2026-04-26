// options/options.js

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);

async function fetchAndPopulateModels() {
    const apiKey = document.getElementById('apiKey').value.trim();
    if (!apiKey || apiKey.length < 10) return;

    const btn = document.getElementById('fetchModelsBtn');
    btn.textContent = '...';

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        const modelSelect = document.getElementById('model');
        modelSelect.innerHTML = '';

        const models = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent') && !m.name.includes('gemma'));

        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name.split('/').pop();
            opt.textContent = m.displayName;
            modelSelect.appendChild(opt);
        });
        modelSelect.disabled = false;
        btn.textContent = 'Update Success';
    } catch (e) {
        btn.textContent = 'Fetch Failed';
    }
}

document.getElementById('apiKey').addEventListener('blur', fetchAndPopulateModels);
document.getElementById('fetchModelsBtn').addEventListener('click', fetchAndPopulateModels);

function saveOptions() {
    const data = {
        uiLang: document.getElementById('uiLang').value,
        apiKey: document.getElementById('apiKey').value,
        model: document.getElementById('model').value,
        optimizePrompt: document.getElementById('optimizePrompt').value,
        translateLang: document.getElementById('translateLang').value,
        titlePrompt: document.getElementById('titlePrompt').value,
        checkPrompt: document.getElementById('checkPrompt').value,
        enableDoubleConfirm: document.getElementById('enableDoubleConfirm').checked
    };

    chrome.storage.local.set(data, () => {
        const status = document.getElementById('status');
        status.textContent = 'Saved!';
        setTimeout(() => status.textContent = '', 2000);
    });
}

function restoreOptions() {
    chrome.storage.local.get(null, (items) => {
        if (items.uiLang) document.getElementById('uiLang').value = items.uiLang;
        if (items.apiKey) document.getElementById('apiKey').value = items.apiKey;
        if (items.model) {
            const opt = document.createElement('option');
            opt.value = items.model;
            opt.textContent = items.model;
            document.getElementById('model').appendChild(opt);
            document.getElementById('model').value = items.model;
        }
        document.getElementById('optimizePrompt').value = items.optimizePrompt || '';
        document.getElementById('translateLang').value = items.translateLang || 'English';
        document.getElementById('titlePrompt').value = items.titlePrompt || '';
        document.getElementById('checkPrompt').value = items.checkPrompt || '';
        document.getElementById('enableDoubleConfirm').checked = items.enableDoubleConfirm !== false;
    });
}