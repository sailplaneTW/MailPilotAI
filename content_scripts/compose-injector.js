(() => {
  if (window.__mailpilotComposeInjectorInstalled) return;
  window.__mailpilotComposeInjectorInstalled = true;

  // 確保 i18n 已載入，若未載入則提供 fallback
  const getI18n = () => window.i18n || {
    getMessage: (k) => k,
    getDefaultPrompts: () => ({ optimize: '', title: '' })
  };

  const POPUP_ID = 'mailpilot-popup';
  const COMPOSE_BODY_SELECTORS = 'div[contenteditable="true"][role="textbox"], div[contenteditable="true"][g_editable="true"]';
  const SUBJECT_SELECTORS = 'input[name="subjectbox"], input[placeholder*="Subject"], input[aria-label*="Subject"], input[placeholder*="主旨"]';

  let popup = null;
  let isDragging = false;
  let currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;
  let originalHTML = '';

  // 輔助函式：尋找當前編輯框
  function getActiveCompose() {
    const active = document.activeElement;
    if (active && active.matches(COMPOSE_BODY_SELECTORS)) return active;
    const bodies = document.querySelectorAll(COMPOSE_BODY_SELECTORS);
    return bodies.length ? bodies[bodies.length - 1] : null;
  }

  function replaceTextSafely(bodyElement, newText) {
    const html = newText.split('\n').map(line => line.trim() === '' ? '<div><br></div>' : `<div>${line}</div>`).join('');
    const signature = bodyElement.querySelector('.gmail_signature, [data-smartmail="gmail_signature"]');

    // 移除舊內容但不影響簽名檔
    const contentNodes = Array.from(bodyElement.childNodes).filter(node => node !== signature);
    contentNodes.forEach(node => node.remove());

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    if (signature) {
      bodyElement.insertBefore(tempDiv, signature);
    } else {
      bodyElement.appendChild(tempDiv);
    }

    bodyElement.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function createPopup() {
    if (document.getElementById(POPUP_ID)) return document.getElementById(POPUP_ID);

    const i18n = getI18n();
    const root = document.createElement('div');
    root.id = POPUP_ID;
    Object.assign(root.style, {
      position: 'fixed', bottom: '20px', right: '20px', width: '300px',
      backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)', zIndex: '999999',
      fontFamily: 'Segoe UI, Tahoma, sans-serif', overflow: 'hidden'
    });

    root.innerHTML = `
      <div id="${POPUP_ID}-header" style="padding:10px; background:#f1f3f4; cursor:move; display:flex; justify:space-between; align-items:center; border-bottom:1px solid #ddd;">
        <span style="font-weight:bold; font-size:13px; color:#444;">${i18n.getMessage('ui_header')}</span>
        <button id="${POPUP_ID}-close" style="background:none; border:none; cursor:pointer; font-size:16px;">×</button>
      </div>
      <div style="padding:12px; display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
        <button id="mr-opt" style="padding:8px; background:#1a73e8; color:white; border:none; border-radius:6px; cursor:pointer; font-size:12px;">${i18n.getMessage('btn_optimize')}</button>
        <button id="mr-trans" style="padding:8px; background:#34a853; color:white; border:none; border-radius:6px; cursor:pointer; font-size:12px;">${i18n.getMessage('btn_translate')}</button>
        <button id="mr-title" style="padding:8px; background:#fbbc05; color:white; border:none; border-radius:6px; cursor:pointer; font-size:12px;">${i18n.getMessage('btn_title')}</button>
        <button id="mr-check" style="padding:8px; background:#ea4335; color:white; border:none; border-radius:6px; cursor:pointer; font-size:12px;">${i18n.getMessage('btn_check')}</button>
      </div>
      <div id="mr-msg" style="padding:0 12px 12px; font-size:12px; display:none;"></div>
      <div id="mr-restore-zone" style="padding:0 12px 12px; display:none;">
        <button id="mr-restore" style="width:100%; padding:4px; background:#f8f9fa; border:1px solid #ddd; border-radius:4px; cursor:pointer;">${i18n.getMessage('backup_restore')}</button>
      </div>
    `;

    document.body.appendChild(root);

    // 拖曳邏輯優化
    const header = root.querySelector(`#${POPUP_ID}-header`);
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      if (e.target === header) isDragging = true;
    }
    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        root.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    }
    function dragEnd() { isDragging = false; }

    // 功能綁定
    root.querySelector('#mr-opt').addEventListener('click', () => handleAction('optimize'));
    root.querySelector('#mr-trans').addEventListener('click', () => handleAction('translate'));
    root.querySelector('#mr-title').addEventListener('click', () => handleAction('title'));
    root.querySelector('#mr-check').addEventListener('click', () => handleAction('check'));
    root.querySelector('#mr-close').addEventListener('click', () => { root.style.display = 'none'; });
    root.querySelector('#mr-restore').addEventListener('click', () => {
      const body = getActiveCompose();
      if (body) {
        body.innerHTML = originalHTML;
        root.querySelector('#mr-restore-zone').style.display = 'none';
      }
    });

    return root;
  }

  async function handleAction(type) {
    const body = getActiveCompose();
    if (!body) return alert(getI18n().getMessage('msg_error_no_body'));

    const text = body.innerText.trim();
    if (!text) return alert(getI18n().getMessage('msg_error_empty'));

    const msgBox = document.getElementById('mr-msg');
    msgBox.style.display = 'block';
    msgBox.innerText = getI18n().getMessage('status_processing');

    originalHTML = body.innerHTML;

    try {
      let prompt = "";
      const settings = await chrome.storage.local.get(['optimizePrompt', 'titlePrompt', 'checkPrompt', 'translateLang', 'uiLang']);
      const lang = settings.uiLang || 'en';

      if (type === 'optimize') prompt = settings.optimizePrompt || getI18n().getDefaultPrompts(lang).optimize;
      else if (type === 'title') prompt = settings.titlePrompt || getI18n().getDefaultPrompts(lang).title;
      else if (type === 'check') prompt = settings.checkPrompt || "Check this email for grammar and tone.";
      else if (type === 'translate') prompt = `Translate to ${settings.translateLang || 'English'}. Only return result.`;

      chrome.runtime.sendMessage({ action: 'CALL_GEMINI_API', prompt, content: text }, (res) => {
        if (res.success) {
          if (type === 'title') {
            const subject = document.querySelector(SUBJECT_SELECTORS);
            if (subject) subject.value = res.data.replace(/"/g, '');
          } else if (type === 'check') {
            msgBox.innerHTML = `<strong>Result:</strong><br>${res.data}`;
          } else {
            replaceTextSafely(body, res.data);
            document.getElementById('mr-restore-zone').style.display = 'block';
          }
          msgBox.innerText = "Done!";
          setTimeout(() => { if (type !== 'check') msgBox.style.display = 'none'; }, 3000);
        } else {
          msgBox.innerText = "Error: " + res.error;
        }
      });
    } catch (err) {
      msgBox.innerText = "Fatal Error.";
    }
  }

  // 每隔一段時間檢查是否需要顯示彈窗
  setInterval(() => {
    const body = getActiveCompose();
    if (body && !popup) popup = createPopup();
    if (popup) popup.style.display = body ? 'block' : 'none';
  }, 1500);

})();