import { CONTEXT_MENU_IDS } from "../shared/constants.js";

const PARENT_ID = "tabrenamer-parent";

/**
 * Register context-menu actions for page tabs.
 *
 * Rename opens a small extension page because service workers cannot show
 * interactive prompts. Restore is executed directly by the background worker.
 */
export function registerTabContextMenus({
  contextMenus = globalThis.chrome?.contextMenus,
  tabs = globalThis.chrome?.tabs,
  runtime = globalThis.chrome?.runtime,
  titleService,
  logger = console,
} = {}) {
  if (!contextMenus?.onClicked || !contextMenus?.removeAll || !contextMenus?.create) {
    throw new TypeError("A compatible Chrome Context Menus API is required.");
  }
  if (!tabs?.create || !titleService?.restoreTab) {
    throw new TypeError("Compatible tab and title services are required.");
  }
  if (!runtime?.getURL) {
    throw new TypeError("A compatible Chrome Runtime API is required.");
  }

  const listener = (info, tab) => {
    if (!Number.isInteger(tab?.id) || tab.id < 0) return;

    if (info.menuItemId === CONTEXT_MENU_IDS.RENAME_TAB) {
      const url = new URL(runtime.getURL("src/rename/rename.html"));
      url.searchParams.set("tabId", String(tab.id));
      void tabs.create({ url: url.toString(), active: true }).catch((error) => {
        logger.error("[TabRenamer] Could not open the rename page.", error);
      });
      return;
    }

    if (info.menuItemId === CONTEXT_MENU_IDS.RESTORE_TITLE) {
      void titleService.restoreTab(tab).then((result) => {
        if (!result?.ok) logger.warn("[TabRenamer] Could not restore the page title:", result?.reason);
      }).catch((error) => {
        logger.error("[TabRenamer] Context-menu restore failed.", error);
      });
    }
  };

  contextMenus.onClicked.addListener(listener);

  const ready = new Promise((resolve, reject) => {
    contextMenus.removeAll(() => {
      const error = globalThis.chrome?.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      try {
        contextMenus.create({
          id: PARENT_ID,
          title: "TabRenamer",
          contexts: ["page"],
        });
        contextMenus.create({
          id: CONTEXT_MENU_IDS.RENAME_TAB,
          parentId: PARENT_ID,
          title: "Rename this tab…",
          contexts: ["page"],
        });
        contextMenus.create({
          id: CONTEXT_MENU_IDS.RESTORE_TITLE,
          parentId: PARENT_ID,
          title: "Restore original page title",
          contexts: ["page"],
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });

  void ready.catch((error) => logger.error("[TabRenamer] Context menus could not be registered.", error));

  return {
    ready,
    unregister() {
      contextMenus.onClicked.removeListener(listener);
    },
  };
}
