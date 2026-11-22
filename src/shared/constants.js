/**
 * Shared application constants.
 */

export const EXTENSION_NAME = "TabRenamer";

export const MESSAGE_TYPES = Object.freeze({
  PING: "TABRENAMER/PING",
});

export const STORAGE_KEYS = Object.freeze({
  TAB_NAMES: "tabNames",
});

export const CONTEXT_MENU_IDS = Object.freeze({
  RENAME_TAB: "tabrenamer-rename-tab",
  RESTORE_TITLE: "tabrenamer-restore-title",
});

export const TITLE_LIMITS = Object.freeze({
  MIN_LENGTH: 1,
  MAX_LENGTH: 80,
});
