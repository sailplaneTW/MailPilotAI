(() => {
  if (window.__mailpilotObserverInstalled) return;
  window.__mailpilotObserverInstalled = true;

  const queueScan = () => {
    try {
      window.MailPilot?.scanComposeState?.();
    } catch (err) {
      console.error('[MailPilot][observer]', err);
    }
  };

  const scheduleScan = (() => {
    let rafId = null;
    return () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        queueScan();
      });
    };
  })();

  const startObserver = () => {
    if (!document.body) return false;

    const observer = new MutationObserver(() => {
      scheduleScan();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    document.addEventListener('focusin', scheduleScan, true);
    document.addEventListener('click', scheduleScan, true);
    document.addEventListener('keydown', scheduleScan, true);
    setInterval(scheduleScan, 1200);

    queueScan();
    return true;
  };

  if (!startObserver()) {
    const bootTimer = setInterval(() => {
      if (startObserver()) clearInterval(bootTimer);
    }, 300);
  }
})();