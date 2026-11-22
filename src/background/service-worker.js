import { EXTENSION_NAME, MESSAGE_TYPES } from "../shared/constants.js";
import { isExtensionMessage, isTrustedExtensionPageSender } from "../shared/messages.js";
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
  console.info("[" + EXTENSION_NAME + "] Runtime message received.", {
    messageType: message?.type,
    senderId: sender?.id,
    senderUrl: sender?.url,
    senderDocumentUrl: sender?.documentUrl,
    senderOrigin: sender?.origin,
  });
  if (!isExtensionMessage(message)) {
    console.warn("[" + EXTENSION_NAME + "] Ignored an invalid extension message.");
    return false;
  }
  if (message.type === MESSAGE_TYPES.PING) {
    sendResponse({ ok: true, extension: EXTENSION_NAME });
    return false;
  }
  if (!isTrustedExtensionPageSender(sender, chrome.runtime.id)) {
    console.warn("[" + EXTENSION_NAME + "] Rejected title operation from an untrusted sender.", {
      senderId: sender?.id,
      senderUrl: sender?.url,
      senderDocumentUrl: sender?.documentUrl,
      messageType: message.type,
    });
    sendResponse({ ok: false, reason: "The request did not originate from a TabRenamer page." });
    return false;
  }

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
    sendResponse({ ok: false, reason: "Unsupported TabRenamer operation." });
    return false;
  }

  void (async () => {
    try {
      const tab = await chrome.tabs.get(payload.tabId);
      console.info("[" + EXTENSION_NAME + "] Executing title operation.", {
        operation: message.type,
        tabId: payload.tabId,
        url: tab.url,
      });
      const result = message.type === MESSAGE_TYPES.RENAME_TAB
        ? await titleService.renameTab(tab, payload.customTitle)
        : await titleService.restoreTab(tab);
      console.info("[" + EXTENSION_NAME + "] Title operation completed.", {
        operation: message.type,
        tabId: payload.tabId,
        result,
      });
      sendResponse(result);
    } catch (error) {
      console.error("[" + EXTENSION_NAME + "] Title operation failed.", error);
      sendResponse({ ok: false, reason: "The title operation could not be completed." });
    }
  })();
  return true;
});
