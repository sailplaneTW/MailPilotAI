# MailPilot AI – Gmail Writer 🚀

MailPilot AI (formerly MailRefine) is a powerful, AI-driven Chrome Extension designed specifically for Gmail. Powered by the Gemini API, it seamlessly integrates into your Gmail compose window to help you write, rewrite, translate, and optimize your emails in seconds.

## ✨ Features

MailPilot AI injects a non-intrusive floating assistant into your Gmail compose window, offering the following capabilities:

- **✨ Optimize Body (優化內文)**: Automatically rewrites your email draft to make it sound more professional, polite, and logically clear, removing unnecessary fluff.
- **🌐 Translate Body (翻譯內文)**: Instantly translates your draft into your target language (e.g., English, Japanese, Chinese) without messing up your email formatting or signatures.
- **📝 Generate Subject (優化標題)**: Reads your email body and automatically generates a fitting, professional subject line.
- **🔍 Check Email (檢查信件)**: Reviews your email for typos, grammar mistakes, and tone issues before you hit send.
- **⚠️ Send Guard (寄信防呆機制)**: An optional double-confirmation feature that intercepts the Gmail "Send" button. Clicking send will turn the button red and ask "⚠️ Confirm Send?". You have to click it again within 5 seconds to actually send the email, preventing accidental premature sends!
- **🌍 Multilingual UI Support**: Full interface and default prompt support for **English**, **Traditional Chinese (正體中文)**, and **Simplified Chinese (简体中文)**.

## 🛠 Installation

Currently, MailPilot AI is loaded as an unpacked extension.

1. **Clone or Download the Repository:**
   ```bash
   git clone https://github.com/yourusername/MailPilot-AI.git
   ```
2. **Open Chrome Extensions Page:**
   Navigate to `chrome://extensions/` in your Google Chrome browser.
3. **Enable Developer Mode:**
   Toggle the "Developer mode" switch in the top right corner.
4. **Load the Extension:**
   Click the **"Load unpacked"** button in the top left and select the folder where you downloaded MailPilot AI.
5. **Pin the Extension:**
   Click the puzzle icon in Chrome and pin MailPilot AI for easy access.

## ⚙️ Configuration & Setup

Before using the extension, you must configure your Gemini API Key.

1. Right-click the MailPilot AI extension icon and select **Options** (or click it to open the popup and go to settings).
2. **UI Language**: Select your preferred interface language.
3. **Gemini API Key**: Paste your Google Gemini API Key. *(You can get one from [Google AI Studio](https://aistudio.google.com/))*
4. **Model Selection**: Once the API key is verified, select the Gemini model you wish to use (e.g., `gemini-2.0-flash` or `gemini-1.5-pro`).
5. **Customize Prompts**: You can optionally customize the system prompts used for Optimizing, Translating, Generating Subjects, and Checking emails. If left blank, the extension will automatically use the optimized defaults for your chosen language.
6. Click **Save Settings**.

## 💻 How to Use

1. Open Gmail and click **Compose** to write a new email (or reply to an existing one).
2. A small **MailPilot AI floating window** will appear in the bottom right corner of your screen.
3. Type your rough draft into the Gmail compose box.
4. Click any of the assistant buttons (✨ Optimize, 🌐 Translate, 📝 Title, 🔍 Check).
5. The extension will securely communicate with the Gemini API and seamlessly replace/update your text while **preserving your email signatures and quoted replies**.
6. If you don't like the AI's revision, you can easily click **"↩ Restore"** in the popup to revert to your original draft.

## 🏗 Project Architecture

- **`manifest.json`**: Chrome extension configuration (Manifest V3).
- **`content_scripts/compose-injector.js`**: Core UI injection script that adds the floating assistant to Gmail and handles text replacement.
- **`content_scripts/gmail-observer.js`**: Advanced DOM observer that detects when a new Gmail compose window is opened.
- **`content_scripts/send-guard.js`**: Logic for the Send button double-click interception.
- **`utils/i18n.js`**: Centralized localization dictionary for the UI and AI prompts.
- **`options/`**: Settings page UI and logic.
- **`background/service-worker.js`**: Background script responsible for securely handling Gemini API requests to prevent exposing API calls directly in the content scripts.

## 🔒 Privacy & Security

- **API Keys are stored locally**: Your Gemini API key is securely stored in your browser's local storage (`chrome.storage.local`) and is never sent to any third-party servers other than Google's official Gemini API.
- **Email Content**: The extension only reads the content of the compose window *when you explicitly click an action button*. The content is sent directly to Google Gemini for processing.

---
*Built to make email writing effortless and error-free.*
