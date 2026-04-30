/**
 * background/service-worker.js
 * Central message hub and API handler for MailPilot AI.
 */

/**
 * Message Dispatcher
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CALL_GEMINI_API') {
    handleGeminiRequest(request.prompt, request.content)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => {
        console.error('[MailPilot AI] API Error:', error);
        sendResponse({ success: false, error: error?.message || 'Unknown API Error' });
      });
    return true; // Keep async channel open
  }

  if (request.action === 'OPEN_OPTIONS_PAGE') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  }
});

/**
 * Parses detailed error messages from Google API responses
 */
async function parseErrorResponse(response) {
  const defaultMsg = `HTTP ${response.status}: Request failed`;
  try {
    const text = await response.text();
    if (!text) return defaultMsg;
    const json = JSON.parse(text);
    return json?.error?.message || json?.message || text.trim() || defaultMsg;
  } catch {
    return defaultMsg;
  }
}

/**
 * Executes a request to the Gemini API
 */
async function handleGeminiRequest(systemPrompt, userContent) {
  const { apiKey, model = 'gemini-1.5-flash' } = await chrome.storage.local.get(['apiKey', 'model']);
  
  if (!apiKey) {
    throw new Error('API Key is missing. Please configure it in the extension settings.');
  }

  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  const endpoint = `${baseUrl}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    contents: [{
      parts: [
        { text: `System Instruction: ${String(systemPrompt ?? '')}` },
        { text: `User Email Content:\n${String(userContent ?? '')}` }
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
    const errorDetail = await parseErrorResponse(response);
    throw new Error(errorDetail);
  }

  const data = await response.json();
  
  // Extract text from candidates
  const parts = data?.candidates?.[0]?.content?.parts;
  const resultText = Array.isArray(parts)
    ? parts.map(p => (typeof p?.text === 'string' ? p.text : '')).join('').trim()
    : '';

  if (!resultText) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`Request blocked by safety filters: ${blockReason}`);
    throw new Error('Empty or invalid response from Gemini.');
  }

  return resultText;
}