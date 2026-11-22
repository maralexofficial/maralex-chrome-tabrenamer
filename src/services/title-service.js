import { MESSAGE_TYPES } from "../shared/constants.js";
import { validateCustomTitle } from "../shared/validators.js";

const CONTENT_SCRIPT_FILE = "src/content/title-controller.js";

/**
 * Coordinates required website permissions, content-script registration,
 * document title updates, and session record persistence.
 */
export class TitleService {
  #tabs;
  #permissions;
  #scripting;
  #storage;
  #logger;

  constructor({
    tabs = globalThis.chrome?.tabs,
    permissions = globalThis.chrome?.permissions,
    scripting = globalThis.chrome?.scripting,
    storageService,
    logger = console,
  } = {}) {
    if (!tabs?.sendMessage || !tabs?.get) {
      throw new TypeError("A compatible Chrome Tabs API is required.");
    }
    if (!permissions?.contains) {
      throw new TypeError("A compatible Chrome Permissions API is required.");
    }
    if (!scripting?.executeScript || !scripting?.registerContentScripts) {
      throw new TypeError("A compatible Chrome Scripting API is required.");
    }
    if (!storageService?.get || !storageService?.setTabName || !storageService?.remove) {
      throw new TypeError("A compatible storage service is required.");
    }

    this.#tabs = tabs;
    this.#permissions = permissions;
    this.#scripting = scripting;
    this.#storage = storageService;
    this.#logger = logger;
  }

