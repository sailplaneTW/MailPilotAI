/**
 * utils/common.js
 * Shared utility functions for MailPilot AI Extension.
 */
window.MailPilotUtils = (() => {
  /**
   * Safe wrapper for chrome.storage.local.get
   * @param {string|string[]} keys 
   * @returns {Promise<Object>}
   */
  async function storageGet(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (data) => resolve(data));
    });
  }

  /**
   * Safe wrapper for chrome.storage.local.set
   * @param {Object} data 
   * @returns {Promise<void>}
   */
  async function storageSet(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, () => resolve());
    });
  }

  /**
   * Get current UI language from storage
   * @returns {Promise<string>}
   */
  async function getUILanguage() {
    const { uiLang } = await storageGet(['uiLang']);
    return uiLang || 'en';
  }

  /**
   * Helper to create a DOM element with attributes and styles
   */
  function createElement(tag, props = {}, style = {}) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    Object.assign(el.style, style);
    return el;
  }

  return {
    storageGet,
    storageSet,
    getUILanguage,
    createElement
  };
})();
