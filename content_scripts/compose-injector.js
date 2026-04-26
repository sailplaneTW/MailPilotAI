// content_scripts/compose-injector.js
(() => {
  if (window.__mailpilotComposeInjectorInstalled) return;
  window.__mailpilotComposeInjectorInstalled = true;

  // 確保能正確取得 i18n 工具 
  const getI18n = () => window.i18n || {
    getMessage: (k) => k,
    getDefaultPrompts: () => ({ optimize: '', title: '' })
  };

  const COMPOSE_SELECTORS = '[role="dialog"], .M9';
  const BODY_SELECTOR = 'div[contenteditable="true"]';
  const SUBJECT_SELECTORS = 'input[name="subjectbox"], input[placeholder*="Subject"], input[aria-label*="Subject"], input[placeholder*="主旨"]';
  const DATA_INJECTED = 'data-mailpilot-injected';

  // ── Utilities ───────────────────────────────────────────
  function getComposeBody(composeEl) {
    return composeEl.querySelector(BODY_SELECTOR);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function removeCommonModelDecorations(text) {
    let out = String(text ?? '').replace(/\r\n/g, '\n').trim();
    out = out.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    const quotePairs = [['"', '"'], ['“', '”'], ['‘', '’'], ['「', '」'], ['『', '』'], ['«', '»']];
    for (const [open, close] of quotePairs) {
      if (out.startsWith(open) && out.endsWith(close) && out.length >= 2) {
        out = out.slice(open.length, out.length - close.length).trim();
        break;
      }
    }
    return out;
  }

  function modelTextToGmailHtml(newText) {
    const clean = removeCommonModelDecorations(newText);
    return clean.split('\n').map(line => {
      return line.trim() === '' ? '<div><br></div>' : `<div>${escapeHtml(line)}</div>`;
    }).join('');
  }

  function dispatchComposeUpdate(bodyEl) {
    try {
      bodyEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: null }));
    } catch {
      bodyEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    bodyEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function extractText(bodyEl) {
    const clone = bodyEl.cloneNode(true);
    clone.querySelectorAll('.gmail_signature, [data-smartmail="gmail_signature"], .gmail_quote, blockquote')
      .forEach(el => el.remove());
    return (clone.innerText || clone.textContent || '').trim();
  }

  function replaceTextSafely(bodyEl, newText) {
    const preservedSelectors = '.gmail_signature, [data-smartmail="gmail_signature"], .gmail_quote, blockquote';
    const preserved = [];
    bodyEl.querySelectorAll(preservedSelectors).forEach(el => {
      let isNested = false;
      let parent = el.parentElement;
      while (parent && parent !== bodyEl) {
        if (parent.matches && parent.matches(preservedSelectors)) {
          isNested = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!isNested) preserved.push(el);
    });
    preserved.forEach(el => el.remove());
    bodyEl.innerHTML = modelTextToGmailHtml(newText);
    preserved.forEach(el => bodyEl.appendChild(el));
    dispatchComposeUpdate(bodyEl);
  }

  function setInputValue(inputEl, value) {
    inputEl.value = value;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function getLang() {
    return new Promise(resolve => {
      chrome.storage.local.get(['uiLang'], data => resolve(data.uiLang || 'en'));
    });
  }

  // ── Floating Panel ──────────────────────────────────────
  let popup = null;
  let minimizeBtn = null;
  let currentCompose = null;
  let popupPromise = null;
  let activeBackupSnapshot = null;

  function clearMsg(msgArea) {
    msgArea.innerHTML = '';
    msgArea.style.maxHeight = '0';
    msgArea.style.padding = '0 14px';
  }

  function clearBackup(backupArea) {
    backupArea.innerHTML = '';
    backupArea.style.maxHeight = '0';
    backupArea.style.padding = '0 14px';
  }

  function dispatchRestoreSnapshot(snapshot, showMsg, t, backupArea) {
    const { bodyEl, html } = snapshot || {};
    if (!bodyEl || !bodyEl.isConnected) {
      showMsg(t('msg_error_restore_lost'), 'error');
      return;
    }
    bodyEl.innerHTML = html;
    dispatchComposeUpdate(bodyEl);
    showMsg(t('msg_restore_done'), 'success');
    clearBackup(backupArea);
  }

  function createPopup() {
    if (popup) return Promise.resolve();
    if (popupPromise) return popupPromise;

    popupPromise = (async () => {
      try {
        const lang = await getLang();
        const I18N = getI18n(); // 取得最新的 i18n 工具 
        const t = (key) => I18N.getMessage(key, lang);

        popup = document.createElement('div');
        popup.id = 'mailpilot-popup';

        const w = 320;
        const initialLeft = Math.max(20, window.innerWidth - w - 40);
        const initialTop = 100;

        Object.assign(popup.style, {
          position: 'fixed',
          width: `${w}px`,
          left: `${initialLeft}px`,
          top: `${initialTop}px`,
          backgroundColor: '#fff',
          border: '1px solid #dadce0',
          borderRadius: '14px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
          zIndex: '999999',
          fontFamily: 'Google Sans, system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, {
          padding: '10px 12px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #e8eaed',
          cursor: 'grab',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none'
        });

        const titleWrap = document.createElement('div');
        const titleSpan = document.createElement('div');
        titleSpan.textContent = t('ui_header');
        Object.assign(titleSpan.style, { fontWeight: '700', color: '#202124' });
        titleWrap.append(titleSpan);

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&#8722;';
        Object.assign(closeBtn.style, { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' });
        header.append(titleWrap, closeBtn);

        // Button Grid
        const btnGrid = document.createElement('div');
        Object.assign(btnGrid.style, {
          padding: '12px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px'
        });

        const makeBtn = (label, bgColor) => {
          const btn = document.createElement('button');
          btn.textContent = label;
          Object.assign(btn.style, {
            padding: '8px 4px',
            backgroundColor: bgColor,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '12px'
          });
          return btn;
        };

        const btnOptimize = makeBtn(t('btn_optimize'), '#1a73e8');
        const btnTranslate = makeBtn(t('btn_translate'), '#34a853');
        const btnTitle = makeBtn(t('btn_title'), '#fbbc05');
        const btnCheck = makeBtn(t('btn_check'), '#ea4335');
        btnGrid.append(btnOptimize, btnTranslate, btnTitle, btnCheck);

        // Listen for language changes dynamically
        chrome.storage.onChanged.addListener((changes) => {
          if (changes.uiLang) {
            const newLang = changes.uiLang.newValue || 'en';
            const newT = (key) => I18N.getMessage(key, newLang);
            titleSpan.textContent = newT('ui_header');
            btnOptimize.textContent = newT('btn_optimize');
            btnTranslate.textContent = newT('btn_translate');
            btnTitle.textContent = newT('btn_title');
            btnCheck.textContent = newT('btn_check');
          }
        });

        const msgArea = document.createElement('div');
        const backupArea = document.createElement('div');
        Object.assign(msgArea.style, { overflow: 'hidden', transition: 'max-height 0.2s', fontSize: '12px' });

        popup.append(header, btnGrid, msgArea, backupArea);
        document.body.appendChild(popup);

        // Action Handler
        const handleAction = async (type) => {
          if (!currentCompose) return;
          const body = getComposeBody(currentCompose);
          const text = extractText(body);
          if (!text) return;

          const backupSnapshot = { bodyEl: body, html: body.innerHTML, text };
          const settings = await chrome.storage.local.get(['optimizePrompt', 'titlePrompt', 'checkPrompt', 'translateLang']);

          let prompt = '';
          if (type === 'optimize') prompt = settings.optimizePrompt || I18N.getDefaultPrompts(lang).optimize;
          else if (type === 'title') prompt = settings.titlePrompt || I18N.getDefaultPrompts(lang).title;
          else if (type === 'translate') prompt = `Translate to ${settings.translateLang || 'English'}`;

          chrome.runtime.sendMessage({ action: 'CALL_GEMINI_API', prompt, content: text }, response => {
            if (response.success) {
              const output = removeCommonModelDecorations(response.data);
              if (type === 'title') {
                const subjectInput = currentCompose.querySelector(SUBJECT_SELECTORS);
                if (subjectInput) setInputValue(subjectInput, normalizeTitle(output));
              } else {
                replaceTextSafely(body, output);
                activeBackupSnapshot = backupSnapshot;
              }
            }
          });
        };

        btnOptimize.addEventListener('click', () => handleAction('optimize'));
        btnTranslate.addEventListener('click', () => handleAction('translate'));
        btnTitle.addEventListener('click', () => handleAction('title'));
        btnCheck.addEventListener('click', () => handleAction('check'));

        closeBtn.addEventListener('click', () => { popup.style.display = 'none'; });

      } catch (err) {
        console.error('[MailPilot] Popup creation failed:', err);
      } finally {
        popupPromise = null;
      }
    })();
    return popupPromise;
  }

  function normalizeTitle(text) {
    return removeCommonModelDecorations(text).replace(/\s+/g, ' ').trim();
  }

  function scanComposeWindows() {
    const candidates = document.querySelectorAll(COMPOSE_SELECTORS);
    candidates.forEach(win => {
      if (win.hasAttribute(DATA_INJECTED)) return;
      const body = win.querySelector(BODY_SELECTOR);
      if (!body) return;

      win.setAttribute(DATA_INJECTED, '1');
      currentCompose = win;
      createPopup().then(() => {
        if (popup) popup.style.display = 'flex';
      });
    });
  }

  window.MailPilot = { scanComposeState: scanComposeWindows };
  setInterval(scanComposeWindows, 1500);
})();