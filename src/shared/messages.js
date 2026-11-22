import { MESSAGE_TYPES } from "./constants.js";

/**
 * Build a validated message envelope for extension-internal messaging.
 *
 * @param {string} type
 * @param {Record<string, unknown>} [payload]
 * @returns {{ type: string, payload: Record<string, unknown> }}
 */
export function createMessage(type, payload = {}) {
  if (typeof type !== "string" || type.trim() === "") {
    throw new TypeError("Message type must be a non-empty string.");
  }

  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("Message payload must be an object.");
  }

  return { type, payload };
}

/**
 * Check whether a value is a recognized TabRenamer message envelope.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExtensionMessage(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.type === "string" &&
    Object.values(MESSAGE_TYPES).includes(value.type) &&
    value.payload !== null &&
    typeof value.payload === "object" &&
    !Array.isArray(value.payload)
  );
}

/**
 * Trust messages only from this extension's own pages. Extension pages opened
 * in a tab legitimately have sender.tab set, so that field cannot be used to
 * distinguish them from content scripts.
 *
 * @param {chrome.runtime.MessageSender} sender
 * @param {string} extensionId
 * @returns {boolean}
 */
export function isTrustedExtensionPageSender(sender, extensionId) {
  if (!sender || sender.id !== extensionId || typeof sender.url !== "string") {
    return false;
  }

  try {
    const senderUrl = new URL(sender.url);
    return senderUrl.protocol === "chrome-extension:" &&
      senderUrl.hostname === extensionId;
  } catch {
    return false;
  }
}
