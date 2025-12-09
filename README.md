# Data Test ID Collector Chrome Extension

A Chrome extension that collects and highlights all elements with `data-testid` attributes on any webpage.

## Features

- 🔍 **Auto-detect** elements with `data-testid` attributes
- ✨ **Highlight** elements with visual indicators showing their test IDs
- 📋 **Collect & Display** all test IDs in a convenient popup
- 🔎 **Search** through collected test IDs
- 📤 **Export** collected data to JSON
- 📋 **Copy** all test IDs to clipboard
- 🎯 **Scroll to element** by clicking on it in the list

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `collect-data-testid` folder
5. The extension icon should appear in your Chrome toolbar

## Usage

1. Navigate to any webpage
2. Click the extension icon in your Chrome toolbar
3. Click **"Refresh"** to collect all elements with `data-testid` attributes
4. Click **"Highlight Elements"** to visually highlight all elements on the page
5. Use the search box to filter through collected test IDs
6. Click on any item in the list to scroll to that element on the page
7. Use **"Export to JSON"** to save all collected data
8. Use **"Copy All IDs"** to copy all test IDs to your clipboard

## Files Structure

```
collect-data-testid/
├── manifest.json       # Extension configuration
├── content.js         # Script that runs on web pages
├── content.css        # Styles for highlighted elements
├── popup.html         # Extension popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup functionality
├── icons/             # Extension icons (16x16, 48x48, 128x128)
└── README.md          # This file
```

## Icon Setup

The extension requires icon files. You can:

1. Create your own icons (16x16, 48x48, 128x128 pixels) and place them in the `icons/` folder
2. Or use any PNG images named `icon16.png`, `icon48.png`, and `icon128.png`

## How It Works

- **Content Script** (`content.js`): Injected into every webpage to find and highlight elements
- **Popup** (`popup.html/js`): Provides the UI to control highlighting and view collected data
- **CSS** (`content.css`): Styles the highlighted elements with green outlines and labels

## Browser Compatibility

- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers

## Notes

- The extension only works on web pages (not on `chrome://` pages)
- Elements are highlighted with a green outline and show their `data-testid` value above them
- The extension automatically refreshes the list when you click "Highlight Elements"

