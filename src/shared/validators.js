import { TITLE_LIMITS } from "./constants.js";

/**
 * Validate and normalize a user-provided custom tab title.
 *
 * @param {unknown} value
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export function validateCustomTitle(value) {
  if (typeof value !== "string") {
    return { valid: false, error: "Title must be a string." };
  }

  const normalized = value.trim();

  if (normalized.length < TITLE_LIMITS.MIN_LENGTH) {
    return { valid: false, error: "Title must not be empty." };
  }

  if (normalized.length > TITLE_LIMITS.MAX_LENGTH) {
    return {
      valid: false,
      error: `Title must not exceed ${TITLE_LIMITS.MAX_LENGTH} characters.`,
    };
  }

  return { valid: true, value: normalized };
}

/**
 * Check whether a tab identifier is a valid non-negative integer.
 *
 * @param {unknown} tabId
 * @returns {boolean}
 */
export function isValidTabId(tabId) {
  return Number.isInteger(tabId) && tabId >= 0;
}
