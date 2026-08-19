# Pinterest Board Image Downloader

## Purpose

Provides a control panel for scanning Pinterest boards, optionally scrolling to load more pins, and downloading collected images with persistent per-board numbering.

## Supported pages

- `https://www.pinterest.com/*/*`
- Connects only to `i.pinimg.com` for image downloads.

## Testing notes

- [ ] Confirm page-only scanning collects visible board images without duplicates.
- [ ] Confirm scan-and-scroll stops when no more pins load.
- [ ] Confirm Stop interrupts scanning and downloading safely.
- [ ] Confirm Reset and Reset numbering affect only the intended board state.
- [ ] Check browser permission handling for multiple downloads.

## Greasy Fork status

- Status: published; GitHub source synchronization pending configuration.
- Listing: [Greasy Fork script 563977](https://greasyfork.org/en/scripts/563977-pinterest-board-image-downloader)
- Raw GitHub source: [main branch](https://raw.githubusercontent.com/austinpresley/tampermonkey-scripts/main/scripts/pinterest-board-image-downloader/pinterest-board-image-downloader.user.js)
- Imported Greasy Fork version: `2.1.1`; repository migration version: `2.1.2`.

License: GPL-3.0-or-later.
