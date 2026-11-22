(() => {
  const controllerKey = "__tabRenamerTitleController__";

  if (globalThis[controllerKey]) {
    return;
  }

  let customTitle = null;
  let originalTitle = document.title;
  let observer = null;

  function stopObserving() {
    observer?.disconnect();
    observer = null;
  }

  function applyCustomTitle(title, fallbackOriginalTitle) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return false;
    }

    if (customTitle === null) {
      originalTitle = typeof fallbackOriginalTitle === "string"
        ? fallbackOriginalTitle
        : document.title;
    } else if (typeof fallbackOriginalTitle === "string") {
      originalTitle = fallbackOriginalTitle;
    }

    customTitle = title.trim();

    if (document.title !== customTitle) {
      document.title = customTitle;
    }

    if (!observer && document.documentElement) {
      observer = new MutationObserver(() => {
        if (customTitle !== null && document.title !== customTitle) {
          document.title = customTitle;
        }
      });

      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    }

    return true;
  }

  function restoreOriginalTitle(fallbackOriginalTitle) {
    stopObserving();

    const titleToRestore = typeof fallbackOriginalTitle === "string"
      ? fallbackOriginalTitle
      : originalTitle;

    customTitle = null;

    if (typeof titleToRestore === "string" && document.title !== titleToRestore) {
      document.title = titleToRestore;
    }

    originalTitle = document.title;
    return true;
  }

  const listener = (message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") {
      return false;
    }

    if (message.type === "TABRENAMER/APPLY_TITLE") {
      const ok = applyCustomTitle(message.payload?.customTitle, message.payload?.originalTitle);
      sendResponse({ ok });
      return false;
    }

    if (message.type === "TABRENAMER/RESTORE_TITLE") {
      const ok = restoreOriginalTitle(message.payload?.originalTitle);
      sendResponse({ ok });
      return false;
    }

    return false;
  };

  chrome.runtime.onMessage.addListener(listener);
  globalThis[controllerKey] = {
    applyCustomTitle,
    restoreOriginalTitle,
    stopObserving,
    getState: () => ({ customTitle, originalTitle, observing: observer !== null }),
  };
})();
