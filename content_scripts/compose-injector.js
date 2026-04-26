// content_scripts/compose-injector.js

function initMailRefineUI(composeWindow) {
  const toolbar = composeWindow.querySelector('.btC'); // Gmail formatting toolbar area
  if (!toolbar) return;

  // Create UI Container
  const container = document.createElement('div');
  container.className = 'mailrefine-tools';
  container.style.display = 'inline-flex';
  container.style.gap = '8px';
  container.style.marginLeft = '12px';

  // Optimize Button
  const btnOptimize = document.createElement('button');
  btnOptimize.innerText = '✨ 優化內文';
  btnOptimize.style.cursor = 'pointer';

  // Backup Section
  const backupSection = document.createElement('details');
  backupSection.style.display = 'none';
  backupSection.innerHTML = `<summary>原始備份</summary><div class="backup-content"></div><button class="restore-btn">還原</button>`;

  toolbar.appendChild(container);
  container.appendChild(btnOptimize);
  composeWindow.appendChild(backupSection);

  let originalHTML = '';

  btnOptimize.addEventListener('click', async (e) => {
    e.preventDefault();
    const bodyArea = composeWindow.querySelector('div[contenteditable="true"]');
    if (!bodyArea) return;

    // Save backup (simplified version, F1 spec requires ignoring blockquotes/signatures)
    originalHTML = bodyArea.innerHTML;
    backupSection.querySelector('.backup-content').innerText = bodyArea.innerText;
    backupSection.style.display = 'block';

    btnOptimize.innerText = '⏳ 處理中...';
    btnOptimize.disabled = true;

    // Extract text safely (excluding blockquotes per spec)
    let textToProcess = extractEditableText(bodyArea);

    try {
      const { systemPrompt } = await chrome.storage.local.get(['systemPrompt']);
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'CALL_GEMINI_API',
          prompt: systemPrompt || "Please rewrite the following email professionally:",
          content: textToProcess
        }, resolve);
      });

      if (response.success) {
        // Safe replacement logic needed here (TreeWalker) to preserve attachments
        replaceTextSafely(bodyArea, response.data);
      } else {
        alert('MailRefine Error: ' + response.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      btnOptimize.innerText = '✨ 優化內文';
      btnOptimize.disabled = false;
    }
  });

  backupSection.querySelector('.restore-btn').addEventListener('click', (e) => {
    e.preventDefault();
    const bodyArea = composeWindow.querySelector('div[contenteditable="true"]');
    if (bodyArea && originalHTML) {
      bodyArea.innerHTML = originalHTML;
      backupSection.style.display = 'none';
    }
  });
}

// Helper: Extract text without signatures/quotes
function extractEditableText(bodyElement) {
  // TODO: Implement DOM filtering (ignore .gmail_signature, blockquote)
  // For MVP, returning innerText
  return bodyElement.innerText;
}

// Helper: Replace text without destroying image/attachment tags
function replaceTextSafely(bodyElement, newText) {
  // TODO: Implement TreeWalker to replace text nodes only
  // Fallback for MVP
  bodyElement.innerText = newText;
}
