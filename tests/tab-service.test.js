import test from "node:test";
import assert from "node:assert/strict";

import { StorageService } from "../src/services/storage-service.js";
import { TabService, registerTabLifecycleListeners } from "../src/services/tab-service.js";
import {
  createMemoryStorageArea,
  createTabsApi,
} from "./helpers/mock-chrome.js";

function createServices(tabs = []) {
  const storageService = new StorageService({
    storageArea: createMemoryStorageArea(),
    now: () => 100,
  });
  const tabsApi = createTabsApi({ tabs });
  const tabService = new TabService({ tabsApi, storageService });

  return { storageService, tabsApi, tabService };
}

test("lists tabs enriched with their individual custom titles", async () => {
  const { storageService, tabService } = createServices([
    { id: 1, url: "https://example.com", title: "Example", active: true, currentWindow: true },
    { id: 2, url: "https://example.com", title: "Example", active: false, currentWindow: true },
  ]);

  await storageService.setTabName(1, "First");
  await storageService.setTabName(2, "Second");

  const tabs = await tabService.getTabs();

  assert.equal(tabs[0].customTitle, "First");
  assert.equal(tabs[1].customTitle, "Second");
  assert.equal(tabs[0].url, tabs[1].url);
});

test("returns one tab with its custom title", async () => {
  const { storageService, tabService } = createServices([
    { id: 7, title: "Example", active: true, currentWindow: true },
  ]);

  await storageService.setTabName(7, "Named tab");

  assert.equal((await tabService.getTab(7)).customTitle, "Named tab");
});

test("returns null when a requested tab no longer exists", async () => {
  const { tabService } = createServices();

  assert.equal(await tabService.getTab(404), null);
});

test("returns the active tab in the current window", async () => {
  const { storageService, tabService } = createServices([
    { id: 1, title: "Inactive", active: false, currentWindow: true },
    { id: 2, title: "Active", active: true, currentWindow: true },
    { id: 3, title: "Other window", active: true, currentWindow: false },
  ]);

  await storageService.setTabName(2, "Current tab");

  const activeTab = await tabService.getActiveTab();
  assert.equal(activeTab.id, 2);
  assert.equal(activeTab.customTitle, "Current tab");
});

test("cleans up records when tabs are closed", async () => {
  const { storageService, tabsApi } = createServices();

  await storageService.setTabName(9, "Closing");
  const unregister = registerTabLifecycleListeners({ storageService, tabsApi });

  await tabsApi.onRemoved.dispatch(9, { isWindowClosing: false });

  assert.equal(await storageService.get(9), null);
  unregister();
  assert.equal(tabsApi.onRemoved.listenerCount, 0);
});

test("migrates records when Chrome replaces a tab ID", async () => {
  const { storageService, tabsApi } = createServices();

  await storageService.setTabName(30, "Keep me");
  const unregister = registerTabLifecycleListeners({ storageService, tabsApi });

  await tabsApi.onReplaced.dispatch(31, 30);

  assert.equal(await storageService.get(30), null);
  assert.equal((await storageService.get(31)).customTitle, "Keep me");
  unregister();
});

test("lifecycle listener errors are reported without throwing in the event callback", async () => {
  const errors = [];
  const failingStorage = {
    remove: async () => { throw new Error("remove failed"); },
    migrateTabId: async () => { throw new Error("migration failed"); },
  };
  const tabsApi = createTabsApi();
  const unregister = registerTabLifecycleListeners({
    storageService: failingStorage,
    tabsApi,
    logger: { error: (...args) => errors.push(args) },
  });

  await tabsApi.onRemoved.dispatch(1, {});
  await tabsApi.onReplaced.dispatch(2, 1);

  assert.equal(errors.length, 2);
  unregister();
});

test("rejects incomplete service dependencies", () => {
  assert.throws(() => new TabService({ tabsApi: {}, storageService: {} }), TypeError);
  assert.throws(() => registerTabLifecycleListeners({ storageService: {}, tabsApi: {} }), TypeError);
});
