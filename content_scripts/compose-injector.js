// content_scripts/compose-injector.js
(() => {
  if (window.__mailpilotComposeInjectorInstalled) return;
  window.__mailpilotComposeInjectorInstalled = true;

  const I18N = window.i18n || {
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

  function extractText(bodyEl) {
    const clone = bodyEl.cloneNode(true);
    clone.querySelectorAll('.gmail_signature, [data-smartmail="gmail_signature"], .gmail_quote, blockquote')
      .forEach(el => el.remove());
    return clone.innerText.trim();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function replaceTextSafely(bodyEl, newText) {
    // Convert plain text to safe HTML blocks
    const html = newText.split('\n').map(line => {
      const trimmed = line.trim();
      return trimmed === '' ? '<div><br></div>' : `<div>${escapeHtml(trimmed)}</div>`;
    }).join('');

    // Temporarily remove and save signatures and quotes
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

    // Overwrite body and append preserved blocks at the end
    bodyEl.innerHTML = html;
    preserved.forEach(el => bodyEl.appendChild(el));

    // Trigger internal Gmail events to recognize content changes
    bodyEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
    bodyEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ── Floating Panel ──────────────────────────────────────
  let popup = null;
  let minimizeBtn = null;
  let currentCompose = null;
  let originalHTML = '';

  function getLang() {
    return new Promise(resolve => {
      chrome.storage.local.get(['uiLang'], data => resolve(data.uiLang || 'en'));
    });
  }

  // Global interval to clean up the popup when compose window is closed
  setInterval(() => {
    if (currentCompose && !document.body.contains(currentCompose)) {
      currentCompose = null;
      if (popup) popup.style.display = 'none';
      if (minimizeBtn) minimizeBtn.style.display = 'none';
    }
  }, 2000);

  async function createPopup() {
    if (popup) return;
    const lang = await getLang();
    const t = (key) => I18N.getMessage(key, lang);

    // Main Panel
    popup = document.createElement('div');
    popup.id = 'mailpilot-popup';
    const w = 310;
    const h = 220;
    const initialLeft = Math.max(20, window.innerWidth - w - 20);
    const initialTop = Math.max(20, window.innerHeight - h - 20);

    Object.assign(popup.style, {
      position: 'fixed', width: `${w}px`, left: `${initialLeft}px`, top: `${initialTop}px`,
      backgroundColor: '#fff', border: '1px solid #dadce0', borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: '999999',
      fontFamily: 'Google Sans, system-ui, sans-serif', fontSize: '13px',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      resize: 'both', minWidth: '240px', minHeight: '150px'
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '10px 12px', backgroundColor: '#f8f9fa',
      borderBottom: '1px solid #e8eaed', cursor: 'grab',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      userSelect: 'none'
    });

    const titleSpan = document.createElement('span');
    titleSpan.textContent = t('ui_header');
    Object.assign(titleSpan.style, { fontWeight: '600', color: '#202124' });

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&#8722;'; // Minus icon for minimize
    Object.assign(closeBtn.style, {
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: '18px', color: '#5f6368', lineHeight: 1, padding: '0 2px'
    });
    closeBtn.title = t('minimize_tooltip') || 'Minimize';
    header.append(titleSpan, closeBtn);

    // Button Grid
    const btnGrid = document.createElement('div');
    Object.assign(btnGrid.style, {
      padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: '8px', borderBottom: '1px solid #e8eaed'
    });

    const makeBtn = (label, bgColor) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      Object.assign(btn.style, {
        padding: '8px 4px', backgroundColor: bgColor, color: '#fff',
        border: 'none', borderRadius: '6px', cursor: 'pointer',
        fontWeight: '500', fontSize: '12px', whiteSpace: 'nowrap'
      });
      return btn;
    };

    const btnOptimize = makeBtn(t('btn_optimize'), '#1a73e8');
    const btnTranslate = makeBtn(t('btn_translate'), '#34a853');
    const btnTitle = makeBtn(t('btn_title'), '#fbbc05');
    const btnCheck = makeBtn(t('btn_check'), '#ea4335');
    btnGrid.append(btnOptimize, btnTranslate, btnTitle, btnCheck);

    // Message Area
    const msgArea = document.createElement('div');
    Object.assign(msgArea.style, {
      padding: '0 14px', maxHeight: '0', overflow: 'hidden',
      transition: 'max-height 0.2s, padding 0.2s', fontSize: '12px'
    });

    // Backup Area
    const backupArea = document.createElement('div');
    Object.assign(backupArea.style, {
      padding: '0 14px', maxHeight: '0', overflow: 'hidden',
      transition: 'max-height 0.2s, padding 0.2s'
    });

    popup.append(header, btnGrid, msgArea, backupArea);
    document.body.appendChild(popup);

    // Minimize Button
    minimizeBtn = document.createElement('button');
    minimizeBtn.innerHTML = '✉️';
    Object.assign(minimizeBtn.style, {
      position: 'fixed', bottom: '20px', right: '20px',
      width: '44px', height: '44px', borderRadius: '22px',
      backgroundColor: '#1a73e8', color: '#fff', border: 'none',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)', cursor: 'pointer',
      fontSize: '18px', display: 'none', zIndex: '999998',
      alignItems: 'center', justifyContent: 'center'
    });
    document.body.appendChild(minimizeBtn);

    const minimize = () => {
      popup.style.display = 'none';
      minimizeBtn.style.display = 'flex';
    };
    const restore = () => {
      popup.style.display = 'flex';
      minimizeBtn.style.display = 'none';
    };
    closeBtn.addEventListener('click', minimize);
    minimizeBtn.addEventListener('click', restore);

    // Drag Functionality
    let isDragging = false, startX, startY, popupLeft, popupTop;
    const onMouseMove = (e) => {
      if (!isDragging) return;
      popup.style.left = `${popupLeft + e.clientX - startX}px`;
      popup.style.top = `${popupTop + e.clientY - startY}px`;
      popup.style.bottom = 'auto';
      popup.style.right = 'auto';
      e.preventDefault();
      e.stopPropagation();
    };
    const onMouseUp = (e) => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'grab';
        e.stopPropagation();
      }
    };
    header.addEventListener('mousedown', (e) => {
      if (e.target === closeBtn) return;
      isDragging = true;
      header.style.cursor = 'grabbing';
      startX = e.clientX;
      startY = e.clientY;
      const rect = popup.getBoundingClientRect();
      popupLeft = rect.left;
      popupTop = rect.top;
      e.preventDefault();
      e.stopPropagation();
    });
    window.addEventListener('mousemove', onMouseMove, { capture: true });
    window.addEventListener('mouseup', onMouseUp, { capture: true });

    // UI Helpers
    function showMsg(html, type = 'info') {
      msgArea.innerHTML = html;
      msgArea.style.maxHeight = '2000px';
      msgArea.style.padding = '10px 14px';
    }
    function clearMsg() {
      msgArea.style.maxHeight = '0';
      msgArea.style.padding = '0 14px';
    }
    function showBackup(text) {
      backupArea.innerHTML = `<details style="font-size:12px;">
        <summary style="cursor:pointer;">${t('backup_title')}</summary>
        <div style="max-height:80px;overflow-y:auto;background:#f8f9fa;padding:6px;border-radius:6px;white-space:pre-wrap;">${escapeHtml(text)}</div>
        <button class="restore-btn" style="margin-top:6px;padding:4px 10px;background:#fff;border:1px solid #dadce0;border-radius:6px;cursor:pointer;">${t('backup_restore')}</button>
      </details>`;
      backupArea.querySelector('.restore-btn').addEventListener('click', () => {
        if (currentCompose) {
          const body = getComposeBody(currentCompose);
          if (body) {
            body.innerHTML = originalHTML;
            body.dispatchEvent(new InputEvent('input', { bubbles: true }));
            body.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        backupArea.style.maxHeight = '0';
        backupArea.style.padding = '0 14px';
        clearMsg();
      });
    }

    // Button State Management
    const allBtns = [btnOptimize, btnTranslate, btnTitle, btnCheck];
    function setUIProcessing(processing, activeBtn) {
      allBtns.forEach(btn => {
        if (btn === activeBtn) {
          btn.disabled = processing;
          btn.style.opacity = processing ? '0.5' : '1';
          btn.style.cursor = processing ? 'not-allowed' : 'pointer';
        } else {
          btn.disabled = processing;
          btn.style.opacity = processing ? '0.35' : '1';
          btn.style.cursor = processing ? 'not-allowed' : 'pointer';
        }
      });
    }

    // Action Handler
    async function handleAction(type) {
      if (!currentCompose) return;
      const body = getComposeBody(currentCompose);
      if (!body) return alert(t('msg_error_no_body'));
      const text = extractText(body);
      if (!text) return alert(t('msg_error_empty'));

      originalHTML = body.innerHTML;
      clearMsg();
      backupArea.style.maxHeight = '0';
      backupArea.style.padding = '0 14px';

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
      const activeBtnMap = {
        optimize: btnOptimize,
        translate: btnTranslate,
        title: btnTitle,
        check: btnCheck
      };
      const activeBtn = activeBtnMap[type];
      activeBtn.textContent = t(statusKeys[type]);
      setUIProcessing(true, activeBtn);

      try {
        const settings = await chrome.storage.local.get([
          'optimizePrompt', 'titlePrompt', 'checkPrompt', 'translateLang', 'uiLang'
        ]);
        let prompt = '';
        if (type === 'optimize') prompt = settings.optimizePrompt || I18N.getDefaultPrompts(settings.uiLang).optimize;
        else if (type === 'title') prompt = settings.titlePrompt || I18N.getDefaultPrompts(settings.uiLang).title;
        else if (type === 'check') prompt = settings.checkPrompt || '';
        else if (type === 'translate') prompt = `Translate the following text to ${settings.translateLang || 'English'}.\nOnly return the translation without any explanations or quotes.`;

        if (type === 'check' && !prompt.trim()) {
          showMsg(t('msg_error_no_check_prompt'), 'error');
          return;
        }

        const result = await callGeminiAPI(prompt, text);

        if (result.success) {
          if (type === 'title') {
            const subjectInput = currentCompose.querySelector(SUBJECT_SELECTORS);
            if (subjectInput) {
              subjectInput.value = result.data.replace(/^["「『]|["」』]$/g, '');
              subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
              subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            showMsg(`✓ ${t('msg_success_title')} ${subjectInput?.value || ''}`, 'success');
          } else if (type === 'check') {
            showMsg(`<strong>${t('title_check_result')}</strong><br><pre style="white-space:pre-wrap;margin:8px 0 0;">${escapeHtml(result.data)}</pre>`, 'info');
          } else {
            replaceTextSafely(body, result.data);
            showMsg(`✓ ${t(type === 'optimize' ? 'msg_success_opt' : 'msg_success_trans')}`, 'success');
            showBackup(text);
            backupArea.style.maxHeight = '2000px';
            backupArea.style.padding = '10px 14px';
          }
        } else {
          showMsg(`⚠ ${t('msg_error_api')}${result.error}`, 'error');
        }
      } catch (err) {
        showMsg(`⚠ ${t('msg_error_generic')}${err.message}`, 'error');
      } finally {
        activeBtn.textContent = origLabels[type];
        setUIProcessing(false, activeBtn);
      }
    }

    function callGeminiAPI(prompt, content) {
      return new Promise(resolve => {
        chrome.runtime.sendMessage(
          { action: 'CALL_GEMINI_API', prompt, content },
          response => resolve(response || { success: false, error: 'No response' })
        );
      });
    }

    // Bind Button Events
    btnOptimize.addEventListener('click', () => handleAction('optimize'));
    btnTranslate.addEventListener('click', () => handleAction('translate'));
    btnTitle.addEventListener('click', () => handleAction('title'));
    btnCheck.addEventListener('click', () => handleAction('check'));
  }

  // ── Scanner: Detect new compose windows ──────────────────
  function scanComposeWindows() {
    const candidates = document.querySelectorAll(COMPOSE_SELECTORS);
    candidates.forEach(win => {
      if (win.hasAttribute(DATA_INJECTED)) return;
      if (!win.querySelector(BODY_SELECTOR)) return; // Wait until body is fully rendered

      win.setAttribute(DATA_INJECTED, '1');
      currentCompose = win; // Always link to the latest compose window
      createPopup().then(() => {
        if (popup) popup.style.display = 'flex';
        if (minimizeBtn) minimizeBtn.style.display = 'none';
      });
    });
  }

  // Export scanner for gmail-observer.js to trigger
  window.MailPilot = window.MailPilot || {};
  window.MailPilot.scanComposeState = scanComposeWindows;

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanComposeWindows);
  } else {
    scanComposeWindows();
  }
})();