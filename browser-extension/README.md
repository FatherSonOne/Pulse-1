# Pulse Browser Extension

Capture web content directly to your Pulse War Room projects. Save articles, research, and notes instantly.

## Features

- **Quick Capture**: Select text on any webpage and save it to Pulse with one click
- **Article Detection**: Automatically extract article content from news sites and blogs
- **Full Page Capture**: Save entire web pages for reference
- **Project Integration**: Save directly to your War Room projects
- **Keyboard Shortcuts**: Fast capture with customizable shortcuts
- **Context Menu**: Right-click to capture selections, links, or images

## Installation

### Development / Testing

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `browser-extension` folder

### Production

The extension will be available on the Chrome Web Store (coming soon).

## Usage

### Quick Capture Popup

1. Click the Pulse icon in your browser toolbar (or press `Ctrl+Shift+P`)
2. Select capture type: Selection, Article, or Full Page
3. Choose a project to save to
4. Add optional tags and notes
5. Click "Capture to Pulse"

### Floating Capture Button

When you select text on any page, a "Capture to Pulse" button appears. Click it for instant capture.

### Context Menu

Right-click on:
- **Selected text**: "Capture to Pulse"
- **Any page**: "Capture entire page to Pulse"
- **Links**: "Save link to Pulse"
- **Images**: "Save image to Pulse"

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Open Quick Capture popup |
| `Ctrl+Shift+S` | Capture selected text |
| `Ctrl+Shift+A` | Capture entire page |

On Mac, use `Cmd` instead of `Ctrl`.

## Settings

Access settings from the extension options page:

- **Default Project**: Automatically save captures to a specific project
- **Floating Button**: Show/hide the floating capture button on selection
- **Keyboard Shortcuts**: Enable/disable keyboard shortcuts

## Permissions

The extension requires the following permissions:

- **activeTab**: Access content of the current tab for capture
- **storage**: Save your settings and session
- **contextMenus**: Add right-click menu options
- **notifications**: Show capture success/failure notifications

## Privacy

- Your authentication is handled securely through Pulse
- Captured content is sent directly to your Pulse account
- No data is collected or stored by the extension itself
- See our full [Privacy Policy](https://pulse.logosvision.org/privacy)

## Development

### File Structure

```
browser-extension/
├── manifest.json      # Extension manifest (Manifest V3)
├── popup.html         # Quick capture popup UI
├── options.html       # Settings page
├── src/
│   ├── background.js  # Service worker for API & auth
│   ├── content.js     # Content script for page interaction
│   ├── popup.js       # Popup UI logic
│   └── options.js     # Settings page logic
├── styles/
│   ├── popup.css      # Popup styles
│   ├── content.css    # Injected page styles
│   └── options.css    # Options page styles
└── icons/
    └── icon.svg       # Extension icon (convert to PNG)
```

### Building Icons

Convert the SVG icon to required PNG sizes:

```bash
# Using ImageMagick or similar tool
convert icons/icon.svg -resize 16x16 icons/icon-16.png
convert icons/icon.svg -resize 32x32 icons/icon-32.png
convert icons/icon.svg -resize 48x48 icons/icon-48.png
convert icons/icon.svg -resize 128x128 icons/icon-128.png
```

### Testing

1. Load the unpacked extension in Chrome
2. Make changes to source files
3. Click the refresh button on the extensions page
4. Test the changes

## Support

- Email: support@logosvision.org
- Website: https://pulse.logosvision.org

## License

Copyright © 2026 Logos Vision LLC. All rights reserved.
