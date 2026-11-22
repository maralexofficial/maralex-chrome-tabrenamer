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
coordination entry point. It must remain safe to suspend and restart. Persistent
state must never depend on module-level variables in this worker.

### Popup

`src/popup/` contains the user interface for listing open tabs and editing
custom titles. The popup is a view layer; storage and tab operations belong in
services.

### Content script

`src/content/` will apply a custom title to the current document and observe
page-driven title changes. Content scripts will be injected on demand after
the user has granted access to the relevant site.

### Services

- `tab-service.js`: Chrome Tabs API operations.
- `storage-service.js`: persistence and tab-record lifecycle.
- `title-service.js`: title application and restoration coordination.

### Shared modules

`src/shared/` contains message contracts, constants, and input validation
used across extension contexts.

## Data ownership and persistence

The v1.0 active-tab data store uses `chrome.storage.session`. Records are keyed
by `tabId`, allowing two tabs with the same URL to have different names.
The store survives service-worker suspension/restart but is cleared when the
browser session ends or the extension is reloaded/disabled. Chrome can assign
new tab IDs when restoring a browser session, so cross-restart restoration is
not guaranteed and is explicitly not part of v1.0.

A record is expected to have this shape:

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

The implementation must validate tab IDs and custom titles at service
boundaries. Removing a tab must remove its corresponding record.

## Permissions and access model

The initial manifest requests only:
- `tabs`: enumerate and identify tabs.
- `storage`: store session-scoped records.
- `contextMenus`: provide tab context-menu actions.
- `scripting`: inject the title controller when permitted.

No broad `host_permissions` are requested by the initial manifest. A later
phase must use optional host permissions and explain to the user that title
management requires access to the relevant website. Chrome-internal pages and
other restricted origins cannot be modified.

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
- EP2: storage and tab services.
- EP3: title manager, observer, permission-aware injection, and navigation
  recovery.
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
