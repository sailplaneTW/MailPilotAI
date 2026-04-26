// content_scripts/send-guard.js

function initSendGuard(composeWindow) {
  chrome.storage.local.get(['enableDoubleConfirm'], (data) => {
    if (data.enableDoubleConfirm === false) return; // Opt-out feature

    let isConfirmed = false;

    const bindSendButton = () => {
      // Known Gmail send button selectors
      const sendButton = composeWindow.querySelector('.gU.Up .dC > div') || 
                         composeWindow.querySelector('div[data-tooltip*="Send"]') || 
                         composeWindow.querySelector('div[data-tooltip*="傳送"]');
                         
      if (sendButton && !sendButton.dataset.mailrefineBound) {
        sendButton.dataset.mailrefineBound = 'true';
        
        // Intercept click using capture phase
        sendButton.addEventListener('click', (e) => {
          if (!isConfirmed) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Block original Gmail send event

            // Change button state to warning
            const originalText = sendButton.innerText;
            sendButton.innerText = '⚠️ 確認寄出？';
            sendButton.style.backgroundColor = '#d93025'; // Warning red

            isConfirmed = true;

            // Reset after 5 seconds if not clicked
            setTimeout(() => {
              if (sendButton) {
                isConfirmed = false;
                sendButton.innerText = originalText;
                sendButton.style.backgroundColor = ''; // Reset to default
              }
            }, 5000);
          }
          // If isConfirmed is true, the click passes through and sends the email
        }, true);
        return true;
      }
      return false;
    };

    // Gmail heavily uses dynamic rendering. The send button may not exist yet.
    if (!bindSendButton()) {
      let attempts = 0;
      const poll = setInterval(() => {
        if (bindSendButton() || attempts > 20) {
          clearInterval(poll);
        }
        attempts++;
      }, 500);
    }
  });
}
