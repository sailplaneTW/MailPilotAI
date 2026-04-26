// content_scripts/compose-injector.js

const DATA_ATTR = 'data-mailrefine-init';

function initMailRefineUI(composeWindow) {
  if (composeWindow.hasAttribute(DATA_ATTR)) return;
  composeWindow.setAttribute(DATA_ATTR, '1');

  // ── 浮動視窗 ───────────────────────────────────────────
  const popup = document.createElement('div');
  Object.assign(popup.style, {
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

  // ── 標題列 ─────────────────────────────────────────────
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
  titleEl.textContent = 'MailRefine 助理';
  Object.assign(titleEl.style, { fontWeight: '600', color: '#202124' });

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&#215;';
  Object.assign(closeBtn.style, {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '18px', color: '#5f6368', lineHeight: '1', padding: '0 2px',
  });

  header.append(titleEl, closeBtn);

  // ── 功能區：2×2 按鈕格 ────────────────────────────────
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
      transition: 'background 0.15s, opacity 0.15s',
      whiteSpace: 'nowrap',
    });
    return btn;
  }

  const btnOptimize = makeBtn('✨ 優化內文', '#1a73e8');
  const btnTranslate = makeBtn('🌐 翻譯內文', '#0f9d58');
  const btnTitle = makeBtn('📝 優化標題', '#f29900');
  const btnCheck = makeBtn('🔍 檢查信件', '#d93025');

  const allBtns = [btnOptimize, btnTranslate, btnTitle, btnCheck];

  funcArea.append(btnOptimize, btnTranslate, btnTitle, btnCheck);

  // ── 訊息區（中）───────────────────────────────────────
  const msgArea = document.createElement('div');
  Object.assign(msgArea.style, {
    padding: '0 14px',
    maxHeight: '0',
    overflow: 'hidden',
    transition: 'max-height 0.2s ease, padding 0.2s ease',
    flexShrink: '0',
  });

  // ── 內容區（下）───────────────────────────────────────
  const contentArea = document.createElement('div');
  Object.assign(contentArea.style, {
    padding: '0 14px',
    maxHeight: '0',
    overflow: 'hidden',
    transition: 'max-height 0.2s ease, padding 0.2s ease',
    flexShrink: '0',
  });

  popup.append(header, funcArea, msgArea, contentArea);
  document.body.appendChild(popup);

  // ── 訊息輔助 ───────────────────────────────────────────
  function showMsg(html) {
    msgArea.innerHTML = html;
    msgArea.style.maxHeight = '500px';
    msgArea.style.padding = '10px 14px';
  }
  function clearMsg() {
    msgArea.style.maxHeight = '0';
    msgArea.style.padding = '0 14px';
  }
  function showContent(html) {
    contentArea.innerHTML = html;
    contentArea.style.maxHeight = '180px';
    contentArea.style.padding = '10px 14px 14px';
  }
  function clearContent() {
    contentArea.style.maxHeight = '0';
    contentArea.style.padding = '0 14px';
  }

  function msgSuccess(text) {
    showMsg(`<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;
      background:#e6f4ea;border:1px solid #ceead6;border-radius:6px;
      color:#137333;font-size:12px;">✓ ${escapeHtml(text)}</div>`);
  }
  function msgError(text) {
    showMsg(`<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;
      background:#fce8e6;border:1px solid #f5c6c2;border-radius:6px;
      color:#c5221f;font-size:12px;">⚠ ${escapeHtml(text)}</div>`);
  }
  function msgInfo(html) {
    showMsg(`<div style="padding:8px 10px;background:#e8f0fe;border:1px solid #c5d3f0;
      border-radius:6px;color:#1a55bd;font-size:12px;line-height:1.6;
      max-height:400px;overflow-y:auto;">${html}</div>`);
  }

  // ── 按鈕停用輔助 ───────────────────────────────────────
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

  function setUIProcessing(isProcessing, activeBtn) {
    allBtns.forEach(btn => {
      if (btn === activeBtn) {
        setLoading(btn, isProcessing);
      } else {
        disableBtn(btn, isProcessing);
      }
    });
    if (!isProcessing) refreshCheckBtn();
  }

  // ── 讀取設定並初始化按鈕狀態 ──────────────────────────
  async function refreshCheckBtn() {
    const { checkPrompt } = await chrome.storage.local.get(['checkPrompt']);
    disableBtn(btnCheck, !checkPrompt || !checkPrompt.trim());
  }
  refreshCheckBtn();

  // ── Gemini API 呼叫 ────────────────────────────────────
  async function callGemini(prompt, content) {
    const finalPrompt = prompt + '\n\n(重要指令：請務必將回傳結果限制在 1500 字以內)';
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'CALL_GEMINI_API', prompt: finalPrompt, content }, resolve);
    });
  }

  // ── 取得信件 body ──────────────────────────────────────
  function getBodyArea() {
    return composeWindow.querySelector('div[contenteditable="true"]');
  }

  // ── 取得 subject input ────────────────────────────────
  function getSubjectInput() {
    return composeWindow.querySelector('input[name="subjectbox"]')
      || composeWindow.querySelector('input[placeholder*="主旨"]')
      || composeWindow.querySelector('input[placeholder*="Subject"]');
  }

  // ── 備份還原區塊 ───────────────────────────────────────
  let originalHTML = '';

  function showBackup(originalText, bodyArea) {
    showContent(`
      <details style="font-size:12px;">
        <summary style="cursor:pointer;font-weight:500;color:#5f6368;margin-bottom:8px;">原始備份</summary>
        <div style="max-height:80px;overflow-y:auto;color:#5f6368;line-height:1.5;
          margin-bottom:8px;padding:6px 8px;background:#f8f9fa;border-radius:6px;
          white-space:pre-wrap;">${escapeHtml(originalText)}</div>
        <button class="restore-btn" style="padding:4px 10px;background:#fff;
          border:1px solid #dadce0;border-radius:6px;cursor:pointer;
          font-size:12px;color:#444746;">↩ 還原</button>
      </details>
    `);
    contentArea.querySelector('.restore-btn').addEventListener('click', () => {
      bodyArea.innerHTML = originalHTML;
      bodyArea.dispatchEvent(new InputEvent('input', { bubbles: true }));
      clearContent();
      clearMsg();
    });
  }

  // ── ✨ 優化內文 ────────────────────────────────────────
  btnOptimize.addEventListener('click', async () => {
    const bodyArea = getBodyArea();
    if (!bodyArea) { msgError('找不到郵件內容區，請先點擊信件內文。'); return; }

    const text = extractEditableText(bodyArea);
    if (!text.trim()) { msgError('郵件內容是空的，請先輸入文字。'); return; }

    originalHTML = bodyArea.innerHTML;
    clearMsg(); clearContent();
    const orig = btnOptimize.textContent;
    btnOptimize.textContent = '⏳ 處理中...';
    setUIProcessing(true, btnOptimize);

    try {
      const { optimizePrompt } = await chrome.storage.local.get(['optimizePrompt']);
      const prompt = optimizePrompt || '請以商業 email 的慣例邏輯，替我改寫內文。不用過度客氣但請要有禮貌，也刪除不必要的冗字';
      const res = await callGemini(prompt, text);
      if (res && res.success) {
        replaceTextSafely(bodyArea, res.data);
        msgSuccess('優化完成！');
        showBackup(text, bodyArea);
      } else {
        msgError('API 錯誤：' + (res ? res.error : 'Unknown error'));
      }
    } catch (err) {
      console.error('[MailRefine]', err);
      msgError('發生錯誤：' + err.message);
    } finally {
      btnOptimize.textContent = orig;
      setUIProcessing(false, btnOptimize);
    }
  });

  // ── 🌐 翻譯內文 ────────────────────────────────────────
  btnTranslate.addEventListener('click', async () => {
    const bodyArea = getBodyArea();
    if (!bodyArea) { msgError('找不到郵件內容區，請先點擊信件內文。'); return; }

    const text = extractEditableText(bodyArea);
    if (!text.trim()) { msgError('郵件內容是空的，請先輸入文字。'); return; }

    originalHTML = bodyArea.innerHTML;
    clearMsg(); clearContent();
    const orig = btnTranslate.textContent;
    btnTranslate.textContent = '⏳ 翻譯中...';
    setUIProcessing(true, btnTranslate);

    try {
      const { translateLang } = await chrome.storage.local.get(['translateLang']);
      const lang = translateLang || '英文';
      const prompt = `請將以下信件內文翻譯成${lang}。只回傳翻譯後的內文，不要加任何說明或額外文字。`;
      const res = await callGemini(prompt, text);
      if (res && res.success) {
        replaceTextSafely(bodyArea, res.data);
        msgSuccess(`已翻譯為${lang}。`);
        showBackup(text, bodyArea);
      } else {
        msgError('API 錯誤：' + (res ? res.error : 'Unknown error'));
      }
    } catch (err) {
      console.error('[MailRefine]', err);
      msgError('發生錯誤：' + err.message);
    } finally {
      btnTranslate.textContent = orig;
      setUIProcessing(false, btnTranslate);
    }
  });

  // ── 📝 優化標題 ────────────────────────────────────────
  btnTitle.addEventListener('click', async () => {
    const bodyArea = getBodyArea();
    if (!bodyArea) { msgError('找不到郵件內容區，請先點擊信件內文。'); return; }

    const subjectInput = getSubjectInput();
    if (!subjectInput) { msgError('找不到主旨欄位。'); return; }

    const text = extractEditableText(bodyArea);
    if (!text.trim()) { msgError('郵件內容是空的，請先輸入文字。'); return; }

    clearMsg();
    const orig = btnTitle.textContent;
    btnTitle.textContent = '⏳ 產生中...';
    setUIProcessing(true, btnTitle);

    try {
      const { titlePrompt } = await chrome.storage.local.get(['titlePrompt']);
      const prompt = titlePrompt || '請根據內文的內容及語系替我產生信件標題';
      const fullPrompt = `${prompt}\n\n只回傳標題文字，不要加引號或任何說明。`;
      const res = await callGemini(fullPrompt, text);
      if (res && res.success) {
        const newTitle = res.data.trim().replace(/^["「『]|["」』]$/g, '');
        subjectInput.value = newTitle;
        subjectInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
        subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
        msgSuccess(`標題已更新：${newTitle}`);
      } else {
        msgError('API 錯誤：' + (res ? res.error : 'Unknown error'));
      }
    } catch (err) {
      console.error('[MailRefine]', err);
      msgError('發生錯誤：' + err.message);
    } finally {
      btnTitle.textContent = orig;
      setUIProcessing(false, btnTitle);
    }
  });

  // ── 🔍 檢查信件 ────────────────────────────────────────
  btnCheck.addEventListener('click', async () => {
    const bodyArea = getBodyArea();
    if (!bodyArea) { msgError('找不到郵件內容區，請先點擊信件內文。'); return; }

    const text = extractEditableText(bodyArea);
    if (!text.trim()) { msgError('郵件內容是空的，請先輸入文字。'); return; }

    clearMsg();
    const orig = btnCheck.textContent;
    btnCheck.textContent = '⏳ 檢查中...';
    setUIProcessing(true, btnCheck);

    try {
      const { checkPrompt } = await chrome.storage.local.get(['checkPrompt']);
      if (!checkPrompt || !checkPrompt.trim()) {
        msgError('請先在設定中填寫「信件檢查 Prompt」。');
        return;
      }
      const prompt = `${checkPrompt}\n\n請直接給出檢查結果，條列說明問題（若無問題請說明）。`;
      const res = await callGemini(prompt, text);
      if (res && res.success) {
        // 將 AI 回覆的換行轉為 <br> 顯示在訊息區
        const formatted = escapeHtml(res.data.trim()).replace(/\n/g, '<br>');
        msgInfo(`<strong>🔍 檢查結果</strong><br><br>${formatted}`);
      } else {
        msgError('API 錯誤：' + (res ? res.error : 'Unknown error'));
      }
    } catch (err) {
      console.error('[MailRefine]', err);
      msgError('發生錯誤：' + err.message);
    } finally {
      btnCheck.textContent = orig;
      setUIProcessing(false, btnCheck);
    }
  });

  // ── 拖拉 ───────────────────────────────────────────────
  let isDragging = false, startX, startY, initialLeft, initialTop;

  const onMouseMove = (e) => {
    if (!isDragging) return;
    popup.style.bottom = 'auto';
    popup.style.right = 'auto';
    popup.style.left = `${initialLeft + e.clientX - startX}px`;
    popup.style.top = `${initialTop + e.clientY - startY}px`;
  };
  const onMouseUp = () => {
    isDragging = false;
    header.style.cursor = 'grab';
  };

  header.addEventListener('mousedown', (e) => {
    if (e.target === closeBtn) return;
    isDragging = true;
    header.style.cursor = 'grabbing';
    startX = e.clientX;
    startY = e.clientY;
    const r = popup.getBoundingClientRect();
    initialLeft = r.left;
    initialTop = r.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // ── 統一清理 ───────────────────────────────────────────
  function destroyPopup() {
    popup.remove();
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    clearInterval(checkInterval);
  }

  closeBtn.addEventListener('click', destroyPopup);

  const checkInterval = setInterval(() => {
    if (!document.body.contains(composeWindow)) destroyPopup();
  }, 1000);
}

// ── Helper：排除簽名與引用回覆 ────────────────────────────
function extractEditableText(bodyElement) {
  const clone = bodyElement.cloneNode(true);
  clone.querySelectorAll(
    '.gmail_signature, [data-smartmail="gmail_signature"], .gmail_quote, blockquote'
  ).forEach(el => el.remove());
  return clone.innerText.trim();
}

// ── Helper：安全替換並觸發 Gmail 內部事件 ─────────────────
function replaceTextSafely(bodyElement, newText) {
  const html = newText
    .split('\n')
    .map(line => line.trim() === '' ? '<div><br></div>' : `<div>${escapeHtml(line)}</div>`)
    .join('');

  // 找出需要保留的元素 (簽名檔、引用回覆)
  const preserveSelectors = '.gmail_signature, [data-smartmail="gmail_signature"], .gmail_quote, blockquote';
  const preservedElements = [];
  
  bodyElement.querySelectorAll(preserveSelectors).forEach(el => {
    // 確保只抓取最外層的保留元素，避免重複抓取巢狀內容
    let isNested = false;
    let parent = el.parentElement;
    while (parent && parent !== bodyElement) {
      if (parent.matches && parent.matches(preserveSelectors)) {
        isNested = true;
        break;
      }
      parent = parent.parentElement;
    }
    if (!isNested) {
      preservedElements.push(el);
    }
  });

  // 暫時將這些元素從 DOM 中移除並保存
  preservedElements.forEach(el => el.remove());

  // 此時 bodyElement 剩下的就是使用者這次輸入的內容，我們將其覆寫為優化/翻譯後的內容
  bodyElement.innerHTML = html;

  // 將原本的簽名檔和引用回覆接回信件最下方
  preservedElements.forEach(el => bodyElement.appendChild(el));

  bodyElement.dispatchEvent(new InputEvent('input', { bubbles: true }));
  bodyElement.dispatchEvent(new Event('change', { bubbles: true }));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── MutationObserver：偵測新撰寫框 ────────────────────────
function observeComposeWindows() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        const candidates = new Set();
        if (node.matches?.('[role="dialog"]')) {
          candidates.add(node);
        } else {
          node.querySelectorAll?.('[role="dialog"]').forEach(el => candidates.add(el));
        }

        for (const win of candidates) {
          if (win.hasAttribute(DATA_ATTR)) continue;
          if (win.querySelector('div[contenteditable="true"]')) {
            win.setAttribute(DATA_ATTR, '1');
            setTimeout(() => initMailRefineUI(win), 500);
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

observeComposeWindows();