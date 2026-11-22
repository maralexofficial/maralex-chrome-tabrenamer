# Development

## Requirements

- Google Chrome 111 or newer.
- Node.js 20 or newer for automated tests.

## Load the extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose the repository root directory.

The current EP2 build provides the storage and tab-management foundation.
Custom title application and the interactive popup are implemented in later
phases.

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
mutations, tab-ID migration, stale-record cleanup, tab lookup, and lifecycle
listeners. A real Chrome load-and-interaction test remains part of browser
verification.

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
