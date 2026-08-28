# Facebook Marketplace: Saved items in sidebar

## Purpose

Adds a Saved items shortcut to the Facebook Marketplace sidebar on desktop. The shortcut opens Facebook's saved Marketplace products page.

The script places the shortcut below Selling when that row is present. Otherwise, it places the shortcut above Browse all. On search-results pages that omit both rows, it places the shortcut below Create new listing. It copies the neighboring row's styles so it follows Facebook's current theme without loading outside code.

## Supported pages

- `https://www.facebook.com/marketplace/*`

## Testing notes

- [ ] Open Marketplace on desktop and confirm Saved items appears directly below Selling.
- [ ] If the Selling row is unavailable, confirm Saved items appears directly above Browse all.
- [ ] On a Marketplace search-results page, confirm Saved items appears directly below Create new listing.
- [ ] Click Saved items and confirm Facebook opens `/saved/?dashboard_section=PRODUCTS`.
- [ ] Move between Marketplace routes and confirm the shortcut returns after Facebook redraws the sidebar without creating duplicates.
- [ ] Check the row and bookmark icon in both light and dark mode.
- [ ] Narrow the window and confirm the script does not add a misplaced shortcut to the mobile navigation.

## Permissions and privacy

The script runs only on `https://www.facebook.com/marketplace/*`. It does not request userscript grants, send data anywhere, or load remote code.

## Greasy Fork status

- Status: draft
- Listing: pending
- Raw source: [GitHub raw URL](https://raw.githubusercontent.com/austinpresley/tampermonkey-scripts/main/scripts/facebook-marketplace-saved-sidebar/facebook-marketplace-saved-sidebar.user.js)

Do not mark this script published until its Greasy Fork listing confirms publication.
