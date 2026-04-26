// background/service-worker.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CALL_GEMINI_API') {
    handleGeminiRequest(request.prompt, request.content)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => {
        console.error('[MailPilot AI] API Error:', error);
        sendResponse({ success: false, error: error?.message || 'Unknown error' });
      });
    return true; // 保持異步通道
  }
});

async function readErrorMessage(response) {
  const fallback = `HTTP ${response.status}: API request failed`;

  try {
    const text = await response.text();
    if (!text) return fallback;

    try {
      const data = JSON.parse(text);
      return data?.error?.message || data?.message || fallback;
    } catch {
      return text.trim() || fallback;
    }
  } catch {
    return fallback;
  }
}

async function handleGeminiRequest(systemPrompt, userContent) {
  const { apiKey, model = 'gemini-2.0-flash' } = await chrome.storage.local.get(['apiKey', 'model']);
  if (!apiKey) throw new Error('API Key is missing. Please set it in options.');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    contents: [{
      parts: [
        { text: String(systemPrompt ?? '') },
        { text: "Input Text:\n" + String(userContent ?? '') }
      ]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
      .map(part => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim()
    : '';

  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Gemini blocked the request: ${blockReason}`);
    }
    throw new Error('Invalid response format from Gemini API');
  }

  return text;
}