# TabRenamer

A lightweight Manifest V3 Chrome extension for assigning an independent custom
name to each open browser tab.

## Current status

**EP1 — Project foundation:** implemented.

The current version contains the extension manifest, service-worker entry
point, shared message contracts and validation, a placeholder popup, automated
unit tests, and project documentation. Tab renaming itself is not implemented
yet; that work is planned for EP2–EP5.

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
