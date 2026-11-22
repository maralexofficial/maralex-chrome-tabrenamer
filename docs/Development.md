# Development

## Requirements

- Google Chrome 111 or newer.
- Node.js 20 or newer for automated tests.

## Load the extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose the repository root directory.

Clicking the TabRenamer toolbar icon opens a compact popup for the active tab
only. Select **Manage all tabs** to open the dedicated management page. This
page lists tabs in the current window, supports search by tab title or website,
and provides independent Save/Restore actions. Both the popup and manager
offer eight preset colors per tab plus a clear-color option. Colors are shown
as a subtle colored card accent and are stored independently from custom names.
The manager excludes its own extension page from the tab list.

## Project layout

- `src/background/`: service worker and browser event handlers.
- `src/content/`: page title controller.
- `src/services/`: tab, storage, title, and runtime-message services.
- `src/popup/`: compact active-tab popup.
- `src/options/`: full tab-management page.
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
listeners, scoped script registration, content-controller behavior, title
restoration, navigation recovery, and trusted extension-page messaging. They also cover permission-check rejection,
restricted URLs, missing tabs during navigation, storage read/write failures,
restore acknowledgement failures, and rollback of a visible title after a failed
storage write. Runtime-message integration tests exercise the extension-page trust boundary,
request validation, tab lookup, rename/restore routing, and tab-disappearance
errors. The current CI run passes 63 tests, plus JavaScript syntax and manifest
validation. The user has also confirmed that all eight manual Chrome checks
listed below passed on the tested extension build.

### Manual Chrome verification

Automated tests cannot prove that Chrome itself applies document titles and
renders the extension UI correctly. The user confirmed all eight checks passed
for the current tested build:

1. Rename the active tab from the popup; confirm the browser tab title changes.
2. Rename a different tab from Manage all tabs; confirm only that tab changes.
3. Reload and navigate a renamed tab; confirm the custom title is reapplied.
4. Restore a title; confirm the original page title returns without reloading.
5. Assign and clear colors in the popup and manager; confirm the matching cards update.
6. Try a Chrome-internal page such as `chrome://settings`; confirm the UI reports it as unsupported.
7. Close a renamed tab and reopen the manager; confirm the closed tab is absent.
8. Suspend/restart the service worker (for example, via the extension service-worker DevTools) and confirm saved names and colors remain for the current browser session.

For future release candidates, repeat these checks against the exact candidate commit.

## Title management and site access

The extension requests broad HTTP and HTTPS website access once through the
manifest's required `host_permissions`. Chrome displays its comprehensive
website-data warning when the user installs or updates the extension. Saving
or restoring a title does not request per-site access. The popup and options
page send validated requests to the service worker. The worker verifies the
permission, registers a document-start content script for that exact origin,
applies the title in the page's isolated world, and owns the storage mutation.
The observer re-applies the custom title if the site changes `document.title`.
On full navigation, the background worker reapplies the saved name after the
tab finishes loading.

Chrome-internal pages and non-HTTP(S) URLs are unsupported. The user grants
website access once in Chrome; this permission covers all HTTP and HTTPS origins.

## Storage behavior

Custom tab names are held in `chrome.storage.session`. They survive service
worker suspension/restart but not the end of the browser session. All
mutations go through the single `StorageService` instance owned by the service
worker.

## Conventions

- Use native ES modules.
- Keep user-facing/system error messages in English.
- Validate all messages received from other extension contexts.
- Do not add a dependency or build step without a clear need.
- Update `docs/Architecture.md` when architecture decisions change.
