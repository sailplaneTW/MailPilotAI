// utils/i18n.js

const I18N_DICT = {
  en: {
    opt_title: "MailRefine Settings",
    opt_ui_lang: "UI Language",
    opt_api_key: "Gemini API Key",
    opt_model: "Model",
    opt_update_models: "Update Models",
    opt_prompt_optimize: "Optimize Body Prompt",
    opt_translate_lang: "Target Translation Language",
    opt_prompt_title: "Optimize Subject Prompt",
    opt_prompt_check: "Check Email Prompt (Disabled when empty)",
    opt_double_confirm: "Enable Double-Click Send Confirmation",
    opt_save: "Save Settings",
    opt_saved: "Settings saved!",

    ui_header: "MailRefine gmail Assistant",
    btn_optimize: "✨ Optimize",
    btn_translate: "🌐 Translate",
    btn_title: "📝 Optimize Subject",
    btn_check: "🔍 Check Email",

    status_processing: "⏳ Processing...",
    status_translating: "⏳ Translating...",
    status_generating: "⏳ Generating...",
    status_checking: "⏳ Checking...",

    msg_error_empty: "Email content is empty. Please enter text first.",
    msg_error_no_body: "Cannot find email body. Please click inside the email first.",
    msg_error_api: "API Error: ",
    msg_error_generic: "An error occurred: ",
    msg_error_no_check_prompt: "Please set the 'Check Email Prompt' in Settings first.",

    msg_success_opt: "Optimization complete!",
    msg_success_trans: "Translated to ",
    msg_success_title: "Subject updated: ",

    title_check_result: "🔍 Check Result",
    backup_title: "Original Backup",
    backup_restore: "↩ Restore",
    guard_warning: "⚠️ Confirm Send?",

    prompt_default_opt:
      "Please rewrite the following content according to business email communication conventions. The tone should be professional, polite, and logically clear. Please remove unnecessary words and overly polite rhetoric, and get straight to the point. When submitting your email, only provide the rewritten body text (excluding the title) so I can use it directly. Please keep the word count under 1500 words.",
    prompt_default_title: "Please generate an email subject based on the content and language of the email body."
  },
  zh_TW: {
    opt_title: "MailRefine 設定",
    opt_ui_lang: "介面語系",
    opt_api_key: "Gemini API Key",
    opt_model: "模型",
    opt_update_models: "更新模型",
    opt_prompt_optimize: "優化內文 Prompt",
    opt_translate_lang: "翻譯目標語言",
    opt_prompt_title: "優化標題 Prompt",
    opt_prompt_check: "信件檢查 Prompt (未填則停用)",
    opt_double_confirm: "Enable Double-Click Send Confirmation (寄信防呆)",
    opt_save: "儲存設定",
    opt_saved: "設定已儲存！",

    ui_header: "MailRefine gmail 助理",
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
    msg_error_no_check_prompt: "請先在設定中填寫「信件檢查 Prompt」。",

    msg_success_opt: "優化完成！",
    msg_success_trans: "已翻譯為",
    msg_success_title: "標題已更新：",

    title_check_result: "🔍 檢查結果",
    backup_title: "原始備份",
    backup_restore: "↩ 還原",
    guard_warning: "⚠️ 確認寄出？",

    prompt_default_opt: "請依據商務 Email 溝通慣例改寫以下內容。語氣需專業禮貌且邏輯清晰，請刪除不必要的贅字與過度客套的修辭，直接切入重點。輸出時僅需提供改寫後的內文（不含標題），以便我直接貼上使用。字數請在 1500 字內。",
    prompt_default_title: "請根據內文的內容及語系替我產生信件標題"
  },
  zh_CN: {
    opt_title: "MailRefine 设置",
    opt_ui_lang: "界面语言",
    opt_api_key: "Gemini API Key",
    opt_model: "模型",
    opt_update_models: "更新模型",
    opt_prompt_optimize: "优化正文 Prompt",
    opt_translate_lang: "翻译目标语言",
    opt_prompt_title: "优化标题 Prompt",
    opt_prompt_check: "邮件检查 Prompt (未填则停用)",
    opt_double_confirm: "Enable Double-Click Send Confirmation (发信防呆)",
    opt_save: "保存设置",
    opt_saved: "设置已保存！",

    ui_header: "MailRefine gmail 助手",
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
    msg_error_no_check_prompt: "请先在设置中填写“邮件检查 Prompt”。",

    msg_success_opt: "优化完成！",
    msg_success_trans: "已翻译为",
    msg_success_title: "标题已更新：",

    title_check_result: "🔍 检查结果",
    backup_title: "原始备份",
    backup_restore: "↩ 还原",
    guard_warning: "⚠️ 确认发送？",

    prompt_default_opt: "请依据商务 Email 沟通惯例改写以下内容。语气需专业礼貌且逻辑清晰，请删除不必要的赘字与过度客套的修辞，直接切入重点。输出时仅需提供改写后的内文（不含标题），以便我直接贴上使用。字数请在 1500 字内。",
    prompt_default_title: "请根据正文的内容及语系替我产生邮件标题"
  }
};

window.i18n = {
  getMessage: (key, lang = 'en') => {
    const dict = I18N_DICT[lang] || I18N_DICT['en'];
    return dict[key] || I18N_DICT['en'][key] || key;
  },
  getDefaultPrompts: (lang = 'en') => {
    return {
      optimize: window.i18n.getMessage('prompt_default_opt', lang),
      title: window.i18n.getMessage('prompt_default_title', lang)
    };
  }
};