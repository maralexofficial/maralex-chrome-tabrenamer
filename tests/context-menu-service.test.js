import test from "node:test";
import assert from "node:assert/strict";

import { registerTabContextMenus } from "../src/services/context-menu-service.js";
import { CONTEXT_MENU_IDS } from "../src/shared/constants.js";
import { createEvent } from "./helpers/mock-chrome.js";

function createHarness() {
  const created = [];
  const openedTabs = [];
  const restored = [];
  const onClicked = createEvent();
  const contextMenus = {
    onClicked,
    removeAll(callback) { created.length = 0; callback(); },
    create(definition) { created.push(definition); return definition.id; },
  };
  const tabs = {
    async create(details) { openedTabs.push(details); return { id: 99, ...details }; },
  };
  const runtime = {
    getURL(path) { return "chrome-extension://test-id/" + path; },
  };
  const titleService = {
    async restoreTab(tab) { restored.push(tab.id); return { ok: true }; },
  };
  const service = registerTabContextMenus({
    contextMenus, tabs, runtime, titleService, logger: { warn() {}, error() {} },
  });
  return { service, created, openedTabs, restored, onClicked };
}

test("registers a parent menu with rename and restore actions", async () => {
  const harness = createHarness();
  await harness.service.ready;

  assert.equal(harness.created.length, 3);
  assert.equal(harness.created[0].title, "TabRenamer");
  assert.equal(harness.created[1].id, CONTEXT_MENU_IDS.RENAME_TAB);
  assert.equal(harness.created[1].parentId, "tabrenamer-parent");
  assert.equal(harness.created[2].id, CONTEXT_MENU_IDS.RESTORE_TITLE);
  assert.deepEqual(harness.created[1].contexts, ["page"]);
  harness.service.unregister();
  assert.equal(harness.onClicked.listenerCount, 0);
});

test("rename context action opens the dedicated extension rename page for the clicked tab", async () => {
  const harness = createHarness();
  await harness.service.ready;

  await harness.onClicked.dispatch(
    { menuItemId: CONTEXT_MENU_IDS.RENAME_TAB },
    { id: 42, url: "https://example.com" },
  );

  assert.equal(harness.openedTabs.length, 1);
  const opened = new URL(harness.openedTabs[0].url);
  assert.equal(opened.pathname, "/src/rename/rename.html");
  assert.equal(opened.searchParams.get("tabId"), "42");
  assert.equal(harness.openedTabs[0].active, true);
  harness.service.unregister();
});

test("restore context action delegates to the title service for the clicked tab", async () => {
  const harness = createHarness();
  await harness.service.ready;

  await harness.onClicked.dispatch(
    { menuItemId: CONTEXT_MENU_IDS.RESTORE_TITLE },
    { id: 57, url: "https://example.com" },
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(harness.restored, [57]);
  harness.service.unregister();
});

test("ignores context-menu clicks without a valid tab ID", async () => {
  const harness = createHarness();
  await harness.service.ready;

  await harness.onClicked.dispatch(
    { menuItemId: CONTEXT_MENU_IDS.RENAME_TAB },
    { url: "https://example.com" },
  );

  assert.equal(harness.openedTabs.length, 0);
  harness.service.unregister();
});

test("rejects missing context-menu dependencies", () => {
  assert.throws(() => registerTabContextMenus({}), TypeError);
});
