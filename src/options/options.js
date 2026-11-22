import { StorageService } from "../services/storage-service.js";
import { TitleService } from "../services/title-service.js";
import { TAB_COLORS } from "../shared/tab-colors.js";

const elements = {
  list: document.querySelector("#tab-list"),
  count: document.querySelector("#tab-count"),
  status: document.querySelector("#status"),
  search: document.querySelector("#search"),
  refresh: document.querySelector("#refresh"),
};
const storageService = new StorageService();
const titleService = new TitleService({ storageService });
const ownPageUrl = chrome.runtime.getURL("src/options/options.html");
let refreshInProgress = false;
let refreshRequested = false;
let latestTabs = [];
let latestRecords = {};
let latestTabColors = {};

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
    const tab = await chrome.tabs.get(tabId);
    return type === "rename"
      ? await titleService.renameTab(tab, customTitle)
      : await titleService.restoreTab(tab);
  } catch (error) {
    console.error("[TabRenamer] Tab management operation failed.", error);
    return {
      ok: false,
      reason: error?.message || "The title operation could not be completed.",
    };
  }
}

function createColorPicker(tabId, selectedColor) {
  const picker = document.createElement("div");
  picker.className = "tab-card__colors";
  picker.setAttribute("role", "group");
  picker.setAttribute("aria-label", "Tab color");
  const choices = [{ id: "none", label: "No color", value: null }, ...TAB_COLORS];
  for (const choice of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-swatch" + (choice.value === selectedColor ? " color-swatch--selected" : "");
    button.title = choice.label;
    button.setAttribute("aria-label", choice.label);
    button.setAttribute("aria-pressed", String(choice.value === selectedColor));
    if (choice.value) button.style.backgroundColor = choice.value;
    else button.classList.add("color-swatch--none");
    button.addEventListener("click", async () => {
      picker.querySelectorAll("button").forEach((item) => { item.disabled = true; });
      try {
        await storageService.setTabColor(tabId, choice.value);
        latestTabColors[String(tabId)] = choice.value;
        setStatus(choice.value ? "Tab color saved." : "Tab color cleared.", "success");
        renderTabs();
      } catch (error) {
        setStatus(error?.message || "Could not save tab color.", "error");
        picker.querySelectorAll("button").forEach((item) => { item.disabled = false; });
      }
    });
    picker.append(button);
  }
  return picker;
}

function createTabCard(tab, record) {
  const card = document.createElement("article");
  card.className = "tab-card";
  if (tab.active) card.classList.add("tab-card--active");
  const tabColor = latestTabColors[String(tab.id)] ?? null;
  if (tabColor) { card.classList.add("tab-card--colored"); card.style.setProperty("--tab-color", tabColor); }

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
  const details = document.createElement("p");
  details.className = "tab-card__details";
  details.textContent = getPageDetails(tab).hostname;
  titleGroup.append(title, details);
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
  input.dataset.tabEditor = "true";
  input.setAttribute("aria-label", "Custom name for " + (tab.title || "tab"));

  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Save";
  const restore = document.createElement("button");
  restore.type = "button";
  restore.className = "button--secondary";
  restore.textContent = "Restore";
  restore.hidden = !record;

  const supported = getPageDetails(tab).supported && Number.isInteger(tab.id);
  input.disabled = save.disabled = restore.disabled = !supported;
  form.append(input, save, restore);

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
    const result = await sendTitleOperation("rename", tab.id, customTitle);
    if (result?.ok) {
      latestRecords[String(tab.id)] = { ...(latestRecords[String(tab.id)] ?? {}), customTitle };
      setStatus("Name saved for this tab.", "success");
      renderTabs();
    } else {
      setStatus(result?.reason ?? "Could not rename this tab.", "error");
      input.disabled = !supported;
      save.disabled = !supported;
      restore.disabled = !supported || !record;
    }
  });

  restore.addEventListener("click", async () => {
    input.disabled = save.disabled = restore.disabled = true;
    setStatus("Restoring original page title…");
    const result = await sendTitleOperation("restore", tab.id);
    if (result?.ok) {
      delete latestRecords[String(tab.id)];
      setStatus("Original title restored.", "success");
      renderTabs();
    } else {
      setStatus(result?.reason ?? "Could not restore this tab.", "error");
      input.disabled = !supported;
      save.disabled = !supported;
      restore.disabled = !supported;
    }
  });

  card.append(heading, form, createColorPicker(tab.id, tabColor));
  if (!supported) {
    const note = document.createElement("p");
    note.className = "tab-card__note";
    note.textContent = "Chrome does not allow title changes on this page.";
    card.append(note);
  }
  return card;
}

function renderTabs() {
  const query = elements.search.value.trim().toLocaleLowerCase();
  const filtered = latestTabs.filter((tab) => {
    const record = latestRecords[String(tab.id)];
    const title = (record?.customTitle || tab.title || "").toLocaleLowerCase();
    const details = getPageDetails(tab).hostname.toLocaleLowerCase();
    return !query || title.includes(query) || details.includes(query) || (tab.url || "").toLocaleLowerCase().includes(query);
  });
  elements.count.textContent = String(latestTabs.length);
  elements.list.replaceChildren();

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "tab-list__empty";
    empty.textContent = latestTabs.length === 0
      ? "No other tabs are open in this window."
      : "No tabs match your search.";
    elements.list.append(empty);
    return;
  }

  for (const tab of filtered) {
    elements.list.append(createTabCard(tab, latestRecords[String(tab.id)] ?? null));
  }
}

async function refreshTabs() {
  if (refreshInProgress) {
    refreshRequested = true;
    return;
  }
  refreshInProgress = true;
  try {
    const [tabs, records, colors] = await Promise.all([
      chrome.tabs.query({ currentWindow: true }),
      storageService.getAll(),
      storageService.getAllTabColors(),
    ]);
    latestTabs = tabs
      .filter((tab) => tab.url !== ownPageUrl && !tab.url?.startsWith(ownPageUrl + "?"))
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    latestRecords = records;
    latestTabColors = colors;
    setStatus("");
    renderTabs();
  } catch (error) {
    console.error("[TabRenamer] Could not load tabs.", error);
    setStatus("Unable to load tabs. Try refreshing this page.", "error");
  } finally {
    refreshInProgress = false;
    if (refreshRequested) {
      refreshRequested = false;
      void refreshTabs();
    }
  }
}

function refreshUnlessEditing() {
  if (document.activeElement instanceof HTMLInputElement && document.activeElement.dataset.tabEditor === "true") return;
  void refreshTabs();
}

elements.search.addEventListener("input", renderTabs);
elements.refresh.addEventListener("click", () => void refreshTabs());
chrome.tabs.onCreated.addListener(refreshUnlessEditing);
chrome.tabs.onRemoved.addListener(refreshUnlessEditing);
chrome.tabs.onActivated.addListener(refreshUnlessEditing);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.title || changeInfo.url || changeInfo.status === "complete") refreshUnlessEditing();
});
void refreshTabs();
