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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isExtensionMessage(message)) return false;
  if (message.type === MESSAGE_TYPES.PING) {
    sendResponse({ ok: true, extension: EXTENSION_NAME });
  }
  return false;
});