  /**
   * Apply a custom title to a tab after verifying the one-time website permission.
   *
   * @param {chrome.tabs.Tab} tab
   * @param {string} customTitle
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  async renameTab(tab, customTitle) {
    if (!Number.isInteger(tab?.id) || tab.id < 0) {
      return { ok: false, reason: "The selected tab is no longer available." };
    }

    const validated = validateCustomTitle(customTitle);
    if (!validated.valid) {
      return { ok: false, reason: validated.error };
    }

    const originPattern = this.#getOriginPattern(tab.url);
    if (!originPattern) {
      return { ok: false, reason: "This page does not allow title management." };
    }

    let hasAccess = false;
    try {
      // Website access is granted once through required host_permissions.
      // The worker only verifies that Chrome still exposes that permission.
      hasAccess = await this.#permissions.contains({ origins: [originPattern] });
    } catch (error) {
      this.#logger.warn("[TabRenamer] Site permission check failed.", error);
      return { ok: false, reason: "Could not verify access to this website." };
    }

    if (!hasAccess) {
      return { ok: false, reason: "Website access was not granted." };
    }

    try {
      await this.#registerContentScript(originPattern);
      await this.#ensureController(tab.id);

      const response = await this.#tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.APPLY_TITLE,
        payload: {
          customTitle: validated.value,
          originalTitle: typeof tab.title === "string" ? tab.title : "",
        },
      });

      if (!response?.ok) {
        return { ok: false, reason: "The page did not accept the custom title." };
      }

      try {
        await this.#storage.setTabName(
          tab.id,
          validated.value,
          typeof tab.title === "string" ? tab.title : "",
        );
      } catch (storageError) {
        // Avoid leaving a visible custom title without its durable session record.
        await this.#tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPES.RESTORE_TITLE,
          payload: { originalTitle: typeof tab.title === "string" ? tab.title : "" },
        }).catch(() => undefined);
        throw storageError;
      }

      return { ok: true };
    } catch (error) {
      this.#logger.warn("[TabRenamer] Failed to rename tab.", error);
      return {
        ok: false,
        reason: this.#describeInjectionError(error),
      };
    }
  }

  /**
   * Restore the saved page title after verifying the one-time website permission.
   *
   * @param {chrome.tabs.Tab} tab
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  async restoreTab(tab, suppliedRecord) {
    if (!Number.isInteger(tab?.id) || tab.id < 0) {
      return { ok: false, reason: "The selected tab is no longer available." };
    }

    const record = suppliedRecord ?? await this.#storage.get(tab.id);
    if (!record) {
      return { ok: false, reason: "This tab does not have a custom title." };
    }

    const originPattern = this.#getOriginPattern(tab.url);
    if (!originPattern) {
      return { ok: false, reason: "This page does not allow title management." };
    }

    let hasAccess = false;
    try {
      // Website access is granted once through required host_permissions.
      // The worker only verifies that Chrome still exposes that permission.
      hasAccess = await this.#permissions.contains({ origins: [originPattern] });
    } catch (error) {
      this.#logger.warn("[TabRenamer] Site permission check failed.", error);
      return { ok: false, reason: "Could not verify access to this website." };
    }

    if (!hasAccess) {
      return { ok: false, reason: "Website access was not granted." };
    }

    try {
      await this.#registerContentScript(originPattern);
      await this.#ensureController(tab.id);

      const response = await this.#tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.RESTORE_TITLE,
        payload: { originalTitle: record.originalTitle },
      });

      if (!response?.ok) {
        return { ok: false, reason: "The page did not restore its original title." };
      }

      await this.#storage.remove(tab.id);
      return { ok: true };
    } catch (error) {
      this.#logger.warn("[TabRenamer] Failed to restore tab title.", error);
      return { ok: false, reason: this.#describeInjectionError(error) };
    }
  }

  /**
   * Reapply a saved title after a full navigation/reload. The page's new
   * document title becomes the new original title for the restore action.
   *
   * @param {number} tabId
   * @param {string} pageTitle
   * @returns {Promise<boolean>}
   */
  async applySavedTitle(tabId, pageTitle = "") {
    try {
      const record = await this.#storage.get(tabId);
      if (!record) return false;

      const tab = await this.#tabs.get(tabId);
      const originPattern = this.#getOriginPattern(tab.url);
      if (!originPattern || !(await this.#permissions.contains({ origins: [originPattern] }))) {
        return false;
      }

      await this.#registerContentScript(originPattern);
      await this.#ensureController(tabId);

      const originalTitle = typeof pageTitle === "string" && pageTitle.length > 0
        ? pageTitle
        : (typeof tab.title === "string" ? tab.title : record.originalTitle);

      const response = await this.#tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.APPLY_TITLE,
        payload: {
          customTitle: record.customTitle,
          originalTitle,
        },
      });

      if (response?.ok && originalTitle !== record.originalTitle) {
        await this.#storage.updateOriginalTitle?.(tabId, originalTitle);
      }

      return response?.ok === true;
    } catch (error) {
      this.#logger.warn("[TabRenamer] Could not restore custom title after navigation.", error);
      return false;
    }
  }

  #getOriginPattern(rawUrl) {
    if (typeof rawUrl !== "string") {
      return null;
    }

    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
      }

      return `${url.origin}/*`;
    } catch {
      return null;
    }
  }

  async #registerContentScript(originPattern) {
    const id = this.#scriptId(originPattern);
    const existing = await this.#scripting.getRegisteredContentScripts({ ids: [id] });
    const definition = {
      id,
      matches: [originPattern],
      js: [CONTENT_SCRIPT_FILE],
      runAt: "document_start",
      allFrames: false,
      persistAcrossSessions: false,
    };

    if (existing.length > 0) {
      await this.#scripting.updateContentScripts([definition]);
    } else {
      await this.#scripting.registerContentScripts([definition]);
    }
  }

  async #ensureController(tabId) {
    await this.#scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_FILE],
    });
  }

  #scriptId(originPattern) {
    let hash = 2166136261;
    for (let index = 0; index < originPattern.length; index += 1) {
      hash ^= originPattern.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `tabrenamer-${(hash >>> 0).toString(16)}`;
  }

  #describeInjectionError(error) {
    const message = typeof error?.message === "string" ? error.message : "";
    if (/cannot access|permission|restricted|chrome:\/\//i.test(message)) {
      return "Chrome does not allow TabRenamer to modify this page.";
    }
    return "Could not apply the title. Reload the page and try again.";
  }
}

/**
 * Reapply saved custom titles after full page loads.
 *
 * @param {{ titleService: TitleService, tabsApi?: chrome.tabs, logger?: Console }} options
 * @returns {() => void}
 */
export function registerTitleNavigationListener({
  titleService,
  tabsApi = globalThis.chrome?.tabs,
  logger = console,
}) {
  if (!titleService || typeof titleService.applySavedTitle !== "function") {
    throw new TypeError("A compatible title service is required.");
  }
  if (!tabsApi?.onUpdated) {
    throw new TypeError("Chrome tab update events are required.");
  }

  const listener = (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") {
      return;
    }

    return titleService.applySavedTitle(tabId, tab?.title ?? "").catch((error) => {
      logger.error("[TabRenamer] Navigation title recovery failed.", error);
      return false;
    });
  };

  tabsApi.onUpdated.addListener(listener);
  return () => tabsApi.onUpdated.removeListener(listener);
}
