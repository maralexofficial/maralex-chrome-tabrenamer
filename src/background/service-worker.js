import { EXTENSION_NAME } from "../shared/constants.js";
import { StorageService } from "../services/storage-service.js";
import { TabService, registerTabLifecycleListeners } from "../services/tab-service.js";
import { TitleService, registerTitleNavigationListener } from "../services/title-service.js";
import { registerRuntimeMessageHandler } from "../services/runtime-message-service.js";

const storageService = new StorageService();
const tabService = new TabService({ storageService });
const titleService = new TitleService({ storageService });

registerTabLifecycleListeners({ storageService });
registerTitleNavigationListener({ titleService });
registerRuntimeMessageHandler({ titleService });

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
