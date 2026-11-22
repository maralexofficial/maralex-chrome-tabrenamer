import { EXTENSION_NAME, MESSAGE_TYPES } from "../shared/constants.js";
import { isExtensionMessage, isTrustedExtensionPageSender } from "../shared/messages.js";

/**
 * Register the extension-page runtime message boundary.
 * Returns an unregister callback for deterministic tests and teardown.
 */
export function registerRuntimeMessageHandler({
  runtime = globalThis.chrome?.runtime,
  tabsApi = globalThis.chrome?.tabs,
  titleService,
  logger = console,
} = {}) {
  if (!runtime?.onMessage || typeof runtime.id !== "string") {
    throw new TypeError("A compatible Chrome Runtime API is required.");
  }
  if (!tabsApi?.get) throw new TypeError("A compatible Chrome Tabs API is required.");
  if (!titleService?.renameTab || !titleService?.restoreTab) {
    throw new TypeError("A compatible title service is required.");
  }

  const listener = (message, sender, sendResponse) => {
    logger.info?.("[" + EXTENSION_NAME + "] Runtime message received.", {
      messageType: message?.type,
      senderId: sender?.id,
      senderUrl: sender?.url,
      senderDocumentUrl: sender?.documentUrl,
      senderOrigin: sender?.origin,
    });

    if (!isExtensionMessage(message)) {
      logger.warn?.("[" + EXTENSION_NAME + "] Ignored an invalid extension message.");
      return false;
    }
    if (message.type === MESSAGE_TYPES.PING) {
      sendResponse({ ok: true, extension: EXTENSION_NAME });
      return false;
    }
    if (!isTrustedExtensionPageSender(sender, runtime.id)) {
      logger.warn?.("[" + EXTENSION_NAME + "] Rejected title operation from an untrusted sender.", {
        senderId: sender?.id,
        senderUrl: sender?.url,
        senderDocumentUrl: sender?.documentUrl,
        messageType: message.type,
      });
      sendResponse({ ok: false, reason: "The request did not originate from a TabRenamer page." });
      return false;
    }

    const payload = message.payload;
    if (!Number.isInteger(payload?.tabId) || payload.tabId < 0) {
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
        const tab = await tabsApi.get(payload.tabId);
        logger.info?.("[" + EXTENSION_NAME + "] Executing title operation.", {
          operation: message.type,
          tabId: payload.tabId,
          url: tab.url,
        });
        const result = message.type === MESSAGE_TYPES.RENAME_TAB
          ? await titleService.renameTab(tab, payload.customTitle)
          : await titleService.restoreTab(tab);
        logger.info?.("[" + EXTENSION_NAME + "] Title operation completed.", {
          operation: message.type,
          tabId: payload.tabId,
          result,
        });
        sendResponse(result);
      } catch (error) {
        logger.error?.("[" + EXTENSION_NAME + "] Title operation failed.", error);
        sendResponse({ ok: false, reason: "The title operation could not be completed." });
      }
    })();
    return true;
  };

  runtime.onMessage.addListener(listener);
  return () => runtime.onMessage.removeListener(listener);
}
