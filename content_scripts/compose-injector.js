(() => {
  if (window.__mailrefineComposeInjectorInstalled) return;
  window.__mailrefineComposeInjectorInstalled = true;

  const I18N = window.i18n || {
    getMessage: (key) => key,
    getDefaultPrompts: () => ({
      optimize: '',
      title: ''
    })
  };

  const POPUP_ID = 'mailrefine-popup';

  const COMPOSE_BODY_SELECTORS = [
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][g_editable="true"]',
    'div[contenteditable="true"][aria-label]',
    'div[contenteditable="true"][spellcheck="true"]'
  ].join(',');

  const SUBJECT_SELECTORS = [
    'input[name="subjectbox"]',
    'input[placeholder*="Subject"]',
    'input[aria-label*="Subject"]',
    'input[placeholder*="主旨"]',
    'input[aria-label*="主旨"]'
  ].join(',');

  const SEND_BUTTON_SELECTORS = [
    'div[role="button"][data-tooltip*="Send"]',
    'div[role="button"][data-tooltip*="傳送"]',
    'div[role="button"][aria-label*="Send"]',
    'div[role="button"][aria-label*="傳送"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="傳送"]'
  ].join(',');

  let popup = null;
  let msgArea = null;
  let contentArea = null;
  let headerEl = null;

  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragLeft = 0;
  let dragTop = 0;

  let originalHTML = '';
  let manualDismissed = false;

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function matchesComposeBody(el) {
    if (!el || !(el instanceof Element)) return false;
    if (!el.matches(COMPOSE_BODY_SELECTORS)) return false;
    if (!isVisible(el)) return false;
    if (el.closest('blockquote') || el.closest('.gmail_quote')) return false;
    return true;
  }

  function findComposeBodies() {
    return Array.from(document.querySelectorAll(COMPOSE_BODY_SELECTORS)).filter(matchesComposeBody);
  }

  function getBodyArea() {
    const active = document.activeElement;
    if (matchesComposeBody(active)) return active;

    const bodies = findComposeBodies();
    return bodies.length ? bodies[bodies.length - 1] : null;
  }

  function getComposeScope(bodyArea) {
    if (!bodyArea) return document.body;

    return bodyArea.closest('[role="dialog"]')
      || bodyArea.closest('.M9')
      || bodyArea.closest('.AD')
      || bodyArea.closest('form')
      || bodyArea.parentElement
      || document.body;
  }

  function getSubjectInput(bodyArea) {
    const scope = getComposeScope(bodyArea);
    const localSubject = scope ? scope.querySelector(SUBJECT_SELECTORS) : null;
    if (localSubject && isVisible(localSubject)) return localSubject;

    const globalSubject = Array.from(document.querySelectorAll(SUBJECT_SELECTORS)).find(isVisible);
    return globalSubject || null;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function dispatchEditableInput(el) {
    const inputEvent = typeof InputEvent === 'function'
      ? new InputEvent('input', { bubbles: true, composed: true })
      : new Event('input', { bubbles: true, composed: true });

    el.dispatchEvent(inputEvent);
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  function extractEditableText(bodyElement) {
    const clone = bodyElement.cloneNode(true);
    clone.querySelectorAll(
      '.gmail_signature, [data-smartmail="gmail_signature"], .gmail_quote, blockquote'
    ).forEach(el => el.remove());

    return clone.innerText.trim();
  }

  function replaceTextSafely(bodyElement, newText) {
    const html = newText
      .split('\n')
      .map(line => (line.trim() === '' ? '<div><br></div>' : `<div>${escapeHtml(line)}</div>`))
      .join('');

    const preserveSelectors = '.gmail_signature, [data-smartmail="gmail_signature"], .gmail_quote, blockquote';
    const preservedElements = [];

    bodyElement.querySelectorAll(preserveSelectors).forEach(el => {
      let isNested = false;
      let parent = el.parentElement;
      while (parent && parent !== bodyElement) {
        if (parent.matches && parent.matches(preserveSelectors)) {
          isNested = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!isNested) preservedElements.push(el);
    });

    preservedElements.forEach(el => el.remove());
    bodyElement.innerHTML = html;
    preservedElements.forEach(el => bodyElement.appendChild(el));
    dispatchEditableInput(bodyElement);
  }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.5' : '1';
    btn.style.cursor = loading ? 'not-allowed' : 'pointer';
  }

  function disableBtn(btn, disabled) {
    btn.disabled = disabled;
    btn.style.opacity = disabled ? '0.35' : '1';
    btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
  }

  function callGemini(prompt, content) {
    const finalPrompt = `${prompt}\n\n(Important instruction: Please limit the returned result to 1500 characters)`;

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'CALL_GEMINI_API', prompt: finalPrompt, content },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        }
      );
    });
  }

  function createPopup() {
    const existing = document.getElementById(POPUP_ID);
    if (existing) return existing;

    const root = document.createElement('div');
    root.id = POPUP_ID;
    Object.assign(root.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '320px',
      minWidth: '240px',
      minHeight: '80px',
      backgroundColor: '#ffffff',
      border: '1px solid #dadce0',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      zIndex: '999999',
      display: 'flex',
      flexDirection: 'column',
      resize: 'both',
      overflow: 'hidden',
      fontFamily: 'Google Sans, system-ui, sans-serif',
      fontSize: '13px',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '10px 12px',
      backgroundColor: '#f8f9fa',
      borderBottom: '1px solid #e8eaed',
      borderTopLeftRadius: '12px',
      borderTopRightRadius: '12px',
      cursor: 'grab',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      userSelect: 'none',
      flexShrink: '0',
    });

    const titleEl = document.createElement('span');
    titleEl.textContent = I18N.getMessage('ui_header');
    Object.assign(titleEl.style, {
      fontWeight: '600',
      color: '#202124'
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&#215;';
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '18px',
      color: '#5f6368',
      lineHeight: '1',
      padding: '0 2px',
    });

    header.append(titleEl, closeBtn);

    const funcArea = document.createElement('div');
    Object.assign(funcArea.style, {
      padding: '12px 14px',
      borderBottom: '1px solid #e8eaed',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px',
      flexShrink: '0',
    });

    function makeBtn(label, color = '#1a73e8') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      Object.assign(btn.style, {
        padding: '8px 4px',
        backgroundColor: color,
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '12px',
        minWidth: '100px',
        transition: 'background 0.15s, opacity 0.15s',
        whiteSpace: 'nowrap',
      });
      return btn;
    }

    const btnOptimize = makeBtn(I18N.getMessage('btn_optimize'), '#1a73e8');
    const btnTranslate = makeBtn(I18N.getMessage('btn_translate'), '#0f9d58');
    const btnTitle = makeBtn(I18N.getMessage('btn_title'), '#f29900');
    const btnCheck = makeBtn(I18N.getMessage('btn_check'), '#d93025');

    const allBtns = [btnOptimize, btnTranslate, btnTitle, btnCheck];
    funcArea.append(btnOptimize, btnTranslate, btnTitle, btnCheck);

    const msgAreaEl = document.createElement('div');
    Object.assign(msgAreaEl.style, {
      padding: '0 14px',
      maxHeight: '0',
      overflow: 'hidden',
      transition: 'max-height 0.2s ease, padding 0.2s ease',
      flexShrink: '0',
    });

    const contentAreaEl = document.createElement('div');
    Object.assign(contentAreaEl.style, {
      padding: '0 14px',
      maxHeight: '0',
      overflow: 'hidden',
      transition: 'max-height 0.2s ease, padding 0.2s ease',
      flexShrink: '0',
    });

    function showMsg(html) {
      msgAreaEl.innerHTML = html;
      msgAreaEl.style.maxHeight = '2000px';
      msgAreaEl.style.padding = '10px 14px';
    }

    function clearMsg() {
      msgAreaEl.style.maxHeight = '0';
      msgAreaEl.style.padding = '0 14px';
      msgAreaEl.innerHTML = '';
    }

    function showContent(html) {
      contentAreaEl.innerHTML = html;
      contentAreaEl.style.maxHeight = '180px';
      contentAreaEl.style.padding = '10px 14px 14px';
    }

    function clearContent() {
      contentAreaEl.style.maxHeight = '0';
      contentAreaEl.style.padding = '0 14px';
      contentAreaEl.innerHTML = '';
    }

    function msgSuccess(text) {
      showMsg(`
        <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;
          background:#e6f4ea;border:1px solid #ceead6;border-radius:6px;
          color:#137333;font-size:12px;">✓ ${escapeHtml(text)}</div>
      `);
    }

    function msgError(text) {
      showMsg(`
        <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;
          background:#fce8e6;border:1px solid #f5c6c2;border-radius:6px;
          color:#c5221f;font-size:12px;">⚠ ${escapeHtml(text)}</div>
      `);
    }

    function msgInfo(html) {
      showMsg(`
        <div style="padding:8px 10px;background:#e8f0fe;border:1px solid #c5d3f0;
          border-radius:6px;color:#1a55bd;font-size:12px;line-height:1.6;
          max-height:1800px;overflow-y:auto;white-space:pre-wrap;word-wrap:break-word;">${html}</div>
      `);
    }

    async function refreshCheckBtn() {
      const { checkPrompt } = await chrome.storage.local.get(['checkPrompt']);
      disableBtn(btnCheck, !checkPrompt || !checkPrompt.trim());
    }

    function setUIProcessing(isProcessing, activeBtn) {
      allBtns.forEach(btn => {
        if (btn === activeBtn) {
          setLoading(btn, isProcessing);
        } else {
          disableBtn(btn, isProcessing);
        }
      });
      if (!isProcessing && popup) refreshCheckBtn();
    }

    function showBackup(originalText, bodyArea) {
      showContent(`
        <details style="font-size:12px;">
          <summary style="cursor:pointer;font-weight:500;color:#5f6368;margin-bottom:8px;">
            ${I18N.getMessage('backup_title')}
          </summary>
          <div style="max-height:80px;overflow-y:auto;color:#5f6368;line-height:1.5;
            margin-bottom:8px;padding:6px 8px;background:#f8f9fa;border-radius:6px;
            white-space:pre-wrap;">${escapeHtml(originalText)}</div>
          <button class="restore-btn" type="button" style="padding:4px 10px;background:#fff;
            border:1px solid #dadce0;border-radius:6px;cursor:pointer;
            font-size:12px;color:#444746;">${I18N.getMessage('backup_restore')}</button>
        </details>
      `);

      const restoreBtn = contentAreaEl.querySelector('.restore-btn');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', () => {
          bodyArea.innerHTML = originalHTML;
          dispatchEditableInput(bodyArea);
          clearContent();
          clearMsg();
        });
      }
    }

    btnOptimize.addEventListener('click', async () => {
      const bodyArea = getBodyArea();
      if (!bodyArea) {
        msgError(I18N.getMessage('msg_error_no_body'));
        return;
      }

      const text = extractEditableText(bodyArea);
      if (!text.trim()) {
        msgError(I18N.getMessage('msg_error_empty'));
        return;
      }

      originalHTML = bodyArea.innerHTML;
      clearMsg();
      clearContent();

      const originalLabel = btnOptimize.textContent;
      btnOptimize.textContent = I18N.getMessage('status_processing');
      setUIProcessing(true, btnOptimize);

      try {
        const { optimizePrompt } = await chrome.storage.local.get(['optimizePrompt']);
        const prompt = optimizePrompt || I18N.getDefaultPrompts().optimize;
        const res = await callGemini(prompt, text);

        if (res && res.success) {
          replaceTextSafely(bodyArea, res.data);
          msgSuccess(I18N.getMessage('msg_success_opt'));
          showBackup(text, bodyArea);
        } else {
          msgError(`${I18N.getMessage('msg_error_api')}${res ? res.error : 'Unknown error'}`);
        }
      } catch (err) {
        console.error('[MailRefine]', err);
        msgError(`${I18N.getMessage('msg_error_generic')}${err.message}`);
      } finally {
        btnOptimize.textContent = originalLabel;
        setUIProcessing(false, btnOptimize);
      }
    });

    btnTranslate.addEventListener('click', async () => {
      const bodyArea = getBodyArea();
      if (!bodyArea) {
        msgError(I18N.getMessage('msg_error_no_body'));
        return;
      }

      const text = extractEditableText(bodyArea);
      if (!text.trim()) {
        msgError(I18N.getMessage('msg_error_empty'));
        return;
      }

      originalHTML = bodyArea.innerHTML;
      clearMsg();
      clearContent();

      const originalLabel = btnTranslate.textContent;
      btnTranslate.textContent = I18N.getMessage('status_translating');
      setUIProcessing(true, btnTranslate);

      try {
        const { translateLang } = await chrome.storage.local.get(['translateLang']);
        const lang = translateLang || 'English';
        const prompt = `Translate the following text to ${lang}. Only return the translation without any explanations or quotes.`;
        const res = await callGemini(prompt, text);

        if (res && res.success) {
          replaceTextSafely(bodyArea, res.data);
          msgSuccess(`${I18N.getMessage('msg_success_trans')} ${lang}`);
          showBackup(text, bodyArea);
        } else {
          msgError(`${I18N.getMessage('msg_error_api')}${res ? res.error : 'Unknown error'}`);
        }
      } catch (err) {
        console.error('[MailRefine]', err);
        msgError(`${I18N.getMessage('msg_error_generic')}${err.message}`);
      } finally {
        btnTranslate.textContent = originalLabel;
        setUIProcessing(false, btnTranslate);
      }
    });

    btnTitle.addEventListener('click', async () => {
      const bodyArea = getBodyArea();
      if (!bodyArea) {
        msgError(I18N.getMessage('msg_error_no_body'));
        return;
      }

      const subjectInput = getSubjectInput(bodyArea);
      if (!subjectInput) {
        msgError('Cannot find subject input.');
        return;
      }

      const text = extractEditableText(bodyArea);
      if (!text.trim()) {
        msgError(I18N.getMessage('msg_error_empty'));
        return;
      }

      clearMsg();
      clearContent();

      const originalLabel = btnTitle.textContent;
      btnTitle.textContent = I18N.getMessage('status_generating');
      setUIProcessing(true, btnTitle);

      try {
        const { titlePrompt } = await chrome.storage.local.get(['titlePrompt']);
        const prompt = titlePrompt || I18N.getDefaultPrompts().title;
        const fullPrompt = `${prompt}\n\nOnly return the subject text, without quotes or explanations.`;
        const res = await callGemini(fullPrompt, text);

        if (res && res.success) {
          const newTitle = res.data.trim().replace(/^["「『]|["」』]$/g, '');
          subjectInput.value = newTitle;
          dispatchEditableInput(subjectInput);
          msgSuccess(`${I18N.getMessage('msg_success_title')} ${newTitle}`);
        } else {
          msgError(`${I18N.getMessage('msg_error_api')}${res ? res.error : 'Unknown error'}`);
        }
      } catch (err) {
        console.error('[MailRefine]', err);
        msgError(`${I18N.getMessage('msg_error_generic')}${err.message}`);
      } finally {
        btnTitle.textContent = originalLabel;
        setUIProcessing(false, btnTitle);
      }
    });

    btnCheck.addEventListener('click', async () => {
      const bodyArea = getBodyArea();
      if (!bodyArea) {
        msgError(I18N.getMessage('msg_error_no_body'));
        return;
      }

      const text = extractEditableText(bodyArea);
      if (!text.trim()) {
        msgError(I18N.getMessage('msg_error_empty'));
        return;
      }

      clearMsg();
      clearContent();

      const originalLabel = btnCheck.textContent;
      btnCheck.textContent = I18N.getMessage('status_checking');
      setUIProcessing(true, btnCheck);

      try {
        const { checkPrompt } = await chrome.storage.local.get(['checkPrompt']);
        if (!checkPrompt || !checkPrompt.trim()) {
          msgError(I18N.getMessage('msg_error_no_check_prompt'));
          return;
        }

        const prompt = `${checkPrompt}\n\nPlease directly provide the check result, list the problems (if no problems, please state so).`;
        const res = await callGemini(prompt, text);

        if (res && res.success) {
          const formatted = escapeHtml(res.data.trim());
          msgInfo(`<strong>${I18N.getMessage('title_check_result')}</strong><br><br>${formatted}`);
        } else {
          msgError(`${I18N.getMessage('msg_error_api')}${res ? res.error : 'Unknown error'}`);
        }
      } catch (err) {
        console.error('[MailRefine]', err);
        msgError(`${I18N.getMessage('msg_error_generic')}${err.message}`);
      } finally {
        btnCheck.textContent = originalLabel;
        setUIProcessing(false, btnCheck);
      }
    });

    headerEl = header;
    msgArea = msgAreaEl;
    contentArea = contentAreaEl;

    root.append(header, funcArea, msgAreaEl, contentAreaEl);
    document.body.appendChild(root);

    closeBtn.addEventListener('click', () => {
      destroyPopup({ manual: true });
    });

    header.addEventListener('mousedown', (e) => {
      if (e.target === closeBtn) return;
      isDragging = true;
      header.style.cursor = 'grabbing';
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const r = root.getBoundingClientRect();
      dragLeft = r.left;
      dragTop = r.top;
      e.preventDefault();
    });

    const onMouseMove = (e) => {
      if (!isDragging || !popup) return;
      popup.style.bottom = 'auto';
      popup.style.right = 'auto';
      popup.style.left = `${dragLeft + e.clientX - dragStartX}px`;
      popup.style.top = `${dragTop + e.clientY - dragStartY}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
      if (headerEl) headerEl.style.cursor = 'grab';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    popup.__mailrefineCleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    refreshCheckBtn();

    return root;
  }

  function destroyPopup({ manual = false } = {}) {
    const existing = document.getElementById(POPUP_ID);
    if (existing) {
      if (typeof existing.__mailrefineCleanup === 'function') {
        existing.__mailrefineCleanup();
      }
      existing.remove();
    }

    popup = null;
    msgArea = null;
    contentArea = null;
    headerEl = null;

    if (manual) {
      manualDismissed = true;
    } else {
      manualDismissed = false;
    }
  }

  function ensurePopup() {
    if (popup || document.getElementById(POPUP_ID)) return;
    if (manualDismissed) return;

    const bodies = findComposeBodies();
    if (!bodies.length) return;

    popup = createPopup();
  }

  function scanComposeState() {
    const bodies = findComposeBodies();

    if (bodies.length > 0) {
      if (!popup && !manualDismissed) {
        ensurePopup();
      }
      return;
    }

    if (popup) {
      destroyPopup({ manual: false });
    } else {
      manualDismissed = false;
    }
  }

  window.MailRefine = window.MailRefine || {};
  window.MailRefine.scanComposeState = scanComposeState;
  window.MailRefine.destroyPopup = destroyPopup;
  window.MailRefine.ensurePopup = ensurePopup;
  window.MailRefine.__uiBootstrapped = true;

  // 初始掃描
  scanComposeState();
})();