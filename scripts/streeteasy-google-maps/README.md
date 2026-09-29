# StreetEasy: Open in Google Maps

## Purpose

Adds an **Open in Google Maps** button to StreetEasy property pages. The button sits with StreetEasy's listing actions and matches the site's type, color, size, and square-cornered controls.

The Google Maps URL contains the written street address, city, state, and ZIP code shown under **About the building**. It never substitutes latitude and longitude coordinates.

## Supported pages

- `https://streeteasy.com/building/*`
- `https://streeteasy.com/property/*`
- The same paths on `www.streeteasy.com`

## Permissions and privacy

The script uses no privileged userscript APIs and makes no background network requests. When you click the button, your browser sends the displayed address to Google Maps.

## Testing notes

- [ ] Open a current sale listing and confirm one **Open in Google Maps** button appears below the main contact action.
- [ ] Confirm the button matches StreetEasy's secondary button style and does not float over the page.
- [ ] Confirm the Google Maps URL contains the written street address rather than coordinates.
- [ ] Open a current rental listing and repeat the checks.
- [ ] Confirm search results and recommendation cards do not receive **Map** buttons.
- [ ] Navigate between listings and confirm the button updates without creating duplicates.
- [ ] Confirm the script adds no button when it cannot identify a listing address.

## Greasy Fork status

- Status: draft
- Listing: pending
- Raw source: [GitHub raw URL](https://raw.githubusercontent.com/austinpresley/tampermonkey-scripts/main/scripts/streeteasy-google-maps/streeteasy-google-maps.user.js)

Do not mark this script published until its Greasy Fork listing confirms publication.
