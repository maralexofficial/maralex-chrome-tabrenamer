import { MESSAGE_TYPES } from "../shared/constants.js";
import { StorageService } from "../services/storage-service.js";

const elements = {
  activeTab: document.querySelector("#active-tab"),
  activeLabel: document.querySelector("#active-label"),
  status: document.querySelector("#status"),
  manage: document.querySelector("#manage-tabs"),
};

const storageService = new StorageService();
let activeTabId = null;
let currentRecord = null;

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
      payload: { tabId, ...(customTitle === undefined ? {} : { customTitle }) },
    });
  } catch (error) {
    console.error("[TabRenamer] Background operation failed.", error);
    return { ok: false, reason: "The background service could not complete the request." };
  }
}

function renderActiveTab(tab) {
  elements.activeTab.replaceChildren();
  elements.activeLabel.hidden = !tab;

  if (!tab) {
    const empty = document.createElement("p");
    empty.className = "active-tab__loading";
    empty.textContent = "No active tab found.";
    elements.activeTab.append(empty);
    return;
  }

  activeTabId = tab.id;
  const details = getPageDetails(tab);
  const heading = document.createElement("div");
  heading.className = "active-tab__heading";

  if (tab.favIconUrl) {
    const favicon = document.createElement("img");
    favicon.className = "active-tab__favicon";
    favicon.src = tab.favIconUrl;
    favicon.alt = "";
    favicon.addEventListener("error", () => favicon.remove(), { once: true });
    heading.append(favicon);
  }

  const text = document.createElement("div");
  text.className = "active-tab__text";
  const title = document.createElement("h2");
  title.textContent = currentRecord?.customTitle || tab.title || "Untitled tab";
  const host = document.createElement("p");
  host.textContent = details.hostname;
  text.append(title, host);
  heading.append(text);
  elements.activeTab.append(heading);

  const form = document.createElement("form");
  form.className = "active-tab__form";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 80;
  input.value = currentRecord?.customTitle ?? "";
  input.placeholder = "Enter a name for this tab";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Custom name for active tab");

  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Save";

  const restore = document.createElement("button");
  restore.type = "button";
  restore.className = "button--secondary";
  restore.textContent = "Restore";
  restore.hidden = !currentRecord;

  input.disabled = !details.supported;
  save.disabled = !details.supported;
  restore.disabled = !details.supported;
  form.append(input, save, restore);
  elements.activeTab.append(form);

  if (!details.supported) {
    const note = document.createElement("p");
    note.className = "active-tab__note";
    note.textContent = "Chrome does not allow title changes on this page.";
    elements.activeTab.append(note);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const customTitle = input.value.trim();
    if (!customTitle) {
      setStatus("Enter a name before saving.", "error");
      input.focus();
      return;
    }
    input.disabled = save.disabled = restore.disabled = true;
    setStatus("Saving tab name…");
    const result = await sendTitleOperation(MESSAGE_TYPES.RENAME_TAB, activeTabId, customTitle);
    if (result?.ok) {
      currentRecord = { ...(currentRecord ?? {}), customTitle };
      title.textContent = customTitle;
      restore.hidden = false;
      setStatus("Name saved for this tab.", "success");
    } else {
      setStatus(result?.reason ?? "Could not rename this tab.", "error");
    }
    input.disabled = !details.supported;
    save.disabled = !details.supported;
    restore.disabled = !details.supported;
  });

  restore.addEventListener("click", async () => {
    input.disabled = save.disabled = restore.disabled = true;
    setStatus("Restoring original page title…");
    const result = await sendTitleOperation(MESSAGE_TYPES.RESTORE_TAB, activeTabId);
    if (result?.ok) {
      currentRecord = null;
      input.value = "";
      title.textContent = tab.title || "Untitled tab";
      restore.hidden = true;
      setStatus("Original title restored.", "success");
    } else {
      setStatus(result?.reason ?? "Could not restore this tab.", "error");
    }
    input.disabled = !details.supported;
    save.disabled = !details.supported;
    restore.disabled = !details.supported || !currentRecord;
  });
}

async function loadActiveTab() {
  try {
    const [tabs] = await Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
    ]);
    const tab = tabs[0];
    if (!tab || !Number.isInteger(tab.id)) {
      renderActiveTab(null);
      return;
    }
    currentRecord = await storageService.get(tab.id);
    renderActiveTab(tab);
  } catch (error) {
    console.error("[TabRenamer] Could not load active tab.", error);
    setStatus("Unable to load the active tab.", "error");
    renderActiveTab(null);
  }
}

elements.manage.addEventListener("click", async () => {
  elements.manage.disabled = true;
  try {
    await chrome.runtime.openOptionsPage();
  } catch (error) {
    console.error("[TabRenamer] Could not open tab manager.", error);
    setStatus("Could not open tab management.", "error");
    elements.manage.disabled = false;
  }
});

void loadActiveTab();
