import { StorageService } from "../services/storage-service.js";
import { TitleService } from "../services/title-service.js";

const elements = {
  pageName: document.querySelector("#page-name"),
  form: document.querySelector("#rename-form"),
  input: document.querySelector("#custom-title"),
  save: document.querySelector("#save-button"),
  restore: document.querySelector("#restore-button"),
  status: document.querySelector("#status"),
};

const storageService = new StorageService();
const titleService = new TitleService({ storageService });
let activeTab = null;

function setStatus(message, kind = "neutral") {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

function setBusy(busy) {
  elements.save.disabled = busy;
  elements.restore.disabled = busy || !activeTab?.hasCustomTitle;
}

async function initialize() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab ?? null;

    if (!activeTab || !Number.isInteger(activeTab.id)) {
      elements.pageName.textContent = "No active tab found.";
      elements.form.hidden = true;
      return;
    }

    let hostname = "This page";
    try {
      hostname = new URL(activeTab.url).hostname || hostname;
    } catch {
      // Restricted browser pages do not have a normal web origin.
    }
    elements.pageName.textContent = hostname;

    const record = await storageService.get(activeTab.id);
    activeTab.hasCustomTitle = Boolean(record);
    elements.input.value = record?.customTitle ?? "";
    elements.restore.disabled = !record;

    if (!/^https?:$/.test(new URL(activeTab.url).protocol)) {
      elements.input.disabled = true;
      elements.save.disabled = true;
      setStatus("Chrome does not allow title changes on this page.", "error");
    }
  } catch (error) {
    elements.pageName.textContent = "Could not read the active tab.";
    setStatus("Unable to initialize TabRenamer. Try reopening the popup.", "error");
    console.error("[TabRenamer] Popup initialization failed.", error);
  }
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeTab) return;

  setBusy(true);
  setStatus("Requesting access and applying the custom title…");

  // renameTab starts chrome.permissions.request synchronously from this click.
  const result = await titleService.renameTab(activeTab, elements.input.value);
  if (result.ok) {
    activeTab.hasCustomTitle = true;
    elements.restore.disabled = false;
    setStatus("Custom tab name saved.", "success");
  } else {
    setStatus(result.reason ?? "Could not rename this tab.", "error");
  }

  setBusy(false);
});

elements.restore.addEventListener("click", async () => {
  if (!activeTab) return;

  setBusy(true);
  setStatus("Restoring the page title…");

  const result = await titleService.restoreTab(activeTab);
  if (result.ok) {
    activeTab.hasCustomTitle = false;
    elements.input.value = "";
    elements.restore.disabled = true;
    setStatus("Original page title restored.", "success");
  } else {
    setStatus(result.reason ?? "Could not restore this tab.", "error");
  }

  setBusy(false);
});

void initialize();
