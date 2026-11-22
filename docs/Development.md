# Development

## Requirements

- Google Chrome 111 or newer.
- Node.js 20 or newer for automated tests.

## Load the extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose the repository root directory.

The current build includes EP3 title management and EP4 tab context menus.
The context menu can open a focused rename page for the clicked tab or restore
its original page title. Full multi-tab listing and management remain in EP5.

## Project layout

- `src/background/`: service worker and browser event handlers.
- `src/content/`: page title controller.
- `src/services/`: tab, storage, and title services.
- `src/popup/`: extension popup.
- `src/shared/`: constants, message contracts, and validation.
- `tests/helpers/`: Chrome API test doubles.
- `tests/`: automated unit and integration-style tests.
- `docs/`: architecture and development notes.

## Tests

Run all tests:

```sh
npm test
```

Validate the manifest:

```sh
npm run check:manifest
```

The tests use Node's built-in test runner and in-memory Chrome API test
doubles. They cover storage validation, independent tab records, concurrent
mutations, tab-ID migration, stale-record cleanup, tab lookup, lifecycle
listeners, optional permission decisions, scoped script registration,
content-controller behavior, title restoration, and navigation recovery. A
real Chrome load-and-interaction test is still required to verify browser API
behavior and actual website permissions.

## Title management and site access

The extension requests broad HTTP and HTTPS website access once through the
manifest's required `host_permissions`. Chrome displays its comprehensive
website-data warning when the user installs or updates the extension. Saving
or restoring a title never calls `chrome.permissions.request()` and does not
show another per-site prompt. The popup sends a validated request to the service worker. The worker verifies
the permission, registers a document-start content script for that exact
origin, applies the title in the page's isolated world, and owns the storage
mutation. The popup does not write tab records directly. The observer re-applies the custom
title if the site changes `document.title`. On full navigation, the background
worker reapplies the saved name after the tab finishes loading and updates
the original title used by Restore.

Chrome-internal pages and non-HTTP(S) URLs are unsupported. The user grants website access once in Chrome; this permission covers all HTTP
and HTTPS origins. Chrome-internal pages remain unsupported.

## Storage behavior

Custom tab names are held in `chrome.storage.session`. They survive service
worker suspension/restart but not the end of the browser session. The
service-worker startup reconciliation removes records whose tab IDs are no
longer present.

All mutations should go through the single `StorageService` instance owned by
the service worker. Its write queue serializes read-modify-write operations.

## Conventions

- Use native ES modules.
- Keep user-facing/system error messages in English.
- Validate all messages received from other extension contexts.
- Do not add a dependency or build step without a clear need.
- Update `docs/Architecture.md` when architecture decisions change.
