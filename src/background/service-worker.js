import { EXTENSION_NAME, MESSAGE_TYPES } from "../shared/constants.js";
import { isExtensionMessage } from "../shared/messages.js";
import { StorageService } from "../services/storage-service.js";
import { TabService, registerTabLifecycleListeners } from "../services/tab-service.js";
import { TitleService, registerTitleNavigationListener } from "../services/title-service.js";

const storageService = new StorageService();
const tabService = new TabService({ storageService });
const titleService = new TitleService({ storageService });

registerTabLifecycleListeners({ storageService });
registerTitleNavigationListener({ titleService });

async function reconcileOpenTabs() {
  try {
    const tabs = await tabService.getTabs();
    await storageService.removeMissingTabs(tabs.map((tab) => tab.id));
  } catch (error) {
    console.error("[" + EXTENSION_NAME + "] Failed to reconcile open tabs.", error);
  }
}

void reconcileOpenTabs();

chrome.runtime.onInstalled.addListener((details) => {
  console.info("[" + EXTENSION_NAME + "] Installed (reason: " + details.reason + ").");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isExtensionMessage(message)) return false;

  if (message.type === MESSAGE_TYPES.PING) {
    sendResponse({ ok: true, extension: EXTENSION_NAME });
    return false;
  }

  // Only extension pages may initiate title operations. Content scripts are
  // intentionally unable to mutate records or request tab operations.
  if (sender.id !== chrome.runtime.id || sender.tab) return false;

  const payload = message.payload;
  if (!payload || !Number.isInteger(payload.tabId) || payload.tabId < 0) {
    sendResponse({ ok: false, reason: "Invalid tab request." });
    return false;
  }

  if (message.type === MESSAGE_TYPES.RENAME_TAB && typeof payload.customTitle !== "string") {
    sendResponse({ ok: false, reason: "Invalid custom title." });
    return false;
  }

  if (message.type !== MESSAGE_TYPES.RENAME_TAB && message.type !== MESSAGE_TYPES.RESTORE_TAB) {
    return false;
  }

  void (async () => {
    try {
      const tab = await chrome.tabs.get(payload.tabId);
      const result = message.type === MESSAGE_TYPES.RENAME_TAB
        ? await titleService.renameTab(tab, payload.customTitle, { permissionGranted: true })
        : await titleService.restoreTab(tab, undefined, { permissionGranted: true });
      sendResponse(result);
    } catch (error) {
      console.error("[" + EXTENSION_NAME + "] Title operation failed.", error);
      sendResponse({ ok: false, reason: "The title operation could not be completed." });
    }
  })();

  return true;
});
