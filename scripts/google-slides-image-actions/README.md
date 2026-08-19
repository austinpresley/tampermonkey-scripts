# Google Slides: Open/Download selected images

## Purpose

Adds Open and Download actions to the Google Slides image context menu. It supports single images and best-effort multi-selection by finding rendered images within the selection bounds.

## Supported pages

- `https://docs.google.com/*`

## Testing notes

- [ ] Confirm both actions appear when right-clicking one selected image.
- [ ] Confirm multi-selected images are detected and processed once each.
- [ ] Confirm blob-backed images open and download correctly.
- [ ] Confirm the script does not alter text, shape, or background context menus.
- [ ] Check browser handling when multiple tabs or downloads are requested.

## Greasy Fork status

- Status: published; GitHub source synchronization pending configuration.
- Listing: [Greasy Fork script 559190](https://greasyfork.org/en/scripts/559190-google-slides-open-download-selected-images)
- Raw GitHub source: [main branch](https://raw.githubusercontent.com/austinpresley/tampermonkey-scripts/main/scripts/google-slides-image-actions/google-slides-image-actions.user.js)
- Imported Greasy Fork version: `1.8.1`; repository migration version: `1.8.2`.

License: GPL-3.0-or-later.
