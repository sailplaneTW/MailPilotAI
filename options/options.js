// options/options.js

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);
document.getElementById('fetchModelsBtn').addEventListener('click', () => fetchAndPopulateModels(true));

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
    const apiKey = document.getElementById('apiKey').value;
    if (!apiKey) {
        if (isManualClick) alert('Please enter an API Key first.');
        return;
    }

    const fetchBtn = document.getElementById('fetchModelsBtn');
    fetchBtn.textContent = 'Loading...';
    fetchBtn.disabled = true;

    const models = await getGeminiLLMModels(apiKey, isManualClick);

    fetchBtn.textContent = 'Fetch Models';
    fetchBtn.disabled = false;

    if (models && models.length > 0) {
        const modelSelect = document.getElementById('model');
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
  const apiKey = document.getElementById('apiKey').value;
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
          await fetchAndPopulateModels(false);
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
