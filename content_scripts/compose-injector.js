/**
 * content_scripts/compose-injector.js
 * Injects the MailPilot AI floating panel into Gmail's compose window.
 */
(() => {
  if (window.__mailpilotComposeInjectorInstalled) return;
  window.__mailpilotComposeInjectorInstalled = true;

  const { storageGet, getUILanguage, createElement } = window.MailPilotUtils;

  // --- Constants ---
  const SELECTORS = {
    COMPOSE_WINDOW: '[role="dialog"], .M9',
    BODY_EDITOR: 'div[contenteditable="true"]',
    SUBJECT_INPUT: 'input[name="subjectbox"], input[placeholder*="Subject"], input[aria-label*="Subject"], input[placeholder*="主旨"]',
  };

  const ATTR_INJECTED = 'data-mailpilot-injected';

  // --- UI State ---
  let popup = null;
  let currentComposeWindow = null;
  let activeBackup = null;
  let uiLang = 'en';

  /**
   * Initialize i18n helper
   */
  const getI18n = () => window.i18n || {
    getMessage: (k) => k,
    getDefaultPrompts: () => ({ optimize: '', title: '' })
  };

  const I18N = getI18n();
  const t = (key) => I18N.getMessage(key, uiLang);

  // --- DOM Utilities ---
  
  function getComposeBody(win) {
    return win.querySelector(SELECTORS.BODY_EDITOR);
  }

  function extractCleanText(bodyEl) {
    const clone = bodyEl.cloneNode(true);
    // Remove signatures and quotes from context
    clone.querySelectorAll('.gmail_signature, [data-smartmail="gmail_signature"], .gmail_quote, blockquote')
      .forEach(el => el.remove());
    return (clone.innerText || clone.textContent || '').trim();
  }

  function formatModelTextToHtml(text) {
    // Remove common AI formatting like markdown blocks or quotes
    let clean = String(text ?? '').replace(/\r\n/g, '\n').trim();
    clean = clean.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    
    // Convert newlines to Gmail-friendly divs
    return clean.split('\n').map(line => {
      const escaped = String(line).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return line.trim() === '' ? '<div><br></div>' : `<div>${escaped}</div>`;
    }).join('');
  }

  function updateComposeBody(bodyEl, newText) {
    const signatureSelectors = '.gmail_signature, [data-smartmail="gmail_signature"], .gmail_quote, blockquote';
    const preservedElements = Array.from(bodyEl.querySelectorAll(signatureSelectors));
    
    // Temporarily remove preserved elements to replace the main body
    preservedElements.forEach(el => el.remove());
    bodyEl.innerHTML = formatModelTextToHtml(newText);
    
    // Re-append signatures/quotes
    preservedElements.forEach(el => bodyEl.appendChild(el));
    
    // Trigger input events for Gmail to detect change
    const events = ['input', 'change'];
    events.forEach(evtType => bodyEl.dispatchEvent(new Event(evtType, { bubbles: true })));
  }

  // --- UI Component Builders ---

  function createHeader(onClose) {
    const header = createElement('div', { className: 'mp-header' }, {
      padding: '10px 12px',
      backgroundColor: '#f8f9fa',
      borderBottom: '1px solid #e8eaed',
      cursor: 'grab',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      userSelect: 'none'
    });

    const title = createElement('div', { textContent: t('ui_header') }, { fontWeight: '700', color: '#202124' });
    const closeBtn = createElement('button', { innerHTML: '&#8722;', title: t('minimize_tooltip') }, {
      background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px'
    });
    closeBtn.onclick = onClose;

    header.append(title, closeBtn);
    return { header, title, closeBtn };
  }

  function createActionButton(label, bgColor, onClick) {
    const btn = createElement('button', { textContent: label }, {
      padding: '8px 4px',
      backgroundColor: bgColor,
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '12px'
    });
    btn.onclick = onClick;
    return btn;
  }

  // --- Main Logic ---

  async function initPopup() {
    if (popup) return;
    uiLang = await getUILanguage();

    popup = createElement('div', { id: 'mailpilot-popup' }, {
      position: 'fixed',
      width: '320px',
      left: `${window.innerWidth - 360}px`,
      top: '100px',
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
    popup.style.setProperty('overflow', 'auto', 'important');

    // UI Areas
    const msgArea = createElement('div', {}, { overflow: 'hidden', transition: 'max-height 0.2s', fontSize: '12px' });
    const backupArea = createElement('div', {}, { padding: '0 14px', overflow: 'hidden', transition: 'max-height 0.2s' });

    const showMessage = (msg, type = 'info') => {
      msgArea.textContent = msg;
      msgArea.style.maxHeight = '200px';
      msgArea.style.padding = '8px 14px';
      const styles = {
        error: { color: '#d93025', bg: '#fce8e6' },
        success: { color: '#188038', bg: '#e6f4ea' },
        info: { color: '#5f6368', bg: '#f1f3f4' }
      };
      const s = styles[type] || styles.info;
      msgArea.style.color = s.color;
      msgArea.style.backgroundColor = s.bg;
    };

    const clearUI = () => {
      msgArea.style.maxHeight = '0';
      msgArea.style.padding = '0 14px';
      backupArea.style.maxHeight = '0';
    };

    // Header & Close
    const { header, title: headerTitle, closeBtn } = createHeader(() => { popup.style.display = 'none'; });

    // Buttons
    const btnGrid = createElement('div', {}, { padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' });
    
    const handleAction = async (actionType) => {
      if (!currentComposeWindow) {
        const activeOnes = document.querySelectorAll(SELECTORS.COMPOSE_WINDOW);
        if (activeOnes.length === 1) currentComposeWindow = activeOnes[0];
        else { showMessage(t('msg_error_no_body'), 'error'); return; }
      }

      const body = getComposeBody(currentComposeWindow);
      const text = extractCleanText(body);
      if (!text) { showMessage(t('msg_error_empty'), 'error'); return; }

      const labels = {
        optimize: btnOptimize.textContent, translate: btnTranslate.textContent,
        title: btnTitle.textContent, check: btnCheck.textContent
      };
      const buttons = [btnOptimize, btnTranslate, btnTitle, btnCheck];
      const activeBtn = { optimize: btnOptimize, translate: btnTranslate, title: btnTitle, check: btnCheck }[actionType];

      buttons.forEach(b => b.disabled = true);
      activeBtn.textContent = t(`status_${actionType === 'title' ? 'generating' : (actionType === 'optimize' ? 'processing' : 'translating')}`);
      clearUI();

      const settings = await storageGet(['optimizePrompt', 'titlePrompt', 'checkPrompt', 'translateLang']);
      let prompt = '';
      if (actionType === 'optimize') prompt = settings.optimizePrompt || I18N.getDefaultPrompts(uiLang).optimize;
      else if (actionType === 'title') prompt = settings.titlePrompt || I18N.getDefaultPrompts(uiLang).title;
      else if (actionType === 'translate') prompt = `Translate to ${settings.translateLang || 'English'}: \n\n${text}`;
      else if (actionType === 'check') prompt = settings.checkPrompt || '';

      if (actionType === 'check' && !prompt) {
        showMessage(t('msg_error_no_check_prompt'), 'error');
        buttons.forEach(b => b.disabled = false);
        activeBtn.textContent = labels[actionType];
        return;
      }

      chrome.runtime.sendMessage({ action: 'CALL_GEMINI_API', prompt, content: text }, response => {
        buttons.forEach(b => b.disabled = false);
        activeBtn.textContent = labels[actionType];

        if (response.success) {
          const result = response.data.trim();
          if (actionType === 'title') {
            const input = currentComposeWindow.querySelector(SELECTORS.SUBJECT_INPUT);
            if (input) {
              input.value = result.replace(/\s+/g, ' ');
              input.dispatchEvent(new Event('input', { bubbles: true }));
              showMessage(t('msg_success_title') + input.value, 'success');
            }
          } else if (actionType === 'check') {
            showMessage(result, 'info');
            msgArea.style.whiteSpace = 'pre-wrap';
          } else {
            activeBackup = { bodyEl: body, html: body.innerHTML };
            updateComposeBody(body, result);
            showMessage(actionType === 'translate' ? t('msg_success_trans') + (settings.translateLang || 'English') : t('msg_success_opt'), 'success');
            
            backupArea.innerHTML = '';
            const restoreBtn = createActionButton(t('backup_restore'), '#f1f3f4', () => {
              body.innerHTML = activeBackup.html;
              updateComposeBody(body, extractCleanText(body)); // trigger events
              clearUI();
            });
            restoreBtn.style.color = '#3c4043';
            restoreBtn.style.border = '1px solid #dadce0';
            backupArea.append(restoreBtn);
            backupArea.style.maxHeight = '100px';
          }
        } else {
          showMessage(t('msg_error_api') + response.error, 'error');
        }
      });
    };

    const btnOptimize = createActionButton(t('btn_optimize'), '#1a73e8', () => handleAction('optimize'));
    const btnTranslate = createActionButton(t('btn_translate'), '#34a853', () => handleAction('translate'));
    const btnTitle = createActionButton(t('btn_title'), '#fbbc05', () => handleAction('title'));
    const btnCheck = createActionButton(t('btn_check'), '#ea4335', () => handleAction('check'));

    btnGrid.append(btnOptimize, btnTranslate, btnTitle, btnCheck);

    // Storage Listener for Language Sync
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.uiLang) {
        uiLang = changes.uiLang.newValue || 'en';
        headerTitle.textContent = t('ui_header');
        btnOptimize.textContent = t('btn_optimize');
        btnTranslate.textContent = t('btn_translate');
        btnTitle.textContent = t('btn_title');
        btnCheck.textContent = t('btn_check');
        closeBtn.title = t('minimize_tooltip');
      }
    });

    // Drag Functionality
    let dragging = false;
    let offset = { x: 0, y: 0 };
    header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      const rect = popup.getBoundingClientRect();
      offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      header.setPointerCapture(e.pointerId);
      popup.style.transition = 'none';
    });
    header.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      popup.style.left = `${e.clientX - offset.x}px`;
      popup.style.top = `${e.clientY - offset.y}px`;
    });
    header.addEventListener('pointerup', (e) => {
      dragging = false;
      header.releasePointerCapture(e.pointerId);
      popup.style.transition = '';
    });

    popup.append(header, btnGrid, msgArea, backupArea);
    document.body.appendChild(popup);
  }

  function scanAndInject() {
    const windows = document.querySelectorAll(SELECTORS.COMPOSE_WINDOW);
    
    if (windows.length === 0) {
      if (popup) popup.style.display = 'none';
      currentComposeWindow = null;
      return;
    }

    if (currentComposeWindow && !currentComposeWindow.isConnected) {
      currentComposeWindow = null;
    }

    windows.forEach(win => {
      if (!win.hasAttribute(ATTR_INJECTED)) {
        win.setAttribute(ATTR_INJECTED, '1');
        const updateCurrent = () => { currentComposeWindow = win; };
        win.addEventListener('focusin', updateCurrent);
        win.addEventListener('click', updateCurrent);
      }

      if (win.querySelector(SELECTORS.BODY_EDITOR)) {
        initPopup().then(() => { if (popup) popup.style.display = 'flex'; });
      }
    });
  }

  setInterval(scanAndInject, 1500);
})();