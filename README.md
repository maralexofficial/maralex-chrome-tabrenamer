# TabRenamer

Give each open browser tab its own custom title.

TabRenamer helps you keep a busy browser organized. Give tabs clear, personal names, choose a color for each one, and find the tab you need at a glance.

## Table of contents

- [Preface](#preface)
- [About this repo](#about-this-repo)
- [Quick Overview](#quick-overview)
- [Installation](#installation)
- [Usage](#usage)
- [Helpful notes](#helpful-notes)
- [Troubleshooting](#troubleshooting)
- [Authors](#authors)
- [License](#license)

## Preface

Have you ever had several tabs open from the same website and lost track of which one was which? TabRenamer lets you give every tab its own name, so your browser stays easier to navigate.

## About this repo

This repository contains TabRenamer, a Chrome extension designed to make managing open tabs simple.

**Powered by maralexofficial | Visit repository on GitHub**

[https://github.com/maralexofficial/maralex-chrome-tabrenamer](https://github.com/maralexofficial/maralex-chrome-tabrenamer)

> TabRenamer is not yet published in the Chrome Web Store. Until the first public release is available, you can install it manually using the instructions below.

## Quick Overview

- Give every open tab its own custom title.
- Rename the active tab directly from the extension popup.
- Manage and search tabs in the current window from one place.
- Choose from eight preset colors for each tab.
- Restore a tab's original website title whenever you want.
- Keep your custom names and colors during the current browser session.

## Installation

### Requirements

- Google Chrome 111 or newer.

### Install from this repository

1. Download the repository:
   - Click **Code** on the GitHub repository page.
   - Choose **Download ZIP**.
   - Extract the downloaded ZIP file to a folder on your computer.
2. Open Google Chrome and enter `chrome://extensions` in the address bar.
3. Turn on **Developer mode** using the switch in the top-right corner.
4. Click **Load unpacked**.
5. Select the extracted **maralex-chrome-tabrenamer** folder — the folder that contains `manifest.json`.
6. TabRenamer should now appear in your extensions list. You can pin it to the toolbar using Chrome's puzzle-piece menu.

### Update the extension

1. Download and extract the latest repository version.
2. Open `chrome://extensions`.
3. Find TabRenamer and click **Remove** only if you need to replace the old folder or Chrome cannot reload it.
4. Click **Load unpacked** and select the new extracted project folder.

If you keep using the same folder, you can usually update the extension from its card with the **Reload** button after replacing the files.

## Usage

### Rename the active tab

1. Click the TabRenamer icon in the Chrome toolbar.
2. Enter the name you want to see on the current tab.
3. Save your change.

The tab title updates without opening a separate rename page.

### Manage all open tabs

1. Open the TabRenamer popup.
2. Choose **Manage all tabs**.
3. Search for a tab by its title or website.
4. Enter a custom name and save it. Each tab is managed independently.

### Choose a tab color

Use the color choices shown for a tab in the popup or tab manager. You can select one of the eight preset colors or clear the color again.

### Restore the original title

Use the restore action for the tab. TabRenamer brings back the website's original title without requiring you to reload the page.

## Helpful notes

- **Your names are temporary:** custom names and colors are kept for the current browser session. They are not intended as permanent bookmarks or settings.
- **Website access:** Chrome asks you to approve access to websites when installing the extension. This access is needed so TabRenamer can apply custom titles on supported websites.
- **Some pages cannot be renamed:** Chrome-internal pages such as `chrome://settings`, the Chrome Web Store, and other restricted pages do not allow extensions to change their titles.
- **Only your current window is managed:** the tab manager lists tabs in the current Chrome window and does not include its own management page.
- **Original website content stays unchanged:** TabRenamer changes the displayed document title; it does not rewrite the page itself.

## Troubleshooting

**The extension does not appear in the toolbar**

Open Chrome's extensions menu (the puzzle-piece icon) and pin TabRenamer to the toolbar.

**Chrome says the page is not supported**

Some browser pages are protected by Chrome and cannot be modified. Try a regular website that starts with `https://` or `http://`.

**A custom name disappears after restarting Chrome**

That is expected. TabRenamer currently stores names and colors for the current browser session only. Add the name again after starting a new session.

**The extension does not reflect updated files**

Open `chrome://extensions` and click **Reload** on the TabRenamer card. Then close and reopen the popup or tab manager.

## Authors

Created and maintained by **maralexofficial**.

- GitHub: [@maralexofficial](https://github.com/maralexofficial)
- Repository: [maralexofficial/maralex-chrome-tabrenamer](https://github.com/maralexofficial/maralex-chrome-tabrenamer)

## License

TabRenamer is distributed under the [MIT License](LICENSE).
