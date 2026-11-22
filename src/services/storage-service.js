import { STORAGE_KEYS } from "../shared/constants.js";
import { isValidTabId, validateCustomTitle } from "../shared/validators.js";

const DEFAULT_STORAGE_AREA = "session";

/**
 * Store custom names for active tabs in chrome.storage.session.
 *
 * All mutations made through one service instance are serialized. The service
 * worker owns one instance, so popup/background requests handled by that
 * worker cannot overwrite one another with stale read-modify-write cycles.
 */
export class StorageService {
  #storageArea;
  #storageKey;
  #now;
  #writeQueue = Promise.resolve();

  constructor({
    storageArea,
    storageKey = STORAGE_KEYS.TAB_NAMES,
    now = Date.now,
  } = {}) {
    const area = storageArea ?? globalThis.chrome?.storage?.[DEFAULT_STORAGE_AREA];

    if (!area || typeof area.get !== "function" || typeof area.set !== "function") {
      throw new TypeError("A compatible Chrome storage area is required.");
    }

    this.#storageArea = area;
    this.#storageKey = storageKey;
    this.#now = now;
  }

  /**
   * Read and normalize the stored record map.
   * Invalid records are ignored rather than exposed to callers.
   *
   * @returns {Promise<Record<string, TabNameRecord>>}
   */
  async getAll() {
    await this.#writeQueue;
    return this.#readRecords();
  }

  /**
   * Return the custom-name record for one tab.
   *
   * @param {number} tabId
   * @returns {Promise<TabNameRecord|null>}
   */
  async get(tabId) {
    this.#assertTabId(tabId);
    await this.#writeQueue;
    const records = await this.#readRecords();
    return records[String(tabId)] ?? null;
  }

  /**
   * Create or update a tab's custom title.
   *
   * @param {number} tabId
   * @param {string} customTitle
   * @param {string} [originalTitle]
   * @returns {Promise<TabNameRecord>}
   */
  async setTabName(tabId, customTitle, originalTitle) {
    this.#assertTabId(tabId);
    const validated = validateCustomTitle(customTitle);

    if (!validated.valid) {
      throw new TypeError(validated.error);
    }

    if (originalTitle !== undefined && typeof originalTitle !== "string") {
      throw new TypeError("Original title must be a string when provided.");
    }

    return this.#mutate((records) => {
      const key = String(tabId);
      const previous = records[key];
      const timestamp = this.#now();
      const record = {
        customTitle: validated.value,
        originalTitle: previous?.originalTitle ?? originalTitle ?? "",
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      records[key] = record;
      return { ...record };
    });
  }

  /**
   * Update the page title captured for the current navigation without
   * changing the user's custom title or the record creation timestamp.
   *
   * @param {number} tabId
   * @param {string} originalTitle
   * @returns {Promise<TabNameRecord|null>}
   */
  async updateOriginalTitle(tabId, originalTitle) {
    this.#assertTabId(tabId);

    if (typeof originalTitle !== "string") {
      throw new TypeError("Original title must be a string.");
    }

    return this.#mutate((records) => {
      const key = String(tabId);
      const previous = records[key];

      if (!previous) {
        return null;
      }

      const updated = {
        ...previous,
        originalTitle,
        updatedAt: this.#now(),
      };
      records[key] = updated;
      return { ...updated };
    });
  }

  /**
   * Remove a tab's custom title.
   *
   * @param {number} tabId
   * @returns {Promise<boolean>} Whether a record was removed.
   */
  async remove(tabId) {
    this.#assertTabId(tabId);

    return this.#mutate((records) => {
      const key = String(tabId);
      const existed = Object.hasOwn(records, key);
      delete records[key];
      return existed;
    });
  }

  /**
   * Move a record when Chrome replaces a tab ID (for example, prerender
   * activation). An existing destination record wins to avoid overwriting it.
   *
   * @param {number} removedTabId
   * @param {number} addedTabId
   * @returns {Promise<boolean>}
   */
  async migrateTabId(removedTabId, addedTabId) {
    this.#assertTabId(removedTabId);
    this.#assertTabId(addedTabId);

    if (removedTabId === addedTabId) {
      return false;
    }

    return this.#mutate((records) => {
      const oldKey = String(removedTabId);
      const newKey = String(addedTabId);
      const oldRecord = records[oldKey];

      if (!oldRecord) {
        return false;
      }

      if (!Object.hasOwn(records, newKey)) {
        records[newKey] = { ...oldRecord, updatedAt: this.#now() };
      }

      delete records[oldKey];
      return true;
    });
  }

  /**
   * Remove records whose tab IDs are not present in the current browser.
   *
   * @param {number[]} existingTabIds
   * @returns {Promise<number>} Number of removed records.
   */
  async removeMissingTabs(existingTabIds) {
    if (!Array.isArray(existingTabIds) || !existingTabIds.every(isValidTabId)) {
      throw new TypeError("Existing tab IDs must be an array of valid tab IDs.");
    }

    const existing = new Set(existingTabIds.map(String));

    return this.#mutate((records) => {
      let removed = 0;

      for (const key of Object.keys(records)) {
        if (!existing.has(key)) {
          delete records[key];
          removed += 1;
        }
      }

      return removed;
    });
  }

  async #readRecords() {
    const stored = await this.#storageArea.get(this.#storageKey);
    const value = stored?.[this.#storageKey];

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const normalized = {};

    for (const [key, record] of Object.entries(value)) {
      const tabId = Number(key);
      const title = validateCustomTitle(record?.customTitle);

      if (!isValidTabId(tabId) || String(tabId) !== key || !title.valid) {
        continue;
      }

      normalized[key] = {
        customTitle: title.value,
        originalTitle: typeof record.originalTitle === "string" ? record.originalTitle : "",
        createdAt: Number.isFinite(record.createdAt) ? record.createdAt : 0,
        updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : 0,
      };
    }

    return normalized;
  }

  #mutate(mutator) {
    const operation = this.#writeQueue.then(async () => {
      const records = await this.#readRecords();
      const result = await mutator(records);
      await this.#storageArea.set({ [this.#storageKey]: records });
      return result;
    });

    // Keep the queue usable after a failed operation while still returning
    // the original rejection to the caller.
    this.#writeQueue = operation.catch(() => undefined);
    return operation;
  }

  #assertTabId(tabId) {
    if (!isValidTabId(tabId)) {
      throw new TypeError("Tab ID must be a non-negative integer.");
    }
  }
}

/**
 * @typedef {Object} TabNameRecord
 * @property {string} customTitle
 * @property {string} originalTitle
 * @property {number} createdAt
 * @property {number} updatedAt
 */
