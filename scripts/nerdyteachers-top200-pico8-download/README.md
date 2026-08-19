# NerdyTeachers Top200: Add PICO-8 cart download links

## Purpose

Adds a per-game **Download cart** action to the NerdyTeachers PICO-8 Top 200 list. It fetches each linked Lexaloffle page, finds its `.p8.png` cart, caches the result, and downloads the cart through Tampermonkey.

## Supported pages

- `https://nerdyteachers.com/PICO-8/Games/Top200/*`
- Connects only to `lexaloffle.com` and `www.lexaloffle.com` for cart discovery.

## Testing notes

- [ ] Confirm download actions appear on game tiles.
- [ ] Confirm a Lexaloffle cart URL is fetched and cached.
- [ ] Confirm a cart downloads without opening an unrelated page.
- [ ] Confirm missing or malformed cart pages fail visibly without breaking the list.

## Greasy Fork status

- Status: published; GitHub source synchronization pending configuration.
- Listing: [Greasy Fork script 563795](https://greasyfork.org/en/scripts/563795-nerdyteachers-top200-add-pico-8-cart-download-links)
- Raw GitHub source: [main branch](https://raw.githubusercontent.com/austinpresley/tampermonkey-scripts/main/scripts/nerdyteachers-top200-pico8-download/nerdyteachers-top200-pico8-download.user.js)
- Imported Greasy Fork version: `1.0.3`; repository migration version: `1.0.4`.

License: GPL-3.0-or-later.
