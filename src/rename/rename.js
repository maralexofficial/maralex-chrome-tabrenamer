import { MESSAGE_TYPES } from "../shared/constants.js";
import { StorageService } from "../services/storage-service.js";

const elements = {
  form: document.querySelector("#rename-form"),
  input: document.querySelector("#custom-title"),
  pageName: document.querySelector("#page-name"),
  status: document.querySelector("#status"),
  save: document.querySelector("#save-button"),
};

const params = new URLSearchParams(location.search);
const tabId = Number(params.get("tabId"));
const storageService = new StorageService();
let targetTab = null;

function setStatus(message, kind = "neutral") {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

async function initialize() {
  if (!Number.isInteger(tabId) || tabId < 0) {
    elements.form.hidden = true;
    setStatus("Invalid tab reference.", "error");
    return;
  }

  try {
    targetTab = await chrome.tabs.get(tabId);
    const url = new URL(targetTab.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported page");
    }

    const record = await storageService.get(tabId);
    elements.pageName.textContent = url.hostname;
    elements.input.value = record?.customTitle ?? "";
    elements.input.focus();
    elements.input.select();
  } catch {
    elements.form.hidden = true;
    setStatus("This tab is no longer available or cannot be renamed.", "error");
  }
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!targetTab) return;

  elements.save.disabled = true;
  setStatus("Saving tab name…");

  try {
    const result = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.RENAME_TAB,
      payload: { tabId, customTitle: elements.input.value },
    });

    if (!result?.ok) {
      setStatus(result?.reason ?? "Could not rename this tab.", "error");
      return;
    }

    setStatus("Custom tab name saved. You can close this tab.", "success");
  } catch (error) {
    console.error("[TabRenamer] Context-menu rename failed.", error);
    setStatus("The background service could not complete the request.", "error");
  } finally {
    elements.save.disabled = false;
  }
});

void initialize();
