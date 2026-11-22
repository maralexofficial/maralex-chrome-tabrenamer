import { MESSAGE_TYPES } from "../shared/constants.js";
import { StorageService } from "../services/storage-service.js";

const elements = {
  list: document.querySelector("#tab-list"),
  count: document.querySelector("#tab-count"),
  status: document.querySelector("#status"),
};

const storageService = new StorageService();
let refreshInProgress = false;
let refreshRequested = false;

function setStatus(message, kind = "neutral") {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

function getPageDetails(tab) {
  try {
    const url = new URL(tab.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { hostname: "Restricted Chrome page", supported: false };
    }
    return { hostname: url.hostname || url.origin, supported: true };
  } catch {
    return { hostname: "Page address unavailable", supported: false };
  }
}

async function sendTitleOperation(type, tabId, customTitle) {
  try {
    return await chrome.runtime.sendMessage({
      type,
      payload: {
        tabId,
        ...(customTitle === undefined ? {} : { customTitle }),
      },
    });
  } catch (error) {
    console.error("[TabRenamer] Background operation failed.", error);
    return { ok: false, reason: "The background service could not complete the request." };
  }
}

function createTabCard(tab, record) {
  const card = document.createElement("article");
  card.className = "tab-card";
  if (tab.active) card.classList.add("tab-card--active");

  const heading = document.createElement("div");
  heading.className = "tab-card__heading";

  if (tab.favIconUrl) {
    const favicon = document.createElement("img");
    favicon.className = "tab-card__favicon";
    favicon.src = tab.favIconUrl;
    favicon.alt = "";
    favicon.addEventListener("error", () => favicon.remove(), { once: true });
    heading.append(favicon);
  }

  const titleGroup = document.createElement("div");
  titleGroup.className = "tab-card__title-group";

  const title = document.createElement("p");
  title.className = "tab-card__title";
  title.textContent = record?.customTitle || tab.title || "Untitled tab";
  titleGroup.append(title);

  const details = document.createElement("p");
  details.className = "tab-card__details";
  details.textContent = getPageDetails(tab).hostname;
  titleGroup.append(details);
  heading.append(titleGroup);

  if (tab.active) {
    const active = document.createElement("span");
    active.className = "tab-card__active";
    active.textContent = "Active";
    heading.append(active);
  }

  const form = document.createElement("form");
  form.className = "tab-card__form";

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 80;
  input.value = record?.customTitle ?? "";
  input.placeholder = "Enter a name for this tab";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Custom name for " + (tab.title || "tab"));

  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Save";

  const restore = document.createElement("button");
  restore.type = "button";
  restore.className = "button button--secondary";
  restore.textContent = "Restore";
  restore.hidden = !record;

  const supported = getPageDetails(tab).supported && Number.isInteger(tab.id);
  input.disabled = !supported;
  save.disabled = !supported;
  restore.disabled = !supported;

  form.append(input, save, restore);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supported) return;

    const customTitle = input.value.trim();
    if (!customTitle) {
      setStatus("Enter a name before saving.", "error");
      input.focus();
      return;
    }

    input.disabled = true;
    save.disabled = true;
    restore.disabled = true;
    setStatus("Saving tab name…");

    const result = await sendTitleOperation(MESSAGE_TYPES.RENAME_TAB, tab.id, customTitle);
    if (result?.ok) {
      setStatus("Name saved for this tab.", "success");
      await refreshTabs();
    } else {
      setStatus(result?.reason ?? "Could not rename this tab.", "error");
      input.disabled = false;
      save.disabled = false;
      restore.disabled = !record;
    }
  });

  restore.addEventListener("click", async () => {
    if (!supported || !record) return;

    input.disabled = true;
    save.disabled = true;
    restore.disabled = true;
    setStatus("Restoring original page title…");

    const result = await sendTitleOperation(MESSAGE_TYPES.RESTORE_TAB, tab.id);
    if (result?.ok) {
      setStatus("Original title restored.", "success");
      await refreshTabs();
    } else {
      setStatus(result?.reason ?? "Could not restore this tab.", "error");
      input.disabled = false;
      save.disabled = false;
      restore.disabled = false;
    }
  });

  card.append(heading, form);
  if (!supported) {
    const note = document.createElement("p");
    note.className = "tab-card__note";
    note.textContent = "Chrome does not allow title changes on this page.";
    card.append(note);
  }

  return card;
}

async function refreshTabs() {
  if (refreshInProgress) {
    refreshRequested = true;
    return;
  }

  refreshInProgress = true;
  try {
    const [tabs, records] = await Promise.all([
      chrome.tabs.query({ currentWindow: true }),
      storageService.getAll(),
    ]);

    tabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    elements.count.textContent = String(tabs.length);
    elements.list.replaceChildren();

    if (tabs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "tab-list__empty";
      empty.textContent = "No open tabs in this window.";
      elements.list.append(empty);
      return;
    }

    for (const tab of tabs) {
      const record = records[String(tab.id)] ?? null;
      elements.list.append(createTabCard(tab, record));
    }
  } catch (error) {
    console.error("[TabRenamer] Could not load tabs.", error);
    setStatus("Unable to load tabs. Reopen the popup and try again.", "error");
    elements.list.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "tab-list__empty";
    empty.textContent = "Tabs could not be loaded.";
    elements.list.append(empty);
  } finally {
    refreshInProgress = false;
    if (refreshRequested) {
      refreshRequested = false;
      void refreshTabs();
    }
  }
}

function refreshUnlessEditing() {
  if (document.activeElement instanceof HTMLInputElement) return;
  void refreshTabs();
}

chrome.tabs.onCreated.addListener(refreshUnlessEditing);
chrome.tabs.onRemoved.addListener(refreshUnlessEditing);
chrome.tabs.onActivated.addListener(refreshUnlessEditing);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.title || changeInfo.url || changeInfo.status === "complete") {
    refreshUnlessEditing();
  }
});

void refreshTabs();
