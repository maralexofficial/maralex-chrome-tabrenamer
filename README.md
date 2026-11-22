# TabRenamer

A lightweight Manifest V3 Chrome extension for assigning an independent custom
name to each open browser tab.

## Current status

- **EP1 — Project foundation:** complete.
- **EP2 — Storage and tab services:** implemented; automated tests included.
- **EP3 — Title management:** implemented; automated tests included.
- **EP4 — Separate rename page and context-menu workflow:** removed.
- **EP5 — Multi-tab popup management:** implemented; automated tests included.
- **EP6–EP8:** planned.

The extension uses the popup as its only user interface. It lists every tab in
the current window, marks the active tab, and lets each supported tab be
renamed or restored directly in the list. No additional rename tab or
context-menu workflow is opened. Tab names are scoped to Chrome tab IDs and
stored for the current browser session. The extension reapplies names after
full page navigation where the page permits script injection.

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
