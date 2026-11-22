# TabRenamer Architecture

## Product scope

TabRenamer assigns an independent custom title to each open Chrome tab. A
custom title is scoped to the Chrome tab ID, not to the page URL.

The v1.0 workflow supports:
- A compact popup that edits only the active tab.
- A dedicated options page that lists all tabs in the current window.
- Search, rename, and restore actions on the options page.
- Eight preset colors per tab, selectable in both popup and options page.
- Highlighting the active tab in the tab manager.
- Keeping custom titles while the same tab reloads or navigates, where the
  page permits script injection.

The popup is intentionally small. The options page is the central management
surface. Renaming never opens a separate page per tab or per action.

## Runtime components

### Manifest V3 service worker

`src/background/service-worker.js` coordinates storage, tab, and title
services. It registers tab lifecycle listeners and reconciles stored tab IDs
with Chrome's current tab set whenever the worker starts.

### Popup

`src/popup/` shows only the active tab, its current custom name, and direct
Save/Restore actions. The Manage all tabs button opens the extension options
page through `chrome.runtime.openOptionsPage()`.

### Options page

`src/options/` is the dedicated tab-management page. It lists tabs in the
current window, excludes its own extension page, supports filtering by title
or website, and offers per-tab Save/Restore actions. It refreshes when tabs
are created, removed, activated, or materially updated while preserving an
active tab-name editor. This is the only full tab-list interface.

### Content script

`src/content/title-controller.js` applies a custom title in the isolated page
world and observes document-title mutations. A registered document-start
content script keeps page scripts from replacing the custom title.

### Services

- `storage-service.js`: session persistence, validation, serialized writes,
  independent name/color records, tab-record lifecycle, and stale-record cleanup.
- `tab-service.js`: Chrome Tabs API facade, custom-title enrichment, and
  lifecycle event registration.
- `title-service.js`: website permission verification, scoped dynamic content-script registration, title application/restoration, and navigation recovery.
- `runtime-message-service.js`: trusted extension-page message boundary, request validation, tab lookup, and asynchronous operation responses.

## Data ownership and persistence

The active-tab data stores use `chrome.storage.session`. Name records and
color assignments are stored separately and keyed by the decimal string form
of `tabId`, allowing two tabs with the same URL to have different names and
colors. Colors can be assigned even when a tab has no custom name. Data survives service-worker suspension/restart but is
cleared when the browser session ends or the extension is reloaded or disabled.

A record has this shape:

```js
{
  "123": {
    "customTitle": "Project dashboard",
    "originalTitle": "Dashboard",
    "createdAt": 1795340000000,
    "updatedAt": 1795340100000
  }
}
```

### Storage service guarantees

- Tab IDs must be non-negative integers.
- Custom titles are trimmed and validated against the shared 1–80 character
  limit.
- Mutations through the service-worker-owned service instance are serialized.
- Repeated renames preserve the first original title and creation timestamp.
- Closing a tab removes its record.
- A Chrome tab replacement migrates the record to the new tab ID.
- Worker startup reconciles records against the current tab list.

## Tab service

`TabService` wraps `chrome.tabs.query` and `chrome.tabs.get`. The URL is
never used as an identity key. The popup and options page read session records
for display; all mutations go through the service worker.

The extension requests HTTP and HTTPS website access once through required
host permissions. The worker re-reads each target tab from Chrome, verifies
permission, applies the title, and performs storage mutations through its
single `StorageService` instance.

## Permissions and access model

The manifest requests `tabs`, `storage`, and `scripting`. The manifest
declares HTTP and HTTPS origins as required host permissions. Chrome-internal
pages, extension pages, and other restricted origins cannot be modified.

## Message protocol

Internal messages use validated envelopes. Only pages served by this
extension may initiate rename and restore operations. The sender is validated
by extension ID and `chrome-extension:` URL; this intentionally supports the
options page opened in a browser tab while rejecting website content scripts.

## Phase boundaries

- EP1: manifest, runtime skeleton, shared contracts, and documentation.
- EP2: storage and tab services.
- EP3: title manager, observer, permission-aware injection, and navigation recovery.
- EP4: experimental separate rename page/context-menu workflow (removed).
- EP5: compact active-tab popup and dedicated searchable tab manager (implemented).
- EP6: per-tab preset colors in popup and tab manager (implemented).
- EP7: permission failures, restricted pages, storage failures, and tab-lifecycle hardening (implemented).
- EP8: complete — 63 automated tests pass; all eight manual Chrome checks were confirmed successful by the user.
- EP9: release guide and automated ZIP packaging prepared; CI validates and uploads the package as a workflow artifact. Chrome Web Store publication remains a manual release action.

## Quality requirements

- Keep the popup concise and use the options page for full tab management.
- Do not use URL as the identity key for an individual tab.
- Treat page titles and user-entered titles as untrusted strings.
- Do not claim title modification succeeded until the script reports success.
- Treat permission API, storage, injection, and disappearing-tab failures as recoverable operation failures.
- Keep the service worker restart-safe and event-driven.
