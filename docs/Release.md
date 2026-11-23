# Release and Packaging

## Current release baseline

- Extension: TabRenamer
- Manifest version: 1.0.0
- Minimum Chrome version: 111
- Manifest V3
- Release status: packaging is automated; Chrome Web Store publication is a separate manual action.

The release archive contains only `manifest.json` and the complete `src/` directory. It deliberately excludes tests, documentation, Git metadata, and development files. No build step or third-party runtime dependency is required.

## Build a package

Requirements: Node.js 20+, npm, `zip`, and `unzip`.

Run from the repository root:

```sh
npm test
npm run check:syntax
npm run check:manifest
npm run package
```

The archive is written to `dist/tabrenamer-v<VERSION>.zip`. The packaging script reads the version from `manifest.json`, creates a clean staging directory, archives the extension runtime files, and validates the ZIP integrity.

## Pre-release checklist

- [ ] All eight manual Chrome checks documented in [Development](Development.md) have passed on the candidate commit.
- [ ] CI is green for the exact release commit.
- [ ] `manifest.json` version is incremented according to the intended release.
- [ ] Permission list and host access are reviewed; explain the broad HTTP/HTTPS access clearly in the store listing.
- [ ] Run the packaging commands and inspect the archive contents.
- [ ] Test the ZIP by loading its extracted directory with Chrome's **Load unpacked** flow.
- [x] Draft store listing text, permission explanations, and privacy summary in [Store Listing](Store-Listing.md).\n- [ ] Capture final screenshots, provide a support contact and (if required) privacy policy URL, and complete the Developer Dashboard declarations.
- [ ] Confirm the privacy policy accurately explains that tab names and colors are stored in `chrome.storage.session` and are not retained after the browser session/extension lifecycle described in the documentation.
- [ ] Submit the archive through the Chrome Web Store Developer Dashboard and complete Google's review process.

## Permission and privacy disclosures

The extension declares `tabs`, `storage`, and `scripting`, plus required HTTP and HTTPS host permissions. The host permissions enable title management on supported websites without repeated per-site prompts. Chrome-internal pages and other restricted pages cannot be modified.

Custom tab names and colors are stored locally in `chrome.storage.session`, keyed by tab ID. The extension has no server-side account, analytics, or remote data service in this implementation. Re-check these statements against the exact release candidate before publication.

## Versioning

Update the `version` field in `manifest.json` before preparing a public release. The package filename follows that value. Do not publish a new archive under an unchanged version.
