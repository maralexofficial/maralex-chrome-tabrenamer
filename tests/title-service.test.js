import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

import { StorageService } from "../src/services/storage-service.js";
import {
  TitleService,
  registerTitleNavigationListener,
} from "../src/services/title-service.js";
import { MESSAGE_TYPES } from "../src/shared/constants.js";
import { createEvent, createMemoryStorageArea } from "./helpers/mock-chrome.js";

function createTitleHarness({
  tab = { id: 7, url: "https://example.com/dashboard", title: "Dashboard" },
  permissionGranted = true,
  permissionError = null,
  tabAvailable = true,
  requestResult = true,
  sendResponse = { ok: true },
} = {}) {
  const calls = [];
  const listeners = new Set();
  const registered = new Map();
  const storageService = new StorageService({
    storageArea: createMemoryStorageArea(),
    now: () => 100,
  });
  const tabs = {
    async get(tabId) {
      if (tabId !== tab.id || !tabAvailable) throw new Error("No tab");
      return { ...tab };
    },
    async sendMessage(tabId, message) {
      calls.push({ kind: "message", tabId, message });
      return sendResponse;
    },
    onUpdated: createEvent(),
  };
  const permissions = {
    async request(details) {
      calls.push({ kind: "request", details });
      return requestResult;
    },
    async contains(details) {
      calls.push({ kind: "contains", details });
      if (permissionError) throw permissionError;
      return permissionGranted;
    },
  };
  const scripting = {
    async getRegisteredContentScripts({ ids }) {
      return ids.filter((id) => registered.has(id)).map((id) => registered.get(id));
    },
    async registerContentScripts(definitions) {
      for (const definition of definitions) registered.set(definition.id, definition);
      calls.push({ kind: "register", definitions });
    },
    async updateContentScripts(definitions) {
      for (const definition of definitions) registered.set(definition.id, definition);
      calls.push({ kind: "update", definitions });
    },
    async executeScript(details) {
      calls.push({ kind: "inject", details });
    },
  };
  const service = new TitleService({
    tabs,
    permissions,
    scripting,
    storageService,
    logger: { warn() {}, error() {} },
  });

  return { service, storageService, tabs, permissions, scripting, calls, tab, registered };
}

test("manifest requests one-time access to all HTTP and HTTPS websites", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));

  assert.deepEqual(manifest.host_permissions, ["http://*/*", "https://*/*"]);
  assert.equal(Object.hasOwn(manifest, "optional_host_permissions"), false);
});

test("checks the one-time website grant and registers a scoped document-start script", async () => {
  const harness = createTitleHarness();

  const result = await harness.service.renameTab(harness.tab, "  Project Alpha  ");

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(harness.calls[0], {
    kind: "contains",
    details: { origins: ["https://example.com/*"] },
  });
  assert.equal(harness.calls.some((call) => call.kind === "request"), false);
  const registration = harness.calls.find((call) => call.kind === "register");
  assert.equal(registration.definitions[0].matches[0], "https://example.com/*");
  assert.equal(registration.definitions[0].runAt, "document_start");
  assert.equal(registration.definitions[0].allFrames, false);
  assert.equal(registration.definitions[0].persistAcrossSessions, false);
  assert.ok(harness.calls.some((call) => call.kind === "inject"));
  const message = harness.calls.find((call) => call.kind === "message").message;
  assert.equal(message.type, MESSAGE_TYPES.APPLY_TITLE);
  assert.equal(message.payload.customTitle, "Project Alpha");
  assert.equal((await harness.storageService.get(7)).customTitle, "Project Alpha");
});

test("does not store a title when the one-time website permission is unavailable", async () => {
  const harness = createTitleHarness({ permissionGranted: false });

  const result = await harness.service.renameTab(harness.tab, "Private");

  assert.equal(result.ok, false);
  assert.match(result.reason, /not granted/i);
  assert.equal(await harness.storageService.get(7), null);
  assert.equal(harness.calls.some((call) => call.kind === "inject"), false);
});

test("rejects restricted and malformed page URLs before requesting access", async () => {
  const restricted = createTitleHarness({
    tab: { id: 7, url: "chrome://settings", title: "Settings" },
  });
  const malformed = createTitleHarness({
    tab: { id: 7, url: "not a URL", title: "Unknown" },
  });

  assert.equal((await restricted.service.renameTab(restricted.tab, "Settings tab")).ok, false);
  assert.equal((await malformed.service.renameTab(malformed.tab, "Unknown tab")).ok, false);
  assert.equal(restricted.calls.length, 0);
  assert.equal(malformed.calls.length, 0);
});

test("rejects invalid custom titles without requesting permissions", async () => {
  const harness = createTitleHarness();

  assert.equal((await harness.service.renameTab(harness.tab, "  ")).ok, false);
  assert.equal((await harness.service.renameTab(harness.tab, "x".repeat(81))).ok, false);
  assert.equal(harness.calls.length, 0);
});

test("does not persist a title when the content controller does not acknowledge it", async () => {
  const harness = createTitleHarness({ sendResponse: { ok: false } });

  const result = await harness.service.renameTab(harness.tab, "No acknowledgement");

  assert.equal(result.ok, false);
  assert.equal(await harness.storageService.get(7), null);
});

test("restores the saved title and removes its record", async () => {
  const harness = createTitleHarness();
  await harness.storageService.setTabName(7, "Custom", "Dashboard");

  const result = await harness.service.restoreTab(harness.tab, await harness.storageService.get(7));

  assert.deepEqual(result, { ok: true });
  const message = harness.calls.find((call) => call.kind === "message").message;
  assert.equal(message.type, MESSAGE_TYPES.RESTORE_TITLE);
  assert.equal(message.payload.originalTitle, "Dashboard");
  assert.equal(await harness.storageService.get(7), null);
});

