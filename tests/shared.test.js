import test from "node:test";
import assert from "node:assert/strict";

import {
  createMessage,
  isExtensionMessage,
  isTrustedExtensionPageSender,
} from "../src/shared/messages.js";
import { isValidTabId, validateCustomTitle } from "../src/shared/validators.js";
import { MESSAGE_TYPES, TITLE_LIMITS } from "../src/shared/constants.js";

test("createMessage builds a valid message envelope", () => {
  const message = createMessage(MESSAGE_TYPES.PING);
  assert.deepEqual(message, { type: MESSAGE_TYPES.PING, payload: {} });
  assert.equal(isExtensionMessage(message), true);
});

test("createMessage rejects invalid message types", () => {
  assert.throws(() => createMessage(" "), TypeError);
  assert.throws(() => createMessage(null), TypeError);
});

test("createMessage rejects invalid payloads", () => {
  assert.throws(() => createMessage(MESSAGE_TYPES.PING, null), TypeError);
  assert.throws(() => createMessage(MESSAGE_TYPES.PING, []), TypeError);
});

test("isExtensionMessage rejects malformed and unknown messages", () => {
  assert.equal(isExtensionMessage(null), false);
  assert.equal(isExtensionMessage({ type: "UNKNOWN", payload: {} }), false);
  assert.equal(isExtensionMessage({ type: MESSAGE_TYPES.PING, payload: [] }), false);
});

test("trusts extension options page opened in a tab", () => {
  assert.equal(isTrustedExtensionPageSender({
    id: "extension-id",
    url: "chrome-extension://extension-id/src/options/options.html",
    tab: { id: 42 },
  }, "extension-id"), true);
});

test("rejects website content scripts and other extension IDs", () => {
  assert.equal(isTrustedExtensionPageSender({
    id: "extension-id", url: "https://example.com/page", tab: { id: 42 },
  }, "extension-id"), false);
  assert.equal(isTrustedExtensionPageSender({
    id: "another-extension", url: "chrome-extension://another-extension/options.html",
  }, "extension-id"), false);
  assert.equal(isTrustedExtensionPageSender({ id: "extension-id" }, "extension-id"), false);
});

test("validateCustomTitle trims valid titles", () => {
  assert.deepEqual(validateCustomTitle("  Project Alpha  "), { valid: true, value: "Project Alpha" });
});

test("validateCustomTitle rejects empty and non-string values", () => {
  assert.equal(validateCustomTitle("   ").valid, false);
  assert.equal(validateCustomTitle(42).valid, false);
});

test("validateCustomTitle enforces the configured maximum length", () => {
  assert.equal(validateCustomTitle("a".repeat(TITLE_LIMITS.MAX_LENGTH)).valid, true);
  assert.equal(validateCustomTitle("a".repeat(TITLE_LIMITS.MAX_LENGTH + 1)).valid, false);
});

test("isValidTabId accepts non-negative integers only", () => {
  assert.equal(isValidTabId(0), true);
  assert.equal(isValidTabId(12), true);
  assert.equal(isValidTabId(-1), false);
  assert.equal(isValidTabId(1.5), false);
  assert.equal(isValidTabId("12"), false);
});
