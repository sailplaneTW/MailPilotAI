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
  const windowPopupMap = new Map();
  let uiLang = 'en';
  let windowCounter = 0;

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
  const BUBBLE_WIDTH = 50;
  const BUBBLE_GAP = 8;
  const BUBBLE_BOTTOM = 20;
  const BUBBLE_RIGHT_BASE = 20;

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

  function createPopupForWindow(composeWin, index) {
    let activeBackup = null;
    let currentLang = uiLang;
    let isMinimized = false;

    const instanceT = (key) => I18N.getMessage(key, currentLang);
    const titleText = () => `${instanceT('ui_header')} ${index}`;

    // --- 1. 最外層 Popup (嚴格限制寬高與隱藏溢出) ---
    const popup = createElement('div', {}, {
      position: 'fixed',
      width: '320px',
      minWidth: '280px',
      maxWidth: '90vw',
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
      height: 'auto',
      maxHeight: '85vh',
      resize: 'both',
      overflow: 'hidden', // 絕對隱藏任何跑出去的內容
      boxSizing: 'border-box'
    });

    // --- 2. 獨立的捲動容器 (負責產生 Scrollbar) ---
    const msgContainer = createElement('div', {}, {
      display: 'none',
      flex: '1 1 auto',     // 填滿剩餘高度，可縮小
      minHeight: '0',       // 讓 Flexbox 允許高度縮小以觸發 Scroll
      width: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',  // 防止水平捲軸
      borderTop: '1px solid #e8eaed',
      boxSizing: 'border-box'
    });

    // --- 3. 實際文字區塊 (負責強制換行與內距) ---
    const msgArea = createElement('div', {}, {
      padding: '12px 14px',
      fontSize: '13px',
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap',    // 保留換行，但太長會折行
      wordBreak: 'break-word',   // 強制長單字折行
      overflowWrap: 'anywhere',  // 終極防止單字撐破版面
      width: '100%',
      boxSizing: 'border-box'
    });

    // 將文字區塊放入捲動容器
    msgContainer.appendChild(msgArea);

    const backupArea = createElement('div', {}, {
      display: 'none',
      flexShrink: '0',
      padding: '12px 14px',
      boxSizing: 'border-box',
      borderTop: '1px solid #e8eaed',
      backgroundColor: '#fff'
    });

    // 顯示訊息：控制外層容器的顯示與背景色
    const showMessage = (msg, type = 'info') => {
      msgArea.textContent = msg;
      msgContainer.style.display = 'block';
      const styles = {
        error: { color: '#d93025', bg: '#fce8e6' },
        success: { color: '#188038', bg: '#e6f4ea' }, // 綠色樣式
        info: { color: '#5f6368', bg: '#f1f3f4' }
      };
      const s = styles[type] || styles.info;
      msgContainer.style.backgroundColor = s.bg;
      msgArea.style.color = s.color;
    };

    const clearUI = () => {
      msgContainer.style.display = 'none';
      backupArea.style.display = 'none';
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
      flexShrink: '0',
      backgroundColor: '#fff'
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
    const btnTitle = makeBtn(instanceT('btn_title'), '#fbbc05', 'title');
    const btnCheck = makeBtn(instanceT('btn_check'), '#ea4335', 'check');
    const allBtns = [btnOptimize, btnTranslate, btnTitle, btnCheck];

    btnGrid.append(btnOptimize, btnTranslate, btnTitle, btnCheck);

    // 依序將元件塞入 popup (確保容器被包在裡面)
    popup.append(btnGrid, msgContainer, backupArea);
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
    const bubbleIcon = createElement('div', { textContent: '✦' }, { fontSize: '14px', lineHeight: '1' });
    bubble.append(bubbleIcon, bubbleLabel);
    document.body.appendChild(bubble);

    bubble.addEventListener('click', () => restore());

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
      e.preventDefault();
    });

    header.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      popup.style.left = `${e.clientX - offset.x}px`;
      popup.style.top = `${e.clientY - offset.y}px`;
      popup.style.right = 'auto';
      popup.style.bottom = 'auto';
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
        title: btnTitle.textContent, check: btnCheck.textContent
      };

      const activeBtn = { optimize: btnOptimize, translate: btnTranslate, title: btnTitle, check: btnCheck }[actionType];
      const statusKey = { optimize: 'status_processing', translate: 'status_translating', title: 'status_generating', check: 'status_checking' }[actionType];

      allBtns.forEach(b => b.disabled = true);
      activeBtn.textContent = instanceT(statusKey);

      // 處理中狀態
      showMessage(instanceT(statusKey), 'info');

      const settings = await storageGet(['optimizePrompt', 'titlePrompt', 'checkPrompt', 'translateLang']);
      let prompt = '';

      if (actionType === 'optimize') prompt = settings.optimizePrompt || I18N.getDefaultPrompts(currentLang).optimize;
      else if (actionType === 'title') prompt = settings.titlePrompt || I18N.getDefaultPrompts(currentLang).title;
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
            // 使用 success 樣式顯示綠色檢查結果
            showMessage(result, 'success');
          } else {
            activeBackup = { bodyEl: body, html: body.innerHTML };
            updateComposeBody(body, result);
            showMessage(actionType === 'translate'
              ? instanceT('msg_success_trans') + (settings.translateLang || 'English')
              : instanceT('msg_success_opt'), 'success');

            backupArea.innerHTML = '';
            const restoreBtn = createElement('button', { textContent: instanceT('backup_restore') }, {
              margin: '0', padding: '6px 12px', fontSize: '12px',
              backgroundColor: '#f1f3f4', border: '1px solid #dadce0', borderRadius: '6px',
              cursor: 'pointer', color: '#3c4043', fontWeight: '600'
            });
            restoreBtn.onclick = () => {
              if (activeBackup?.bodyEl?.isConnected) {
                // 直接還原完整 HTML（保留換行、顏色、粗體等格式）
                activeBackup.bodyEl.innerHTML = activeBackup.html;
                // 通知 Gmail 內容已變更（不透過 updateComposeBody，避免格式被轉成純文字）
                ['input', 'change'].forEach(evt =>
                  activeBackup.bodyEl.dispatchEvent(new Event(evt, { bubbles: true }))
                );
              }
              clearUI();
            };
            backupArea.append(restoreBtn);
            backupArea.style.display = 'block';
          }
        } else {
          showMessage(instanceT('msg_error_api') + response.error, 'error');
        }
      });
    }

    function updateLanguage(newLang) {
      currentLang = newLang;
      headerTitle.textContent = titleText();
      btnOptimize.textContent = instanceT('btn_optimize');
      btnTranslate.textContent = instanceT('btn_translate');
      btnTitle.textContent = instanceT('btn_title');
      btnCheck.textContent = instanceT('btn_check');
    }

    function destroy() {
      popup.remove();
      bubble.remove();
      windowPopupMap.delete(composeWin);
      repositionBubbles();
    }

    return { popup, bubble, minimize, restore, destroy, updateLanguage, minimized: false };
  }

  // --- Scanner ---
  async function scanAndInject() {
    const allCandidates = Array.from(document.querySelectorAll(SELECTORS.COMPOSE_WINDOW));
    const liveWindows = new Set(
      allCandidates.filter(win =>
        !allCandidates.some(other => other !== win && other.contains(win))
      )
    );

    windowPopupMap.forEach((instance, win) => {
      if (!liveWindows.has(win) || !win.isConnected) {
        instance.destroy();
      }
    });

    // 若尚未設定 API Key，不注入 popup
    const { apiKey } = await storageGet(['apiKey']);
    if (!apiKey) return;

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