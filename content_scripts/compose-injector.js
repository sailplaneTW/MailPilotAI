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

  function showMsg(msgArea, text, type = 'info') {
    msgArea.textContent = text;
    msgArea.style.maxHeight = '100px';
    msgArea.style.padding = '8px 14px';
    msgArea.style.color = type === 'error' ? '#d93025' : (type === 'success' ? '#188038' : '#5f6368');
    msgArea.style.backgroundColor = type === 'error' ? '#fce8e6' : (type === 'success' ? '#e6f4ea' : '#f1f3f4');
  }

  function dispatchRestoreSnapshot(snapshot, msgArea, t, backupArea) {
    const { bodyEl, html } = snapshot || {};
    if (!bodyEl || !bodyEl.isConnected) {
      showMsg(msgArea, t('msg_error_restore_lost'), 'error');
      return;
    }
    bodyEl.innerHTML = html;
    dispatchComposeUpdate(bodyEl);
    showMsg(msgArea, t('msg_restore_done'), 'success');
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
          overflow: 'hidden',
          resize: 'both',
          minWidth: '280px',
          minHeight: '150px'
        });

        // For resize:both to work, we need a specific overflow
        popup.style.setProperty('overflow', 'auto', 'important');
        popup.style.setProperty('resize', 'both', 'important');

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
            lang = newLang; // 重要：更新閉包內的語系變數，確保後續 AI 請求使用正確語系 
            
            const newT = (key) => I18N.getMessage(key, newLang);
            titleSpan.textContent = newT('ui_header');
            btnOptimize.textContent = newT('btn_optimize');
            btnTranslate.textContent = newT('btn_translate');
            btnTitle.textContent = newT('btn_title');
            btnCheck.textContent = newT('btn_check');
            
            if (minimizeBtn) minimizeBtn.title = newT('minimize_tooltip') || 'Minimize';
          }
        });

        const msgArea = document.createElement('div');
        const backupArea = document.createElement('div');
        Object.assign(msgArea.style, { overflow: 'hidden', transition: 'max-height 0.2s', fontSize: '12px' });

        popup.append(header, btnGrid, msgArea, backupArea);
        document.body.appendChild(popup);

        // --- Drag Functionality ---
        let isDragging = false;
        let startX, startY, startL, startT;

        header.addEventListener('pointerdown', (e) => {
          if (e.target.closest('button')) return;
          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;
          const rect = popup.getBoundingClientRect();
          startL = rect.left;
          startT = rect.top;
          header.setPointerCapture(e.pointerId);
          popup.style.transition = 'none';
        });

        header.addEventListener('pointermove', (e) => {
          if (!isDragging) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          popup.style.left = `${startL + dx}px`;
          popup.style.top = `${startT + dy}px`;
          popup.style.bottom = 'auto';
          popup.style.right = 'auto';
        });

        header.addEventListener('pointerup', (e) => {
          if (!isDragging) return;
          isDragging = false;
          header.releasePointerCapture(e.pointerId);
          popup.style.transition = '';
        });

        // Action Handler
        const handleAction = async (type) => {
          if (!currentCompose) {
            const candidates = document.querySelectorAll(COMPOSE_SELECTORS);
            if (candidates.length === 1) {
              currentCompose = candidates[0];
            } else {
              showMsg(msgArea, t('msg_error_no_body'), 'error');
              return;
            }
          }
          const body = getComposeBody(currentCompose);
          const text = extractText(body);
          if (!text) {
            showMsg(msgArea, t('msg_error_empty'), 'error');
            return;
          }

          // Loading state
          const origLabels = {
            optimize: btnOptimize.textContent,
            translate: btnTranslate.textContent,
            title: btnTitle.textContent,
            check: btnCheck.textContent
          };
          const statusKeys = {
            optimize: 'status_processing',
            translate: 'status_translating',
            title: 'status_generating',
            check: 'status_checking'
          };

          const btns = [btnOptimize, btnTranslate, btnTitle, btnCheck];
          btns.forEach(b => b.disabled = true);
          const activeBtn = { optimize: btnOptimize, translate: btnTranslate, title: btnTitle, check: btnCheck }[type];
          activeBtn.textContent = t(statusKeys[type]);
          clearMsg(msgArea);

          const backupSnapshot = { bodyEl: body, html: body.innerHTML, text };
          const settings = await chrome.storage.local.get(['optimizePrompt', 'titlePrompt', 'checkPrompt', 'translateLang']);

          let prompt = '';
          if (type === 'optimize') prompt = settings.optimizePrompt || I18N.getDefaultPrompts(lang).optimize;
          else if (type === 'title') prompt = settings.titlePrompt || I18N.getDefaultPrompts(lang).title;
          else if (type === 'translate') prompt = `Translate to ${settings.translateLang || 'English'}: \n\n${text}`;
          else if (type === 'check') {
            if (!settings.checkPrompt) {
              showMsg(msgArea, t('msg_error_no_check_prompt'), 'error');
              btns.forEach(b => b.disabled = false);
              activeBtn.textContent = origLabels[type];
              return;
            }
            prompt = settings.checkPrompt;
          }

          chrome.runtime.sendMessage({ action: 'CALL_GEMINI_API', prompt, content: text }, response => {
            btns.forEach(b => b.disabled = false);
            activeBtn.textContent = origLabels[type];

            if (response.success) {
              const output = removeCommonModelDecorations(response.data);
              if (type === 'title') {
                const subjectInput = currentCompose.querySelector(SUBJECT_SELECTORS);
                if (subjectInput) {
                  setInputValue(subjectInput, normalizeTitle(output));
                  showMsg(msgArea, t('msg_success_title') + normalizeTitle(output), 'success');
                }
              } else if (type === 'check') {
                showMsg(msgArea, output, 'info');
                msgArea.style.whiteSpace = 'pre-wrap';
              } else {
                replaceTextSafely(body, output);
                activeBackupSnapshot = backupSnapshot;
                showMsg(msgArea, type === 'translate' ? t('msg_success_trans') + (settings.translateLang || 'English') : t('msg_success_opt'), 'success');
                
                // Show Restore button
                backupArea.innerHTML = '';
                const restoreBtn = document.createElement('button');
                restoreBtn.textContent = t('backup_restore');
                Object.assign(restoreBtn.style, {
                  marginTop: '8px', padding: '4px 8px', fontSize: '11px',
                  backgroundColor: '#f1f3f4', border: '1px solid #dadce0',
                  borderRadius: '4px', cursor: 'pointer'
                });
                restoreBtn.onclick = () => dispatchRestoreSnapshot(activeBackupSnapshot, msgArea, t, backupArea);
                backupArea.append(restoreBtn);
                backupArea.style.maxHeight = '100px';
                backupArea.style.padding = '0 14px 8px 14px';
              }
            } else {
              showMsg(msgArea, t('msg_error_api') + (response.error || 'Unknown error'), 'error');
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
      if (!win.hasAttribute(DATA_INJECTED)) {
        win.setAttribute(DATA_INJECTED, '1');
        // 當使用者點擊或聚焦在寫信視窗時，更新目前的 currentCompose
        win.addEventListener('focusin', () => {
          currentCompose = win;
        });
        win.addEventListener('click', () => {
          currentCompose = win;
        });
      }
      
      const body = win.querySelector(BODY_SELECTOR);
      if (!body) return;

      createPopup().then(() => {
        if (popup) popup.style.display = 'flex';
      });
    });
  }

  window.MailPilot = { scanComposeState: scanComposeWindows };
  setInterval(scanComposeWindows, 1500);
})();