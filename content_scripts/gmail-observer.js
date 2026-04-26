// content_scripts/gmail-observer.js

// Known Gmail compose window selectors
const COMPOSE_WINDOW_SELECTOR = '.M9';
const TOOLBAR_SELECTOR = '.btC';

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Check if a compose window was added or opened
        const composeWindows = document.querySelectorAll(COMPOSE_WINDOW_SELECTOR);
        composeWindows.forEach(window => {
          if (!window.dataset.mailrefineInjected) {
            window.dataset.mailrefineInjected = 'true';
            initMailRefineUI(window);
            initSendGuard(window);
          }
        });
      }
    }
  }
});

// Start observing the body for injected compose dialogs
observer.observe(document.body, { childList: true, subtree: true });
