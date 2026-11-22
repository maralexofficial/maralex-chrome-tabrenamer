/**
 * Chrome Tabs API facade with custom-name enrichment.
 */
export class TabService {
  #tabsApi;
  #storageService;

  constructor({ tabsApi = globalThis.chrome?.tabs, storageService } = {}) {
    if (!tabsApi || typeof tabsApi.query !== "function" || typeof tabsApi.get !== "function") {
      throw new TypeError("A compatible Chrome Tabs API is required.");
    }

    if (!storageService || typeof storageService.getAll !== "function") {
      throw new TypeError("A compatible storage service is required.");
    }

    this.#tabsApi = tabsApi;
    this.#storageService = storageService;
  }

  /**
   * Return tabs enriched with their individual custom title, if present.
   *
   * @param {chrome.tabs.QueryInfo} [queryInfo]
   * @returns {Promise<Array<chrome.tabs.Tab & { customTitle: string|null }>>}
   */
  async getTabs(queryInfo = {}) {
    const [tabs, records] = await Promise.all([
      this.#tabsApi.query(queryInfo),
      this.#storageService.getAll(),
    ]);

    return tabs.map((tab) => ({
      ...tab,
      customTitle: records[String(tab.id)]?.customTitle ?? null,
    }));
  }

  /**
   * Return one tab enriched with its custom title.
   *
   * @param {number} tabId
   * @returns {Promise<(chrome.tabs.Tab & { customTitle: string|null })|null>}
   */
  async getTab(tabId) {
    try {
      const [tab, record] = await Promise.all([
        this.#tabsApi.get(tabId),
        this.#storageService.get(tabId),
      ]);

      return { ...tab, customTitle: record?.customTitle ?? null };
    } catch (error) {
      if (error?.message?.includes("No tab")) {
        return null;
      }

      throw error;
    }
  }

  /**
   * Return the active tab in the current window.
   *
   * @returns {Promise<(chrome.tabs.Tab & { customTitle: string|null })|null>}
   */
  async getActiveTab() {
    const tabs = await this.getTabs({ active: true, currentWindow: true });
    return tabs[0] ?? null;
  }
}

/**
 * Register storage cleanup/migration for Chrome tab lifecycle events.
 * Call once from the service-worker entry point.
 *
 * @param {{ storageService: import("./storage-service.js").StorageService, tabsApi?: chrome.tabs }} options
 * @returns {() => void} Unregister all listeners.
 */
export function registerTabLifecycleListeners({
  storageService,
  tabsApi = globalThis.chrome?.tabs,
  logger = console,
}) {
  if (!storageService || typeof storageService.remove !== "function" ||
      typeof storageService.migrateTabId !== "function") {
    throw new TypeError("A compatible storage service is required.");
  }

  if (!tabsApi?.onRemoved || !tabsApi?.onReplaced) {
    throw new TypeError("Chrome tab lifecycle events are required.");
  }

  const onRemoved = (tabId) => {
    void storageService.remove(tabId).catch((error) => {
      logger.error("[TabRenamer] Failed to remove closed-tab data.", error);
    });
  };

  const onReplaced = (addedTabId, removedTabId) => {
    void storageService.migrateTabId(removedTabId, addedTabId).catch((error) => {
      logger.error("[TabRenamer] Failed to migrate replaced-tab data.", error);
    });
  };

  tabsApi.onRemoved.addListener(onRemoved);
  tabsApi.onReplaced.addListener(onReplaced);

  return () => {
    tabsApi.onRemoved.removeListener(onRemoved);
    tabsApi.onReplaced.removeListener(onReplaced);
  };
}
