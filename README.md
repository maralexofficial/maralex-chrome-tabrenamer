# TabRenamer

A lightweight Manifest V3 Chrome extension for assigning an independent custom
name to each open browser tab.

## Current status

- **EP1 — Project foundation:** complete.
- **EP2 — Storage and tab services:** implemented; automated tests included.
- **EP3–EP8:** planned.

The current build includes session-scoped per-tab storage, a Chrome Tabs API
facade, tab-close cleanup, replacement-ID migration, and startup reconciliation.
The actual title controller, context-menu actions, and full popup workflow are
not implemented yet.

## Requirements

- Google Chrome 111 or newer
- Node.js 20 or newer for automated tests

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository root.

## Development

Run tests:

```sh
npm test
```

Validate the manifest:

```sh
npm run check:manifest
```

See [Development](docs/Development.md) and
[Architecture](docs/Architecture.md) for more information.
