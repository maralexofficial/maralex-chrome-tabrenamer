export function createEvent() {
  const listeners = new Set();

  return {
    addListener(listener) {
      listeners.add(listener);
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
    async dispatch(...args) {
      await Promise.all([...listeners].map((listener) => listener(...args)));
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

export function createMemoryStorageArea(initialValue = {}) {
  let data = structuredClone(initialValue);

  return {
    async get(key) {
      if (typeof key === "string") {
        return { [key]: structuredClone(data[key]) };
      }

      if (Array.isArray(key)) {
        return Object.fromEntries(key.map((item) => [item, structuredClone(data[item])]));
      }

      return structuredClone(data);
    },
    async set(values) {
      data = { ...data, ...structuredClone(values) };
    },
    async remove(key) {
      delete data[key];
    },
    snapshot() {
      return structuredClone(data);
    },
  };
}

export function createTabsApi({ tabs = [] } = {}) {
  const byId = new Map(tabs.map((tab) => [tab.id, structuredClone(tab)]));

  return {
    onRemoved: createEvent(),
    onReplaced: createEvent(),
    async query(queryInfo = {}) {
      return [...byId.values()].filter((tab) => {
        if (queryInfo.active !== undefined && tab.active !== queryInfo.active) return false;
        if (queryInfo.currentWindow !== undefined && tab.currentWindow !== queryInfo.currentWindow) return false;
        return true;
      }).map((tab) => structuredClone(tab));
    },
    async get(tabId) {
      const tab = byId.get(tabId);
      if (!tab) throw new Error("No tab with id: " + tabId);
      return structuredClone(tab);
    },
    add(tab) {
      byId.set(tab.id, structuredClone(tab));
    },
    remove(tabId) {
      byId.delete(tabId);
    },
  };
}
