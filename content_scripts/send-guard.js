/**
 * content_scripts/send-guard.js
 * Implements:
 * 1. Double-confirm mechanism for the Gmail Send button.
 * 2. Optional auto email check before send (using the check prompt via Gemini API).
 *
 * IMPORTANT: e.preventDefault() / e.stopPropagation() MUST be called synchronously
 * at the top of the handler.
 * Calling them after an `await` has no effect because
 * the browser processes the original event before the microtask resumes.
 * We use a `state.allowSend` flag to programmatically re-trigger the click when ready.
 */
(() => {
  if (window.__mailpilotSendGuardInstalled) return;
  window.__mailpilotSendGuardInstalled = true;

  const { storageGet, getUILanguage } = window.MailPilotUtils;
  const I18N = window.i18n;

  let uiLang = 'en';
  getUILanguage().then(lang => { uiLang = lang; });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.uiLang) uiLang = changes.uiLang.newValue || 'en';
  });

  const t = (key) => I18N.getMessage(key, uiLang);

  // Per-button state using WeakMap
  const btnState = new WeakMap();
  function getState(btn) {
    if (!btnState.has(btn)) {
      btnState.set(btn, {
        armed: false,       // Waiting for second click to confirm send
        checking: false,    // AI check is in progress
        allowSend: false,   // Set true to let the next programmatic click through
        timer: null
      });
    }
    return btnState.get(btn);
  }

  /**
   * Extract compose body text from the compose window nearest to the button.
   */
  function extractComposeText(sendBtn) {
    const composeWin = sendBtn.closest('[role="dialog"], .M9');
    if (!composeWin) return '';
    const body = composeWin.querySelector('div[contenteditable="true"]');
    if (!body) return '';

    const clone = body.cloneNode(true);
    clone.querySelectorAll('.gmail_signature, [data-smartmail="gmail_signature"], .gmail_quote, blockquote')
      .forEach(el => el.remove());
    return (clone.innerText || clone.textContent || '').trim();
  }

  /**
   * Show a floating notice near the send area with the AI check result.
   */
  function showCheckResult(resultText, isError = false) {
    document.querySelectorAll('.mp-check-notice').forEach(el => el.remove());

    // 1. 最外層容器：嚴格限制尺寸與隱藏溢出
    const notice = document.createElement('div');
    notice.className = 'mp-check-notice';
    Object.assign(notice.style, {
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      width: '400px',
      maxWidth: '90vw',    // 增加響應式防呆，避免小螢幕破版
      maxHeight: '60vh',   // 限制最大高度
      display: 'flex',     // 啟用 Flexbox 排版
      flexDirection: 'column',
      backgroundColor: isError ? '#fce8e6' : '#e6f4ea',
      border: `1px solid ${isError ? '#f5c6c2' : '#b7dfbf'}`,
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      zIndex: '9999999',
      fontFamily: 'Google Sans, system-ui, sans-serif',
      overflow: 'hidden'   // [關鍵] 絕對不允許超出這個圓角框
    });

    // 2. 頂部標題列：包含標題與關閉按鈕，不隨捲動移動
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 16px',
      borderBottom: `1px solid ${isError ? '#f5c6c2' : '#b7dfbf'}`,
      fontWeight: 'bold',
      fontSize: '14px',
      color: isError ? '#d93025' : '#188038',
      flexShrink: '0',     // [關鍵] 確保標題列不會被捲動區擠壓
      backgroundColor: isError ? '#fce8e6' : '#e6f4ea'
    });

    const titleLabel = document.createElement('span');
    titleLabel.textContent = isError ? '❌ 檢查失敗' : '🔍 檢查結果';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontSize: '16px',
      color: isError ? '#d93025' : '#188038',
      padding: '0'
    });
    closeBtn.onclick = () => notice.remove();

    header.appendChild(titleLabel);
    header.appendChild(closeBtn);

    // 3. 內容捲動區：負責處理長文字
    const content = document.createElement('div');
    Object.assign(content.style, {
      padding: '12px 16px',
      overflowY: 'auto',   // [關鍵] 這裡才是真正產生垂直捲軸的地方
      fontSize: '13px',
      lineHeight: '1.6',
      color: isError ? '#d93025' : '#188038',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      flex: '1 1 auto'     // [關鍵] 填滿外層剩下的空間
    });

    // 移除原有字串前面的標題，避免重複顯示 (因為已經在 header 顯示過了)
    const cleanText = resultText.replace(/^🔍 .*?\n\n/, '');
    content.textContent = cleanText;

    notice.appendChild(header);
    notice.appendChild(content);
    document.body.appendChild(notice);
  }

  /**
   * Run the AI email check via the background service worker.
   * Returns a Promise that resolves when the check is complete.
   */
  function runAutoCheck(sendBtn, checkPrompt) {
    const text = extractComposeText(sendBtn);
    if (!text) return Promise.resolve();

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'CALL_GEMINI_API', prompt: checkPrompt, content: text },
        (response) => {
          if (response?.success) {
            showCheckResult(`🔍 ${t('title_check_result')}\n\n${response.data.trim()}`);
          } else {
            showCheckResult(`${t('msg_error_api')}${response?.error || 'Unknown error'}`, true);
          }
          resolve();
        }
      );
    });
  }

  /**
   * Reset a button to its original appearance.
   */
  function resetBtn(btn, label, color, state) {
    btn.textContent = label;
    btn.style.backgroundColor = color;
    btn.disabled = false;

    state.armed = false;
    state.checking = false;
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
  }

  /**
   * The core send intercept handler.
   *
   * MUST synchronously call preventDefault/stopPropagation FIRST,
   * then handle async logic, and finally re-trigger via btn.click()
   * when ready to actually send.
   */
  function handleSendClick(e) {
    const btn = e.currentTarget;
    const state = getState(btn);

    // --- Passthrough: we programmatically triggered this click to actually send ---
    if (state.allowSend) {
      state.allowSend = false;
      return; // Let it proceed normally
    }

    // --- MUST intercept synchronously before any async work ---
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // --- Block if AI check is still in progress ---
    if (state.checking) return;

    // --- Second click while armed: confirm and send ---
    if (state.armed) {
      if (state.timer) { clearTimeout(state.timer); state.timer = null; }
      state.armed = false;
      state.allowSend = true;
      btn.click(); // Programmatically re-trigger — will pass through via allowSend flag
      return;
    }

    // --- First click: load settings then decide flow ---
    storageGet(['enableDoubleConfirm', 'enableAutoCheck', 'checkPrompt']).then(settings => {
      const { enableDoubleConfirm, enableAutoCheck, checkPrompt } = settings;
      const shouldAutoCheck = enableAutoCheck && !!checkPrompt;
      const shouldDoubleConfirm = enableDoubleConfirm !== false;

      if (!shouldAutoCheck && !shouldDoubleConfirm) {
        // No guards active — send immediately
        state.allowSend = true;
        btn.click();
        return;
      }

      const originalLabel = btn.textContent;
      const originalColor = btn.style.backgroundColor;

      if (shouldAutoCheck) {
        // Phase 1: Run AI check, block send
        state.checking = true;
        btn.textContent = t('guard_checking');
        btn.style.backgroundColor = '#f29900'; // Amber
        btn.disabled = true;

        runAutoCheck(btn, checkPrompt).then(() => {
          state.checking = false;

          // Phase 2: Arm for double-confirm after check
          state.armed = true;
          btn.textContent = t('guard_warning');
          btn.style.backgroundColor = '#d93025';
          btn.disabled = false;

          state.timer = setTimeout(() => {
            resetBtn(btn, originalLabel, originalColor, state);
          }, 10000);
        });

      } else {
        // Standard double-confirm only
        state.armed = true;
        btn.textContent = t('guard_warning');
        btn.style.backgroundColor = '#d93025';

        state.timer = setTimeout(() => {
          resetBtn(btn, originalLabel, originalColor, state);
        }, 5000);
      }
    });
  }

  /**
   * Scan for Gmail send buttons and attach the capture-phase listener.
   */
  function scanAndGuard() {
    const sendButtons = document.querySelectorAll(
      '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3, [aria-label*="Send"], [role="button"][data-tooltip*="Send"]'
    );

    sendButtons.forEach(btn => {
      if (btn.hasAttribute('data-mailpilot-guarded')) return;
      btn.setAttribute('data-mailpilot-guarded', '1');
      btn.addEventListener('click', handleSendClick, true); // Capture phase
    });
  }

  setInterval(scanAndGuard, 1000);
})();