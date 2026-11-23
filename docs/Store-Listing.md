# Chrome Web Store Listing Draft

## Name

TabRenamer

## Short description

Give every browser tab its own custom title and color.

## Detailed description

Keep busy browser windows organized with TabRenamer.

TabRenamer lets you assign an independent custom name to each open tab. Rename the active tab directly from the extension popup, or open the tab manager to search, rename, and restore tabs across the current window.

Features:
- Set a custom title for each tab independently, even when multiple tabs share the same website.
- Keep custom titles while a page reloads or navigates, where the website and Chrome allow it.
- Restore the page's original title without reloading.
- Choose from eight preset colors for each tab in the TabRenamer popup and tab manager.
- Manage tabs from a dedicated, searchable extension page.
- Store tab names and colors locally for the current browser session.

TabRenamer does not change the actual website content beyond the document title. Chrome-internal pages and restricted pages cannot be renamed.

## Permission explanations

- **Tabs:** identify open tabs, display their titles and URLs in the tab manager, and target the correct tab for rename/restore actions.
- **Storage:** keep tab names and colors for the current browser session.
- **Scripting:** install and run the title controller on supported pages.
- **HTTP and HTTPS website access:** apply and maintain custom titles on supported websites without asking for separate access on every site. Chrome displays its website-access warning during installation.

## Privacy summary draft

TabRenamer stores custom tab names and selected tab colors in Chrome's session storage, associated with Chrome tab IDs. This data is local to the browser extension and is cleared when the relevant browser/extension session storage is cleared.

The current implementation does not include an account system, analytics, advertising, or a remote server for collecting tab data. Tab URLs and titles are read from Chrome's Tabs API to identify and display tabs and are used locally to apply title changes.

Review this text against the exact submitted build and the Chrome Web Store's current privacy disclosures before publication. A privacy policy URL and support contact must be supplied by the publisher if required by the store.

## Assets still required from publisher

- Store icon in the required sizes.
- Screenshots captured from the final release build.
- Support contact and, if applicable, privacy policy URL.
- Final privacy/data-use declarations in the Developer Dashboard.
