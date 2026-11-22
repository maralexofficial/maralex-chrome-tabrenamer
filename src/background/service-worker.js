import { EXTENSION_NAME, MESSAGE_TYPES } from "../shared/constants.js";
import { isExtensionMessage } from "../shared/messages.js";

/**
 * Keep the service worker entry point deliberately small.
 * Feature-specific listeners are registered by their owning modules in
 * subsequent implementation phases.
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.info(`[${EXTENSION_NAME}] Installed (reason: ${details.reason}).`);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isExtensionMessage(message)) {
    return false;
  }

  if (message.type === MESSAGE_TYPES.PING) {
    sendResponse({
      ok: true,
      extension: EXTENSION_NAME,
    });
  }

  return false;
});
