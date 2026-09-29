# StreetEasy: Open in Google Maps

## Purpose

Adds an **Open in Google Maps** button to StreetEasy property pages and a compact **Map** button beside listings on search and recommendation pages.

On a property page, the script uses StreetEasy's exact map coordinates when they are available. It falls back to the building's full postal address. Card buttons use the street address and neighborhood shown by StreetEasy.

## Supported pages

- `https://streeteasy.com/building/*`
- `https://streeteasy.com/property/*`
- `https://streeteasy.com/for-sale/*`
- `https://streeteasy.com/for-rent/*`
- The same paths on `www.streeteasy.com`

## Permissions and privacy

The script uses no privileged userscript APIs and makes no background network requests. When you click a button, your browser sends the displayed address or StreetEasy's map coordinates to Google Maps.

## Testing notes

- [ ] Open a current sale listing and confirm the fixed button opens the listing's exact building coordinates in a new Google Maps tab.
- [ ] Confirm a second button appears beside the full address under **About the building**.
- [ ] Open a current rental listing and repeat the checks.
- [ ] Open sale and rental result pages and confirm each address has one **Map** button.
- [ ] Confirm result-page buttons include the displayed neighborhood or city in the Google Maps query.
- [ ] Load more results or navigate within StreetEasy and confirm newly rendered listings receive buttons without duplicates.
- [ ] Confirm the script adds no button when it cannot identify a listing address.

## Greasy Fork status

- Status: draft
- Listing: pending
- Raw source: [GitHub raw URL](https://raw.githubusercontent.com/austinpresley/tampermonkey-scripts/main/scripts/streeteasy-google-maps/streeteasy-google-maps.user.js)

Do not mark this script published until its Greasy Fork listing confirms publication.
