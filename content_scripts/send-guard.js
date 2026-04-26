// content_scripts/send-guard.js

function initSendGuard(composeWindow) {
  chrome.storage.local.get(['enableDoubleConfirm'], (data) => {
    if (data.enableDoubleConfirm === false) return; // Opt-out feature

    // Known Gmail send button selector
    const sendButton = composeWindow.querySelector('.gU.Up .dC > div');
    if (!sendButton) return;

    let isConfirmed = false;

    // Intercept click using capture phase
    sendButton.addEventListener('click', (e) => {
      if (!isConfirmed) {
        e.preventDefault();
        e.stopImmediatePropagation(); // Block original Gmail send event

        // Change button state to warning
        const originalText = sendButton.innerText;
        sendButton.innerText = '⚠️ 確認寄出？';
        sendButton.style.backgroundColor = '#d93025'; // Warning red

        isConfirmed = true;

        // Reset after 5 seconds if not clicked
        setTimeout(() => {
          isConfirmed = false;
          sendButton.innerText = originalText;
          sendButton.style.backgroundColor = ''; // Reset to default
        }, 5000);
      }
      // If isConfirmed is true, the click passes through and sends the email
    }, true);
  });
}
