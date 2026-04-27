/**
 * content_scripts/compose-injector.js
 * Injects a dedicated MailPilot AI floating panel for each Gmail compose window.
 * Supports multiple concurrent windows, each with its own popup, minimize, and close behavior.
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

  // --- Global State ---
  // Map<ComposeWindowElement, PopupInstance>
  const windowPopupMap = new Map();
  let uiLang = 'en';
  let windowCounter = 0; // Monotonically increasing, never reused

  const getI18n = () => window.i18n || {
    getMessage: (k) => k,
    getDefaultPrompts: () => ({ optimize: '', title: '' })
  };
  const I18N = getI18n();
  const t = (key) => I18N.getMessage(key, uiLang);

  // --- Language Sync (global) ---
  getUILanguage().then(lang => { uiLang = lang; });
  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.uiLang) return;
    uiLang = changes.uiLang.newValue || 'en';
    // Update all open popups
    windowPopupMap.forEach(({ updateLanguage }) => updateLanguage(uiLang));
  });

  // --- DOM Utilities ---

  function getComposeBody(win) {
    return win.querySelector(SELECTORS.BODY_EDITOR);
  }

  function extractCleanText(bodyEl) {
    const clone = bodyEl.cloneNode(true);
    clone.querySelectorAll('.gmail_signature, [data-smartmail="gmail_signature"], .gmail_quote, blockquote')
      .forEach(el => el.remove());
    return (clone.innerText || clone.textContent || '').trim();
  }

  function formatModelTextToHtml(text) {
    let clean = String(text ?? '').replace(/\r\n/g, '\n').trim();
    clean = clean.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    return clean.split('\n').map(line => {
      const escaped = String(line).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return line.trim() === '' ? '<div><br></div>' : `<div>${escaped}</div>`;
    }).join('');
  }

  function updateComposeBody(bodyEl, newText) {
    const sigSelector = '.gmail_signature, [data-smartmail="gmail_signature"], .gmail_quote, blockquote';
    const preserved = Array.from(bodyEl.querySelectorAll(sigSelector));
    preserved.forEach(el => el.remove());
    bodyEl.innerHTML = formatModelTextToHtml(newText);
    preserved.forEach(el => bodyEl.appendChild(el));
    ['input', 'change'].forEach(evt => bodyEl.dispatchEvent(new Event(evt, { bubbles: true })));
  }

  // --- Minimize Bubble Management ---
  // Minimized bubbles appear in the bottom-right corner, stacked right-to-left.
  const BUBBLE_WIDTH = 50;
  const BUBBLE_GAP = 8;
  const BUBBLE_BOTTOM = 20;
  const BUBBLE_RIGHT_BASE = 20;

  /**
   * Recalculate bottom-right positions for all minimized bubbles.
   * Called whenever a popup is minimized or restored.
   */
  function repositionBubbles() {
    let slot = 0;
    windowPopupMap.forEach(({ bubble, minimized }) => {
      if (!minimized || !bubble) return;
      const right = BUBBLE_RIGHT_BASE + slot * (BUBBLE_WIDTH + BUBBLE_GAP);
      bubble.style.right = `${right}px`;
      bubble.style.bottom = `${BUBBLE_BOTTOM}px`;
      slot++;
    });
  }

  // --- Popup Factory ---

  /**
   * Creates a fully self-contained popup for one compose window.
   * @param {Element} composeWin - The Gmail compose window element.
   * @param {number} index - Display number (1-based).
   * @returns {Object} - Instance with updateLanguage(), destroy() methods.
   */
  function createPopupForWindow(composeWin, index) {
    let activeBackup = null;
    let currentLang = uiLang;
    let isMinimized = false;

    const instanceT = (key) => I18N.getMessage(key, currentLang);
    const titleText = () => `${instanceT('ui_header')} ${index}`;

    // --- Build the full popup ---
    const popup = createElement('div', {}, {
      position: 'fixed',
      width: '320px',
      left: `${Math.max(20, window.innerWidth - 360 - (index - 1) * 30)}px`,
      top: `${80 + (index - 1) * 30}px`,
      backgroundColor: '#fff',
      border: '1px solid #dadce0',
      borderRadius: '14px',
      boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
      zIndex: String(999990 + index),
      fontFamily: 'Google Sans, system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      minWidth: '280px',
      minHeight: '150px',
      resize: 'both',
      overflow: 'auto'
    });

    // --- Message Area ---
    const msgArea = createElement('div', {}, {
      overflow: 'hidden',
      transition: 'max-height 0.2s',
      fontSize: '12px',
      maxHeight: '0',
      padding: '0 14px'
    });
    const backupArea = createElement('div', {}, {
      overflow: 'hidden',
      transition: 'max-height 0.2s',
      maxHeight: '0',
      padding: '0 14px'
    });

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
      backupArea.innerHTML = '';
    };

    // --- Header ---
    const header = createElement('div', {}, {
      padding: '10px 12px',
      backgroundColor: '#f8f9fa',
      borderBottom: '1px solid #e8eaed',
      cursor: 'grab',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      userSelect: 'none',
      flexShrink: '0'
    });

    const headerTitle = createElement('div', { textContent: titleText() }, {
      fontWeight: '700',
      color: '#202124',
      fontSize: '13px'
    });

    const minimizeBtn = createElement('button', { textContent: '—', title: 'Minimize' }, {
      background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px',
      padding: '0 4px', lineHeight: '1', color: '#5f6368'
    });

    header.append(headerTitle, minimizeBtn);
    popup.append(header);

    // --- Action Buttons ---
    const btnGrid = createElement('div', {}, {
      padding: '12px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px',
      flexShrink: '0'
    });

    const makeBtn = (label, color, type) => {
      const btn = createElement('button', { textContent: label }, {
        padding: '8px 4px',
        backgroundColor: color,
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '12px'
      });
      btn.onclick = () => handleAction(type);
      return btn;
    };

    const btnOptimize = makeBtn(instanceT('btn_optimize'), '#1a73e8', 'optimize');
    const btnTranslate = makeBtn(instanceT('btn_translate'), '#34a853', 'translate');
    const btnTitle    = makeBtn(instanceT('btn_title'),    '#fbbc05', 'title');
    const btnCheck    = makeBtn(instanceT('btn_check'),    '#ea4335', 'check');
    const allBtns     = [btnOptimize, btnTranslate, btnTitle, btnCheck];

    btnGrid.append(btnOptimize, btnTranslate, btnTitle, btnCheck);
    popup.append(btnGrid, msgArea, backupArea);
    document.body.appendChild(popup);

    // --- Minimize Bubble ---
    const bubble = createElement('div', {}, {
      position: 'fixed',
      width: `${BUBBLE_WIDTH}px`,
      height: `${BUBBLE_WIDTH}px`,
      borderRadius: '50%',
      backgroundColor: '#1a73e8',
      color: '#fff',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      zIndex: String(999990 + index),
      fontSize: '11px',
      fontWeight: '700',
      fontFamily: 'Google Sans, system-ui, sans-serif',
      userSelect: 'none',
      flexDirection: 'column',
      gap: '2px'
    });
    const bubbleLabel = createElement('div', { textContent: String(index) }, { lineHeight: '1' });
    const bubbleIcon  = createElement('div', { textContent: '✦' }, { fontSize: '14px', lineHeight: '1' });
    bubble.append(bubbleIcon, bubbleLabel);
    document.body.appendChild(bubble);

    bubble.addEventListener('click', () => restore());

    // --- Minimize / Restore ---
    function minimize() {
      isMinimized = true;
      const instance = windowPopupMap.get(composeWin);
      if (instance) instance.minimized = true;
      popup.style.display = 'none';
      bubble.style.display = 'flex';
      repositionBubbles();
    }

    function restore() {
      isMinimized = false;
      const instance = windowPopupMap.get(composeWin);
      if (instance) instance.minimized = false;
      bubble.style.display = 'none';
      popup.style.display = 'flex';
      repositionBubbles();
    }

    minimizeBtn.addEventListener('click', minimize);

    // --- Drag ---
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
      popup.style.top  = `${e.clientY - offset.y}px`;
    });
    header.addEventListener('pointerup', (e) => {
      dragging = false;
      header.releasePointerCapture(e.pointerId);
      popup.style.transition = '';
    });

    // --- Action Handler ---
    async function handleAction(actionType) {
      const body = getComposeBody(composeWin);
      if (!body) { showMessage(instanceT('msg_error_no_body'), 'error'); return; }
      const text = extractCleanText(body);
      if (!text) { showMessage(instanceT('msg_error_empty'), 'error'); return; }

      const origLabels = {
        optimize: btnOptimize.textContent, translate: btnTranslate.textContent,
        title: btnTitle.textContent,       check: btnCheck.textContent
      };
      const activeBtn = { optimize: btnOptimize, translate: btnTranslate, title: btnTitle, check: btnCheck }[actionType];
      const statusKey = { optimize: 'status_processing', translate: 'status_translating', title: 'status_generating', check: 'status_checking' }[actionType];

      allBtns.forEach(b => b.disabled = true);
      activeBtn.textContent = instanceT(statusKey);
      // Also show the task status in the message area
      showMessage(instanceT(statusKey), 'info');

      const settings = await storageGet(['optimizePrompt', 'titlePrompt', 'checkPrompt', 'translateLang']);
      let prompt = '';
      if (actionType === 'optimize')  prompt = settings.optimizePrompt || I18N.getDefaultPrompts(currentLang).optimize;
      else if (actionType === 'title') prompt = settings.titlePrompt   || I18N.getDefaultPrompts(currentLang).title;
      else if (actionType === 'translate') prompt = `Translate to ${settings.translateLang || 'English'}: \n\n${text}`;
      else if (actionType === 'check') {
        prompt = settings.checkPrompt || '';
        if (!prompt) {
          showMessage(instanceT('msg_error_no_check_prompt'), 'error');
          allBtns.forEach(b => b.disabled = false);
          activeBtn.textContent = origLabels[actionType];
          return;
        }
      }

      chrome.runtime.sendMessage({ action: 'CALL_GEMINI_API', prompt, content: text }, response => {
        allBtns.forEach(b => b.disabled = false);
        activeBtn.textContent = origLabels[actionType];

        if (response.success) {
          const result = response.data.trim();
          if (actionType === 'title') {
            const input = composeWin.querySelector(SELECTORS.SUBJECT_INPUT);
            if (input) {
              input.value = result.replace(/\s+/g, ' ');
              input.dispatchEvent(new Event('input', { bubbles: true }));
              showMessage(instanceT('msg_success_title') + input.value, 'success');
            }
          } else if (actionType === 'check') {
            showMessage(result, 'info');
            msgArea.style.whiteSpace = 'pre-wrap';
          } else {
            activeBackup = { bodyEl: body, html: body.innerHTML };
            updateComposeBody(body, result);
            showMessage(actionType === 'translate'
              ? instanceT('msg_success_trans') + (settings.translateLang || 'English')
              : instanceT('msg_success_opt'), 'success');

            // Restore button
            backupArea.innerHTML = '';
            const restoreBtn = createElement('button', { textContent: instanceT('backup_restore') }, {
              marginTop: '0', marginBottom: '8px', padding: '4px 10px', fontSize: '11px',
              backgroundColor: '#f1f3f4', border: '1px solid #dadce0', borderRadius: '4px',
              cursor: 'pointer', color: '#3c4043'
            });
            restoreBtn.onclick = () => {
              if (activeBackup?.bodyEl?.isConnected) {
                activeBackup.bodyEl.innerHTML = activeBackup.html;
                updateComposeBody(activeBackup.bodyEl, extractCleanText(activeBackup.bodyEl));
              }
              clearUI();
            };
            backupArea.append(restoreBtn);
            backupArea.style.maxHeight = '60px';
            backupArea.style.padding = '0 14px 8px';
          }
        } else {
          showMessage(instanceT('msg_error_api') + response.error, 'error');
        }
      });
    }

    // --- Language Update (called globally) ---
    function updateLanguage(newLang) {
      currentLang = newLang;
      headerTitle.textContent = titleText();
      btnOptimize.textContent = instanceT('btn_optimize');
      btnTranslate.textContent = instanceT('btn_translate');
      btnTitle.textContent    = instanceT('btn_title');
      btnCheck.textContent    = instanceT('btn_check');
    }

    // --- Destroy (when compose window closes) ---
    function destroy() {
      popup.remove();
      bubble.remove();
      windowPopupMap.delete(composeWin);
      repositionBubbles();
    }

    return { popup, bubble, minimize, restore, destroy, updateLanguage, minimized: false };
  }

  // --- Scanner ---

  function scanAndInject() {
    // Deduplicate: if two selectors match nested elements (e.g. [role="dialog"] contains .M9),
    // keep only the outermost element to avoid creating duplicate popups.
    const allCandidates = Array.from(document.querySelectorAll(SELECTORS.COMPOSE_WINDOW));
    const liveWindows = new Set(
      allCandidates.filter(win =>
        !allCandidates.some(other => other !== win && other.contains(win))
      )
    );

    // 1. Remove popups whose compose window is gone
    windowPopupMap.forEach((instance, win) => {
      if (!liveWindows.has(win) || !win.isConnected) {
        instance.destroy();
      }
    });

    // 2. Create popups for new windows
    liveWindows.forEach(win => {
      if (win.hasAttribute(ATTR_INJECTED)) return;
      if (!win.querySelector(SELECTORS.BODY_EDITOR)) return;

      win.setAttribute(ATTR_INJECTED, '1');
      windowCounter++;
      const instance = createPopupForWindow(win, windowCounter);
      windowPopupMap.set(win, instance);
    });
  }

  setInterval(scanAndInject, 1000);
})();