test("reapplies a saved title after navigation and updates the restore title", async () => {
  const harness = createTitleHarness();
  await harness.storageService.setTabName(7, "Project tab", "Old page title");

  const applied = await harness.service.applySavedTitle(7, "New page title");

  assert.equal(applied, true);
  assert.equal((await harness.storageService.get(7)).originalTitle, "New page title");
  const message = harness.calls.find((call) => call.kind === "message").message;
  assert.equal(message.payload.customTitle, "Project tab");
  assert.equal(message.payload.originalTitle, "New page title");
});

test("handles a rejected permission check during navigation without throwing", async () => {
  const harness = createTitleHarness({ permissionError: new Error("permission API unavailable") });
  await harness.storageService.setTabName(7, "Project tab", "Dashboard");
  assert.equal(await harness.service.applySavedTitle(7, "Dashboard"), false);
  assert.equal(harness.calls.some((call) => call.kind === "inject"), false);
});

test("handles a tab disappearing before navigation recovery", async () => {
  const harness = createTitleHarness({ tabAvailable: false });
  await harness.storageService.setTabName(7, "Project tab", "Dashboard");
  assert.equal(await harness.service.applySavedTitle(7, "Dashboard"), false);
  assert.equal(harness.calls.some((call) => call.kind === "inject"), false);
});

test("does not inject during navigation if website permission was revoked", async () => {
  const harness = createTitleHarness({ permissionGranted: false });
  await harness.storageService.setTabName(7, "Project tab", "Dashboard");

  assert.equal(await harness.service.applySavedTitle(7, "Dashboard"), false);
  assert.equal(harness.calls.some((call) => call.kind === "inject"), false);
});

test("navigation listener only applies after the tab load completes", async () => {
  const harness = createTitleHarness();
  await harness.storageService.setTabName(7, "Project tab", "Dashboard");
  const unregister = registerTitleNavigationListener({
    titleService: harness.service,
    tabsApi: harness.tabs,
    logger: { error() {} },
  });

  await harness.tabs.onUpdated.dispatch(7, { status: "loading" }, harness.tab);
  assert.equal(harness.calls.length, 0);

  await harness.tabs.onUpdated.dispatch(7, { status: "complete" }, harness.tab);
  assert.ok(harness.calls.some((call) => call.kind === "message"));
  unregister();
  assert.equal(harness.tabs.onUpdated.listenerCount, 0);
});

test("content controller applies, observes, and restores the document title", () => {
  const source = fs.readFileSync(new URL("../src/content/title-controller.js", import.meta.url), "utf8");
  const messageListeners = new Set();
  let observerCallback;
  let observed = false;
  let disconnected = false;
  let title = "Original page";
  const document = {
    documentElement: {},
    get title() { return title; },
    set title(value) { title = value; },
  };
  class FakeMutationObserver {
    constructor(callback) { observerCallback = callback; }
    observe() { observed = true; }
    disconnect() { disconnected = true; observed = false; }
  }
  const chrome = {
    runtime: {
      onMessage: {
        addListener(listener) { messageListeners.add(listener); },
      },
    },
  };
  const context = vm.createContext({
    chrome,
    document,
    MutationObserver: FakeMutationObserver,
    globalThis: {},
  });
  vm.runInContext(source, context);

  assert.equal(messageListeners.size, 1);
  let response;
  [...messageListeners][0]({
    type: MESSAGE_TYPES.APPLY_TITLE,
    payload: { customTitle: "My custom tab", originalTitle: "Original page" },
  }, {}, (value) => { response = value; });
  assert.equal(response.ok, true);
  assert.equal(document.title, "My custom tab");
  assert.equal(observed, true);

  document.title = "Page script changed title";
  observerCallback();
  assert.equal(document.title, "My custom tab");

  [...messageListeners][0]({
    type: MESSAGE_TYPES.RESTORE_TITLE,
    payload: { originalTitle: "Original page" },
  }, {}, (value) => { response = value; });
  assert.equal(response.ok, true);
  assert.equal(document.title, "Original page");
  assert.equal(disconnected, true);
});

test("content controller installation is idempotent in one document", () => {
  const source = fs.readFileSync(new URL("../src/content/title-controller.js", import.meta.url), "utf8");
  const messageListeners = new Set();
  const context = vm.createContext({
    chrome: { runtime: { onMessage: { addListener: (listener) => messageListeners.add(listener) } } },
    document: { title: "", documentElement: {} },
    MutationObserver: class { observe() {} disconnect() {} },
    globalThis: {},
  });

  vm.runInContext(source, context);
  vm.runInContext(source, context);

  assert.equal(messageListeners.size, 1);
});

test("background operation verifies a popup-granted permission without requesting again", async () => {
  const harness = createTitleHarness();

  const result = await harness.service.renameTab(harness.tab, "No prompt needed");

  assert.equal(result.ok, true);
  assert.equal(harness.calls.some((call) => call.kind === "request"), false);
  assert.ok(harness.calls.some((call) => call.kind === "contains"));
  assert.equal((await harness.storageService.get(7)).customTitle, "No prompt needed");
});

test("background restore verifies the existing permission before restoring", async () => {
  const harness = createTitleHarness();
  await harness.storageService.setTabName(7, "Custom", "Dashboard");

  const result = await harness.service.restoreTab(harness.tab);

  assert.equal(result.ok, true);
  assert.equal(harness.calls.some((call) => call.kind === "request"), false);
  assert.ok(harness.calls.some((call) => call.kind === "contains"));
  assert.equal(await harness.storageService.get(7), null);
});
