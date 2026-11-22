import test from "node:test";
import assert from "node:assert/strict";

import { StorageService } from "../src/services/storage-service.js";
import { createMemoryStorageArea } from "./helpers/mock-chrome.js";

function createService(options = {}) {
  const storageArea = options.storageArea ?? createMemoryStorageArea();
  let timestamp = 1000;
  const service = new StorageService({
    storageArea,
    now: options.now ?? (() => timestamp++),
  });

  return { service, storageArea };
}

test("stores and reads a custom title by tab ID", async () => {
  const { service } = createService();

  const saved = await service.setTabName(10, "  Project Alpha  ", "Original title");

  assert.equal(saved.customTitle, "Project Alpha");
  assert.equal(saved.originalTitle, "Original title");
  assert.deepEqual(await service.get(10), saved);
});

test("keeps records independent for tabs sharing the same URL", async () => {
  const { service } = createService();

  await Promise.all([
    service.setTabName(10, "First tab", "Same page"),
    service.setTabName(11, "Second tab", "Same page"),
  ]);

  assert.equal((await service.get(10)).customTitle, "First tab");
  assert.equal((await service.get(11)).customTitle, "Second tab");
  assert.equal(Object.keys(await service.getAll()).length, 2);
});

test("serializes concurrent updates without losing records", async () => {
  const { service } = createService();

  await Promise.all(
    Array.from({ length: 40 }, (_, index) =>
      service.setTabName(index + 1, `Tab ${index + 1}`, "Original"),
    ),
  );

  const records = await service.getAll();
  assert.equal(Object.keys(records).length, 40);
  assert.equal(records["40"].customTitle, "Tab 40");
});

test("preserves original title and creation timestamp when renaming again", async () => {
  const { service } = createService();

  const first = await service.setTabName(5, "First name", "Page title");
  const second = await service.setTabName(5, "Second name");

  assert.equal(second.originalTitle, "Page title");
  assert.equal(second.createdAt, first.createdAt);
  assert.ok(second.updatedAt > first.updatedAt);
});

test("rejects invalid tab IDs and custom titles", async () => {
  const { service } = createService();

  await assert.rejects(service.setTabName(-1, "Valid"), TypeError);
  await assert.rejects(service.setTabName(1.2, "Valid"), TypeError);
  await assert.rejects(service.setTabName(1, "   "), TypeError);
  await assert.rejects(service.setTabName(1, "x".repeat(81)), TypeError);
  await assert.rejects(service.get("1"), TypeError);
  await assert.rejects(service.remove(-1), TypeError);
});

test("removes records and reports whether a record existed", async () => {
  const { service } = createService();

  await service.setTabName(8, "Temporary");
  assert.equal(await service.remove(8), true);
  assert.equal(await service.remove(8), false);
  assert.equal(await service.get(8), null);
});

test("migrates a record to a replacement tab ID", async () => {
  const { service } = createService();

  await service.setTabName(20, "Migrated", "Original");
  assert.equal(await service.migrateTabId(20, 21), true);
  assert.equal(await service.get(20), null);
  assert.equal((await service.get(21)).customTitle, "Migrated");
});

test("does not overwrite an existing destination record during migration", async () => {
  const { service } = createService();

  await service.setTabName(20, "Old");
  await service.setTabName(21, "New");

  assert.equal(await service.migrateTabId(20, 21), true);
  assert.equal((await service.get(21)).customTitle, "New");
  assert.equal(await service.get(20), null);
});

test("removes stale records after reconciling open tab IDs", async () => {
  const { service } = createService();

  await service.setTabName(1, "Open");
  await service.setTabName(2, "Closed");
  assert.equal(await service.removeMissingTabs([1]), 1);
  assert.equal(await service.get(1) !== null, true);
  assert.equal(await service.get(2), null);
});

test("rejects invalid reconciliation input", async () => {
  const { service } = createService();

  await assert.rejects(service.removeMissingTabs("1"), TypeError);
  await assert.rejects(service.removeMissingTabs([1, -2]), TypeError);
});

test("ignores malformed records already present in storage", async () => {
  const storageArea = createMemoryStorageArea({
    tabNames: {
      "3": { customTitle: "Valid", originalTitle: "Page", createdAt: 1, updatedAt: 2 },
      "-1": { customTitle: "Invalid ID" },
      "4": { customTitle: "   " },
      "5": null,
    },
  });
  const { service } = createService({ storageArea });

  assert.deepEqual(Object.keys(await service.getAll()), ["3"]);
});

test("continues accepting writes after a storage failure", async () => {
  let failNextWrite = true;
  const memory = createMemoryStorageArea();
  const storageArea = {
    get: (...args) => memory.get(...args),
    async set(...args) {
      if (failNextWrite) {
        failNextWrite = false;
        throw new Error("Simulated storage failure");
      }
      return memory.set(...args);
    },
  };
  const { service } = createService({ storageArea });

  await assert.rejects(service.setTabName(1, "First"), /Simulated storage failure/);
  await service.setTabName(2, "Second");
  assert.equal((await service.get(2)).customTitle, "Second");
});

test("updates the original title after a full navigation", async () => {
  const { service } = createService();
  await service.setTabName(44, "Custom name", "First page");

  const updated = await service.updateOriginalTitle(44, "Second page");

  assert.equal(updated.customTitle, "Custom name");
  assert.equal(updated.originalTitle, "Second page");
  assert.equal((await service.get(44)).originalTitle, "Second page");
});

test("does not create a record when updating an unknown tab title", async () => {
  const { service } = createService();

  assert.equal(await service.updateOriginalTitle(404, "Missing page"), null);
  assert.equal(await service.get(404), null);
});

test("rejects invalid original title updates", async () => {
  const { service } = createService();

  await assert.rejects(service.updateOriginalTitle(1, null), TypeError);
});
