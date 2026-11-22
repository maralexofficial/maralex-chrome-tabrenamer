/**
 * Shared application constants.
 */

export const EXTENSION_NAME = "TabRenamer";

export const MESSAGE_TYPES = Object.freeze({
  PING: "TABRENAMER/PING",
  APPLY_TITLE: "TABRENAMER/APPLY_TITLE",
  RESTORE_TITLE: "TABRENAMER/RESTORE_TITLE",
  RENAME_TAB: "TABRENAMER/RENAME_TAB",
  RESTORE_TAB: "TABRENAMER/RESTORE_TAB",
});

export const STORAGE_KEYS = Object.freeze({
  TAB_NAMES: "tabNames",
});

export const TITLE_LIMITS = Object.freeze({
  MIN_LENGTH: 1,
  MAX_LENGTH: 80,
});
