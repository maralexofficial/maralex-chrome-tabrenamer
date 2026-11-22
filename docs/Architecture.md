# TabRenamer Architecture

## Product scope

TabRenamer lets a user assign an independent custom title to each open Chrome
tab. A title is scoped to the Chrome tab ID, not to the page URL.

The v1.0 workflow supports:
- Renaming from the extension popup.
- Renaming from a tab context menu.
- Restoring the page's original title.
- Keeping the custom title while the same tab reloads or navigates, where the
  page permits script injection.

Automatic URL-based rules, cross-device synchronization, tab groups, and
persistence across complete browser restarts are out of scope for v1.0.

## Runtime components

### Manifest V3 service worker

`src/background/service-worker.js` is the extension's event-driven
coordination entry point. It creates the storage and tab services, registers
tab lifecycle listeners, and reconciles stored tab IDs with Chrome's current
tab set whenever the worker starts. It must remain safe to suspend and restart.

### Popup and rename page

`src/popup/` contains the active-tab popup UI. `src/rename/` contains the focused
rename page opened by the tab context menu. Both are view layers; storage and
tab operations belong in services.

### Context menus

`context-menu-service.js` registers a TabRenamer parent menu with Rename this
tab… and Restore original page title actions. Rename opens a dedicated
extension page with the clicked tab ID; restore delegates directly to
`TitleService`. Menu items are rebuilt idempotently when the service worker
starts.

### Content script

`src/content/title-controller.js` applies a custom title in the isolated page
world and observes document-title mutations. A registered document-start
content script keeps page scripts from replacing the custom title. The
controller is idempotent within a document and supports explicit restoration.

### Services

- `storage-service.js`: session persistence, validation, serialized writes,
  tab-record lifecycle, and stale-record cleanup.
- `tab-service.js`: Chrome Tabs API facade, custom-title enrichment, and
  lifecycle event registration.
- `title-service.js`: optional host permission requests, scoped dynamic content-script registration, title application/restoration, and navigation recovery.

### Shared modules

`src/shared/` contains message contracts, constants, and input validation
used across extension contexts.

## Data ownership and persistence

The v1.0 active-tab data store uses `chrome.storage.session`. Records are keyed
by the decimal string form of `tabId`, allowing two tabs with the same URL to
have different names. The store survives service-worker suspension/restart
but is cleared when the browser session ends or the extension is reloaded or
disabled. Chrome can assign new tab IDs when restoring a browser sessions, so
cross-restart restoration is not guaranteed and is explicitly not part of v1.0.

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
- Mutations through the service-worker-owned service instance are serialized
  to prevent overlapping read-modify-write operations from losing updates.
- Repeated renames preserve the first original title and creation timestamp.
- Closing a tab removes its record.
- A Chrome tab replacement migrates the record to the new tab ID. If the
  destination already has a record, that destination record wins.
- Worker startup reconciles records against the current tab list and removes
  stale entries.
- Malformed records already present in storage are ignored on reads.

The write queue is an in-memory coordination mechanism, not the source of
truth. Data remains in `chrome.storage.session`, so service-worker suspension
does not erase it. The queue serializes mutations within the single
service-worker instance; it is not a distributed lock across independent
extension contexts.

## Tab service

`TabService` wraps `chrome.tabs.query` and `chrome.tabs.get`. Returned tabs
are enriched with `customTitle`, which is either the saved name or `null`.
The URL is never used as an identity key.

The extension requests HTTP and HTTPS website access once through required
host permissions. The popup sends a validated title-operation message to the
service worker without requesting per-site access. The worker
re-reads the tab from Chrome, verifies the permission grant, applies the title,
and performs all storage mutations through its single `StorageService`
instance. This avoids popup/worker read-modify-write races.

The lifecycle adapter registers:
- `tabs.onRemoved`: remove the closed tab's record.
- `tabs.onReplaced`: migrate the old tab's record to the replacement ID.

Listeners are registered once by the service-worker entry point. Asynchronous
cleanup failures are logged and do not escape the Chrome event callback.

## Permissions and access model

The initial manifest requests only:
- `tabs`: enumerate and identify tabs.
- `storage`: store session-scoped records.
- `contextMenus`: provide tab context-menu actions.
- `scripting`: inject the title controller when permitted.

No broad `host_permissions` are requested. The manifest declares HTTP and HTTPS origins as required host permissions.
Chrome displays the broad website-access warning once when the user installs
or updates the extension to this permission model. Saving or restoring a title
does not trigger additional per-site permission prompts. Chrome-internal pages, extension
pages, and other restricted origins cannot be modified.

## Message protocol

Internal messages use an envelope:

```js
{ type: "TABRENAMER/PING", payload: {} }
```

Message type constants live in `src/shared/constants.js`. Message envelope
construction and validation live in `src/shared/messages.js`. Unknown or
malformed messages must be ignored safely.

## Phase boundaries

- EP1: manifest, runtime skeleton, shared contracts, and documentation.
- EP2: storage and tab services, lifecycle cleanup, and stale-record
  reconciliation.
- EP3: title manager, observer, permission-aware injection, and navigation
  recovery (implemented).
- EP4: tab context menu actions.
- EP5: popup tab listing and editing.
- EP6: permission failures, restricted pages, and lifecycle hardening.
- EP7: unit, integration, and browser verification.
- EP8: release documentation and packaging.

## Quality requirements

- Prefer small modules with one responsibility.
- Avoid broad host permissions.
- Do not use URL as the identity key for an individual tab.
- Treat page titles and user-entered titles as untrusted strings.
- Do not claim title modification succeeded until the script reports success.
- Keep the service worker restart-safe and event-driven.
