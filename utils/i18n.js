// utils/i18n.js
(function () {
  const I18N_DICT = {
    en: {
      opt_title: "MailPilot Settings",
      opt_subtitle: "Configure Gemini, prompts, and send protection.",
      opt_ui_lang: "UI Language",
      opt_api_key: "Gemini API Key",
      opt_api_hint: "Stored locally in this browser.",
      opt_model: "Model",
      opt_update_models: "Update Models",
      opt_fetch_failed: "Fetch Failed",
      opt_model_hint: "Fetch available Gemini models after entering your API key.",
      opt_show: "Show",
      opt_hide: "Hide",
      opt_prompt_optimize: "Optimize Body Prompt",
      opt_translate_lang: "Target Translation Language",
      opt_prompt_title: "Optimize Subject Prompt",
      opt_prompt_check: "Check Email Prompt (Disabled when empty)",
      opt_prompt_hint: "Leave blank to use the default prompt for the selected language.",
      opt_double_confirm: "Enable Double-Click Send Confirmation",
      opt_double_confirm_hint: "Requires a second click on Send within 5 seconds.",
      opt_save: "Save Settings",
      opt_saved: "Settings saved!",

      popup_title: "MailPilot AI",
      popup_subtitle: "Gmail compose helper",
      popup_status_key: "API Key:",
      popup_status_model: "Model:",
      popup_status_set: "Configured",
      popup_status_missing: "Missing",
      popup_open_settings: "Open Settings",
      popup_tip: "Open settings to configure the API key and model.",

      ui_header: "MailPilot",
      btn_optimize: "✨ Optimize",
      btn_translate: "🌐 Translate",
      btn_title: "📝 Subject",
      btn_check: "🔍 Check",

      status_processing: "⏳ Processing...",
      status_translating: "⏳ Translating...",
      status_generating: "⏳ Generating...",
      status_checking: "⏳ Checking...",

      msg_error_empty: "Email content is empty. Please enter text first.",
      msg_error_no_body: "Cannot find email body. Please click inside the email first.",
      msg_error_api: "API Error: ",
      msg_error_generic: "An error occurred: ",
      msg_error_no_check_prompt: "Please set the 'Check Email Prompt' in Settings first.",
      msg_error_restore_lost: "Cannot restore. Email body might have changed.",
      msg_restore_done: "Restored to previous version.",

      msg_success_opt: "Optimization complete!",
      msg_success_trans: "Translated to ",
      msg_success_title: "Subject updated: ",

      title_check_result: "🔍 Check Result",
      backup_title: "Original Backup",
      backup_restore: "↩ Restore",
      guard_warning: "⚠️ Confirm Send?",
      guard_checking: "⏳ Checking email, please wait...",

      opt_auto_check: "Auto Email Check Before Send",
      opt_auto_check_hint: "Requires 'Check Email Prompt' to be filled in. Automatically enables Send Guard.",

      minimize_tooltip: "Minimize",

      prompt_default_opt: "Please rewrite the following content according to business email communication conventions. The tone should be professional, polite, and logically clear. Please remove unnecessary words and overly polite rhetoric, and get straight to the point. When submitting your email, only provide the rewritten body text (excluding the title) so I can use it directly. Please keep the word count under 1500 words.",
      prompt_default_title: "Please generate an email subject based on the content and language of the email body. The tone should be professional, polite, and concise. Please remove unnecessary words and overly polite rhetoric, and get straight to the point. When submitting your email, only provide the rewritten subject text, so I can use it directly."
    },
    zh_TW: {
      opt_title: "MailPilot 設定",
      opt_subtitle: "設定 Gemini 模型、提示詞與防呆機制",
      opt_ui_lang: "介面語系",
      opt_api_key: "Gemini API Key",
      opt_api_hint: "安全地儲存於瀏覽器本地端",
      opt_model: "模型",
      opt_update_models: "更新模型",
      opt_fetch_failed: "取得失敗",
      opt_model_hint: "輸入 API 金鑰後，點擊更新以取得可用模型",
      opt_show: "顯示",
      opt_hide: "隱藏",
      opt_prompt_optimize: "優化內文提示詞",
      opt_translate_lang: "翻譯目標語言",
      opt_prompt_title: "優化標題提示詞",
      opt_prompt_check: "信件檢查提示詞 (未填寫則停用)",
      opt_prompt_hint: "留空則使用目前語系的預設提示詞",
      opt_double_confirm: "寄信防呆",
      opt_double_confirm_hint: "開啟後，按下寄出後需在 5 秒內再次點擊確認",
      opt_save: "儲存設定",
      opt_saved: "設定已儲存！",

      popup_title: "MailPilot AI",
      popup_subtitle: "Gmail 寫信輔助工具",
      popup_status_key: "API 金鑰：",
      popup_status_model: "目前模型：",
      popup_status_set: "已設定",
      popup_status_missing: "未設定",
      popup_open_settings: "開啟設定",
      popup_tip: "請先前往設定頁面配置 API 金鑰與模型",

      ui_header: "MailPilot",
      btn_optimize: "✨ 優化內文",
      btn_translate: "🌐 翻譯內文",
      btn_title: "📝 優化標題",
      btn_check: "🔍 檢查信件",

      status_processing: "⏳ 處理中...",
      status_translating: "⏳ 翻譯中...",
      status_generating: "⏳ 產生中...",
      status_checking: "⏳ 檢查中...",

      msg_error_empty: "郵件內容是空的，請先輸入文字。",
      msg_error_no_body: "找不到郵件內容區，請先點擊信件內文。",
      msg_error_api: "API 錯誤：",
      msg_error_generic: "發生錯誤：",
      msg_error_no_check_prompt: "請先在設定中填寫「信件檢查提示詞」。",
      msg_error_restore_lost: "無法還原：找不到原始郵件內容區塊。",
      msg_restore_done: "已還原為先前的版本。",

      msg_success_opt: "優化完成！",
      msg_success_trans: "已翻譯為",
      msg_success_title: "標題已更新：",

      title_check_result: "🔍 檢查結果",
      backup_title: "原始備份",
      backup_restore: "↩ 還原",
      guard_warning: "⚠️ 確認寄出？",
      guard_checking: "⏳ 信件檢查中，請稍候...",

      opt_auto_check: "寄信前自動信件檢查",
      opt_auto_check_hint: "需先填寫「信件檢查提示詞」才會生效。開啟後將自動啟用寄信防呆。",

      minimize_tooltip: "最小化",

      prompt_default_opt: "請依據商務 Email 溝通慣例改寫以下內容。語氣需專業禮貌且邏輯清晰，請刪除不必要的贅字與過度客套的修辭，直接切入重點。輸出時僅需提供改寫後的內文（不含標題），以便我直接貼上使用。字數請在 1500 字內。",
      prompt_default_title: "請根據內文的內容及語系替我產生信件標題。語氣需專業禮貌且邏輯清晰，請刪除不必要的贅字與過度客套的修辭，直接切入重點。輸出時僅需提供改寫後的標題，以便我直接貼上使用"
    },
    zh_CN: {
      opt_title: "MailPilot 设置",
      opt_subtitle: "配置 Gemini 模型、提示词与防呆机制",
      opt_ui_lang: "界面语言",
      opt_api_key: "Gemini API Key",
      opt_api_hint: "安全地存储于浏览器本地端",
      opt_model: "模型",
      opt_update_models: "更新模型",
      opt_fetch_failed: "获取失败",
      opt_model_hint: "输入 API 密钥后，点击更新以获取可用模型",
      opt_show: "显示",
      opt_hide: "隐藏",
      opt_prompt_optimize: "优化正文提示词",
      opt_translate_lang: "翻译目标语言",
      opt_prompt_title: "优化标题提示词",
      opt_prompt_check: "邮件检查提示词 (未填写则停用)",
      opt_prompt_hint: "留空则使用当前语言的默认提示词",
      opt_double_confirm: "发信防呆",
      opt_double_confirm_hint: "开启后，点击发送后需在 5 秒内再次点击确认",
      opt_save: "保存设置",
      opt_saved: "设置已保存！",

      popup_title: "MailPilot AI",
      popup_subtitle: "Gmail 写信辅助工具",
      popup_status_key: "API 密钥：",
      popup_status_model: "当前模型：",
      popup_status_set: "已设置",
      popup_status_missing: "未设置",
      popup_open_settings: "打开设置",
      popup_tip: "请先前往设置页面配置 API 密钥与模型",

      ui_header: "MailPilot",
      btn_optimize: "✨ 优化正文",
      btn_translate: "🌐 翻译正文",
      btn_title: "📝 优化标题",
      btn_check: "🔍 检查邮件",

      status_processing: "⏳ 处理中...",
      status_translating: "⏳ 翻译中...",
      status_generating: "⏳ 生成中...",
      status_checking: "⏳ 检查中...",

      msg_error_empty: "邮件内容为空，请先输入文字。",
      msg_error_no_body: "找不到邮件内容区，请先点击信件正文。",
      msg_error_api: "API 错误：",
      msg_error_generic: "发生错误：",
      msg_error_no_check_prompt: "请先在设置中填写“邮件检查提示词”。",
      msg_error_restore_lost: "无法还原：找不到原始邮件内容区块。",
      msg_restore_done: "已还原为先前的版本。",

      msg_success_opt: "优化完成！",
      msg_success_trans: "已翻译为",
      msg_success_title: "标题已更新：",

      title_check_result: "🔍 检查结果",
      backup_title: "原始备份",
      backup_restore: "↩ 还原",
      guard_warning: "⚠️ 确认发送？",
      guard_checking: "⏳ 信件检查中，请稍候...",

      opt_auto_check: "发信前自动邮件检查",
      opt_auto_check_hint: "需先填写「邮件检查提示词」才会生效。开启后将自动启用发信防呆。",

      minimize_tooltip: "最小化",

      prompt_default_opt: "请依据商务 Email 沟通惯例改写以下内容。语气需专业礼貌且逻辑清晰，请删除不必要的赘字与过度客套的修辞，直接切入重点。输出时仅需提供改写后的正文（不含标题），以便我直接贴上使用。字数请在 1500 字内。",
      prompt_default_title: "请根据正文的内容及语系替我产生邮件标题。语气需专业礼貌且逻辑清晰，请删除不必要的赘字与过度客套的修辞，直接切入重点。输出时仅需提供改写后的标题，以便我直接贴上使用"
    }
  };

  window.i18n = {
    getMessage: (key, lang = 'en') => {
      const dict = I18N_DICT[lang] || I18N_DICT['en'];
      return dict[key] || (I18N_DICT['en'] ? I18N_DICT['en'][key] : '') || key;
    },
    getDefaultPrompts: (lang = 'en') => {
      return {
        optimize: window.i18n.getMessage('prompt_default_opt', lang),
        title: window.i18n.getMessage('prompt_default_title', lang)
      };
    }
  };
})();