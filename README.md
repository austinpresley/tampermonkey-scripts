# Austin Presley's Userscripts

[![Validate userscripts](https://github.com/austinpresley/tampermonkey-scripts/actions/workflows/validate-userscripts.yml/badge.svg)](https://github.com/austinpresley/tampermonkey-scripts/actions/workflows/validate-userscripts.yml)

Small browser enhancements for downloading images, exploring galleries, and improving creative tools. Install them through [Greasy Fork](https://greasyfork.org/en/users/1549077-austinpresley) with Tampermonkey, Violentmonkey, or another compatible userscript manager.

## Available scripts

| Script | Works on | What it does | Install |
| --- | --- | --- | --- |
| [NerdyTeachers Top200: Add PICO-8 cart download links](scripts/nerdyteachers-top200-pico8-download/README.md) | NerdyTeachers / Lexaloffle | Adds a direct cart download action to every game in the PICO-8 Top 200 list. | [Greasy Fork](https://greasyfork.org/en/scripts/563795-nerdyteachers-top200-add-pico-8-cart-download-links) |
| [Google Slides: Open/Download selected images](scripts/google-slides-image-actions/README.md) | Google Slides | Opens or downloads one or more selected slide images from the right-click menu. | [Greasy Fork](https://greasyfork.org/en/scripts/559190-google-slides-open-download-selected-images) |
| [Pinterest Board Image Downloader](scripts/pinterest-board-image-downloader/README.md) | Pinterest | Scans a board, optionally loads more pins, and downloads the collected images. | [Greasy Fork](https://greasyfork.org/en/scripts/563977-pinterest-board-image-downloader) |
| [Depop Gallery Zoom](scripts/depop-gallery-zoom/README.md) | Depop | Adds a full-screen gallery with zoom, pan, thumbnails, keyboard controls, and touch gestures. | [Greasy Fork](https://greasyfork.org/en/scripts/591977-depop-gallery-zoom) |

## Install a script

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open a script's Greasy Fork link in the table above.
3. Choose **Install this script**, review the requested site access and permissions, then confirm the installation.

Updates are delivered through Greasy Fork and your userscript manager. You do not need to download files from this repository manually.

## Privacy and permissions

The scripts run in your browser and request only the page access and browser capabilities needed for their features. Each script's linked README documents its supported sites, external connections, and manual testing notes. The source is readable and unminified.

## Help and feedback

If a script stops working or you have an idea, [open a GitHub issue](https://github.com/austinpresley/tampermonkey-scripts/issues). Include the script name, affected page, browser, userscript manager, and steps to reproduce the problem.

## Source and licenses

Source code lives under [`scripts/`](scripts/). Each userscript's metadata header and README state its license; repository tooling and scripts marked MIT are covered by the root [MIT license](LICENSE).

Repository development and release details are kept in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
