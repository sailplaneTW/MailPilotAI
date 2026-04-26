// background/service-worker.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CALL_GEMINI_API') {
    handleGeminiRequest(request.prompt, request.content)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Indicates asynchronous response
  }
});

async function handleGeminiRequest(systemPrompt, userContent) {
  const { apiKey, model = 'gemini-2.0-flash' } = await chrome.storage.local.get(['apiKey', 'model']);

  if (!apiKey) {
    throw new Error('API Key is missing. Please set it in options.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [
        { text: systemPrompt },
        { text: "\n\nContent to process:\n" + userContent }
      ]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'API request failed');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
