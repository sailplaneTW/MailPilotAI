/**
 * content_scripts/send-guard.js
 * Implements:
 * 1. Double-confirm mechanism for the Gmail Send button.
 * 2. Optional auto email check before send (using the check prompt via Gemini API).
 */
(() => {
  if (window.__mailpilotSendGuardInstalled) return;
  window.__mailpilotSendGuardInstalled = true;

  const { storageGet, getUILanguage } = window.MailPilotUtils;
  const I18N = window.i18n;

  let uiLang = 'en';

  // Initial language load
  getUILanguage().then(lang => { uiLang = lang; });

  // Sync language changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.uiLang) uiLang = changes.uiLang.newValue || 'en';
  });

  const t = (key) => I18N.getMessage(key, uiLang);

  // --- Per-button state ---
  // Each send button gets its own state object to support multiple compose windows.
  const btnState = new WeakMap();

  function getState(btn) {
    if (!btnState.has(btn)) {
      btnState.set(btn, { armed: false, checking: false, timer: null });
    }
    return btnState.get(btn);
  }

  /**
   * Extract text from the compose body nearest to the send button.
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
   * Show check result in the compose window area (create a temporary notice).
   */
  function showCheckResult(sendBtn, resultText, isError = false) {
    // Remove any existing notice first
    const composeWin = sendBtn.closest('[role="dialog"], .M9');
    if (!composeWin) return;
    const existing = composeWin.querySelector('.mp-check-notice');
    if (existing) existing.remove();

    const notice = document.createElement('div');
    notice.className = 'mp-check-notice';
    Object.assign(notice.style, {
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      maxWidth: '380px',
      padding: '12px 16px',
      backgroundColor: isError ? '#fce8e6' : '#e6f4ea',
      color: isError ? '#d93025' : '#188038',
      border: `1px solid ${isError ? '#f5c6c2' : '#b7dfbf'}`,
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      zIndex: '9999999',
      fontSize: '13px',
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap',
      fontFamily: 'Google Sans, system-ui, sans-serif'
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      float: 'right', background: 'none', border: 'none',
      cursor: 'pointer', fontSize: '14px', marginLeft: '8px',
      color: isError ? '#d93025' : '#188038'
    });
    closeBtn.onclick = () => notice.remove();

    notice.append(closeBtn);
    notice.append(document.createTextNode(resultText));
    document.body.appendChild(notice);

    // Auto-remove after 30 seconds
    setTimeout(() => notice.remove(), 30000);
  }

  /**
   * Run the Gemini check prompt and display the result.
   * Returns a Promise that resolves when the check is complete.
   */
  async function runAutoCheck(sendBtn, settings) {
    const text = extractComposeText(sendBtn);
    if (!text) return; // Nothing to check

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'CALL_GEMINI_API', prompt: settings.checkPrompt, content: text },
        (response) => {
          if (response && response.success) {
            showCheckResult(sendBtn, `🔍 ${t('title_check_result')}\n\n${response.data.trim()}`);
          } else {
            showCheckResult(sendBtn, `${t('msg_error_api')}${response?.error || 'Unknown error'}`, true);
          }
          resolve();
        }
      );
    });
  }

  /**
   * Handle send button click.
   * Flow:
   *   1. If autoCheck is on and checkPrompt exists:
   *      - First click: run check (block send until done), show result.
   *      - Second click (after check): arm for double-confirm.
   *      - Third click: actually send.
   *   2. If only doubleConfirm is on:
   *      - First click: arm, change button to warning.
   *      - Second click: send.
   *   3. Otherwise: let the click through.
   */
  async function handleSendClick(e) {
    const settings = await storageGet(['enableDoubleConfirm', 'enableAutoCheck', 'checkPrompt']);
    const { enableDoubleConfirm, enableAutoCheck, checkPrompt } = settings;
    const shouldAutoCheck = enableAutoCheck && !!checkPrompt;
    const shouldDoubleConfirm = enableDoubleConfirm !== false;

    if (!shouldAutoCheck && !shouldDoubleConfirm) return; // All guards off

    const btn = e.currentTarget;
    const state = getState(btn);

    // --- Phase: currently running auto-check ---
    if (state.checking) {
      // Block any clicks while check is in progress
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // --- Phase: already armed for double-confirm ---
    if (state.armed) {
      state.armed = false;
      if (state.timer) clearTimeout(state.timer);
      // Let the click proceed
      return;
    }

    // --- Phase: first click ---
    e.preventDefault();
    e.stopPropagation();

    const originalLabel = btn.textContent;
    const originalColor = btn.style.backgroundColor;

    if (shouldAutoCheck) {
      // Show checking state — block further clicks
      state.checking = true;
      btn.textContent = t('guard_checking');
      btn.style.backgroundColor = '#f29900'; // Amber

      await runAutoCheck(btn, settings);

      state.checking = false;
      btn.textContent = originalLabel;
      btn.style.backgroundColor = originalColor;

      // After check, arm for double-confirm (user must click again to confirm send)
      state.armed = true;
      btn.textContent = t('guard_warning');
      btn.style.backgroundColor = '#d93025';

      state.timer = setTimeout(() => {
        state.armed = false;
        btn.textContent = originalLabel;
        btn.style.backgroundColor = originalColor;
      }, 10000); // 10-second window after check result

    } else if (shouldDoubleConfirm) {
      // Standard double-confirm only
      state.armed = true;
      btn.textContent = t('guard_warning');
      btn.style.backgroundColor = '#d93025';

      state.timer = setTimeout(() => {
        state.armed = false;
        btn.textContent = originalLabel;
        btn.style.backgroundColor = originalColor;
      }, 5000);
    }
  }

  /**
   * Scan for Gmail send buttons and attach the listener.
   */
  function scanAndGuard() {
    const sendButtons = document.querySelectorAll(
      '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3, [aria-label*="Send"], [role="button"][data-tooltip*="Send"]'
    );
    sendButtons.forEach(btn => {
      if (btn.hasAttribute('data-mailpilot-guarded')) return;
      btn.setAttribute('data-mailpilot-guarded', '1');
      btn.addEventListener('click', handleSendClick, true); // Capture phase to intercept before Gmail
    });
  }

  setInterval(scanAndGuard, 1000);
})();