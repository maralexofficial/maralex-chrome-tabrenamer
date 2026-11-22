# Development

## Requirements

- Google Chrome 111 or newer.
- A modern JavaScript runtime for running the automated tests (Node.js 20 or
  newer recommended).

## Load the extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose the repository root directory.

The current EP1 build is a foundation only. The popup and worker are not yet
connected to tab-renaming functionality.

## Project layout

- `src/background/`: service worker and browser event handlers.
- `src/content/`: page title controller.
- `src/services/`: tab, storage, and title services.
- `src/popup/`: extension popup.
- `src/shared/`: constants, message contracts, and validation.
- `tests/`: automated tests.
- `docs/`: architecture and development notes.

## Tests

EP1 has no external runtime dependencies. Run the shared-module tests with:

```sh
node --test
```

The manifest can be parsed and checked with:

```sh
node --input-type=module -e "import fs from 'node:fs'; JSON.parse(fs.readFileSync('manifest.json', 'utf8')); console.log('manifest valid')"
```

## Conventions

- Use native ES modules.
- Keep user-facing/system error messages in English.
- Validate all messages received from other extension contexts.
- Do not add a dependency or build step without a clear need.
- Update `docs/Architecture.md` when architecture decisions change.
