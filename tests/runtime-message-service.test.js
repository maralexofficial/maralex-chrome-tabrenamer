import test from "node:test";
import assert from "node:assert/strict";

import { MESSAGE_TYPES, EXTENSION_NAME } from "../src/shared/constants.js";
import { registerRuntimeMessageHandler } from "../src/services/runtime-message-service.js";
import { createEvent } from "./helpers/mock-chrome.js";

function createHarness({ tab = { id: 17, url: "https://example.com", title: "Example" }, getError = null } = {}) {
  const onMessage = createEvent();
  const runtime = { id: "tabrenamer-test-id", onMessage };
  const calls = [];
  const tabsApi = {
    async get(tabId) {
      calls.push({ kind: "get", tabId });
      if (getError) throw getError;
      if (tabId !== tab.id) throw new Error("No such tab");
      return { ...tab };
    },
  };
  const titleService = {
    async renameTab(receivedTab, customTitle) {
      calls.push({ kind: "rename", tab: receivedTab, customTitle });
      return { ok: true };
    },
    async restoreTab(receivedTab) {
      calls.push({ kind: "restore", tab: receivedTab });
      return { ok: true };
    },
  };
  const logger = { info() {}, warn() {}, error() {} };
  const unregister = registerRuntimeMessageHandler({ runtime, tabsApi, titleService, logger });
  const trustedSender = {
    id: runtime.id,
    url: "chrome-extension://tabrenamer-test-id/src/options/options.html",
    tab: { id: 99 },
  };
  async function send(message, sender = trustedSender) {
    let keepChannelOpen = false;
    const response = await new Promise((resolve) => {
      keepChannelOpen = [...onMessageListeners(onMessage)][0](message, sender, resolve);
    });
    return { response, keepChannelOpen };
  }
  return { calls, onMessage, trustedSender, unregister, send };
}

function onMessageListeners(event) {
  return event.listeners ?? [];
}

test("runtime integration routes a trusted rename request through tab lookup to TitleService", async () => {
  const harness = createHarness();
  const { response, keepChannelOpen } = await harness.send({
    type: MESSAGE_TYPES.RENAME_TAB,
    payload: { tabId: 17, customTitle: "My tab" },
  });

  assert.equal(keepChannelOpen, true);
  assert.deepEqual(response, { ok: true });
  assert.deepEqual(harness.calls.map((call) => call.kind), ["get", "rename"]);
  assert.equal(harness.calls[1].tab.id, 17);
  assert.equal(harness.calls[1].customTitle, "My tab");
  harness.unregister();
  assert.equal(harness.onMessage.listenerCount, 0);
});

test("runtime integration routes a trusted restore request", async () => {
  const harness = createHarness();
  const { response } = await harness.send({
    type: MESSAGE_TYPES.RESTORE_TAB,
    payload: { tabId: 17 },
  });

  assert.deepEqual(response, { ok: true });
  assert.deepEqual(harness.calls.map((call) => call.kind), ["get", "restore"]);
});

test("runtime boundary rejects website content scripts before tab lookup", async () => {
  const harness = createHarness();
  const { response, keepChannelOpen } = await harness.send({
    type: MESSAGE_TYPES.RENAME_TAB,
    payload: { tabId: 17, customTitle: "Injected" },
  }, { id: harness.trustedSender.id, url: "https://example.com", tab: { id: 17 } });

  assert.equal(keepChannelOpen, false);
  assert.equal(response.ok, false);
  assert.match(response.reason, /did not originate/i);
  assert.equal(harness.calls.length, 0);
});

test("runtime boundary rejects malformed and unsupported requests", async () => {
  const harness = createHarness();
  const invalidTab = await harness.send({
    type: MESSAGE_TYPES.RENAME_TAB, payload: { tabId: -1, customTitle: "Bad" },
  });
  const missingTitle = await harness.send({
    type: MESSAGE_TYPES.RENAME_TAB, payload: { tabId: 17 },
  });
  const unknown = await harness.send({
    type: MESSAGE_TYPES.PING, payload: { tabId: 17 },
  });

  assert.match(invalidTab.response.reason, /invalid tab/i);
  assert.match(missingTitle.response.reason, /invalid custom title/i);
  assert.deepEqual(unknown.response, { ok: true, extension: EXTENSION_NAME });
  assert.equal(harness.calls.length, 0);
});

test("runtime boundary returns a controlled failure when the tab closes before lookup", async () => {
  const harness = createHarness({ getError: new Error("No such tab") });
  const { response } = await harness.send({
    type: MESSAGE_TYPES.RENAME_TAB, payload: { tabId: 17, customTitle: "Gone" },
  });

  assert.equal(response.ok, false);
  assert.match(response.reason, /could not be completed/i);
  assert.deepEqual(harness.calls.map((call) => call.kind), ["get"]);
});
