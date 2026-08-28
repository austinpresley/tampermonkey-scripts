# Facebook Marketplace Buyer Workspace

## Purpose

Facebook Marketplace Buyer Workspace adds one buyer-focused control panel to Marketplace. It helps you narrow loaded results, keep track of listings, move between item pages, and reach Facebook's Saved products without adding seller tools or automating account actions.

The interface follows Facebook's spacing, colors, rounded controls, and light or dark theme where practical. It starts as a compact row in Marketplace's scrollable sidebar and expands there only when you ask for the controls.

## Buyer-only scope

The script works with listings that Facebook has already shown in your browser. It does not create, renew, relist, edit, publish, mark sold, or delete listings. It does not send messages, archive chats, scrape the private Marketplace API, or bypass Facebook authentication.

Supported routes include:

- Marketplace home and browse pages under `https://www.facebook.com/marketplace/*`
- Marketplace search results
- Marketplace category results
- Marketplace item pages
- Facebook's saved-products pages under `https://www.facebook.com/saved/*`

## Workspace controls

### Result filters

- Search loaded cards by plain text. Optional text-matching settings support plain-language AND / OR rules and advanced regular expressions.
- Filter against listing text without changing Facebook's search query.
- Exclude unwanted words or phrases with a separate comma- or line-separated list.
- Set local minimum and maximum prices for cards whose displayed dollar price can be read. Cards without a recognized price fail open and remain reviewable.
- Keep listings from named locations with an allow list, and reject unwanted locations with a block list. A block match takes priority over an allow match.
- Review all, new-this-session, previously seen, unreviewed, Interested, Later, Pass, or Favorite listings without deleting other saved buyer states.
- Dim Sponsored and Ships to you results by default, with a reason attached to each affected card.
- Dim text and location nonmatches instead of removing them. Only the explicit Hide from results action conceals a card.
- Include listings hidden by me makes concealed cards reviewable again without deleting their saved state.
- See the current visible and filtered result counts plus the minimum, maximum, and median of recognized loaded prices.

AND / OR matching accepts the words `AND` and `OR`, parentheses for groups, and quotation marks for a phrase. Existing saved views that use `+` for AND or `|` for OR still work. Adjacent terms also act as AND. Regular expressions are case-insensitive and limited to 160 characters. An invalid or unsafe expression leaves the results visible and shows an error instead of dimming the grid.

### Listing organization

Each recognized listing has an always-visible Buyer status menu for Unreviewed, Interested, Later, or Pass, plus a Favorite button. More buyer actions opens an overlay for a private note of up to 500 characters and Hide from results. The overlay does not resize the card. The script saves these choices by Facebook listing ID and reapplies them when the same card returns. Turn on Include listings hidden by me in More buyer filters to review or unhide a concealed card.

### Result navigation

Every recognized result gets an Open control that uses a clean Marketplace item URL in a new tab. On an item page, Previous and Next move through the listing cards already loaded in the originating result page. The counter shows the current position in that captured set, and Back to results returns to the captured search or category URL. Arrow Left and Arrow Right provide the same Previous and Next controls from the keyboard.

Keyboard navigation is disabled while focus is in an input, text area, select menu, or editable field.

### Facebook search controls

The workspace can set Facebook's sort order to Best match, Newest first, Nearest first, Price low to high, or Price high to low. Listed within offers Any time, 1, 3, 7, 14, or 30 days. Delivery method offers Any, Local pickup, or Shipping. Item condition offers Any, New, Used like new, Used good, or Used fair. Apply search filters changes only `sortBy`, `daysSinceListed`, `deliveryMethod`, and `itemCondition`; Clear URL controls removes only those four parameters.

Changing these controls can reload or navigate the results because Facebook, rather than the script, performs the search.

### Saved products

Saved items is integrated into this workspace. The script reuses Facebook's native Marketplace Saved row when it is present and adds a native-styled fallback shortcut only when needed. If the normal workspace insertion point is unavailable, a Buyer workspace launcher keeps the controls reachable. On Facebook's saved-products page, Back to Marketplace returns to the Marketplace home page. Other Facebook Saved sections are outside the script's scope.

### Saved buyer views

Name and save up to 12 buyer views. Each view keeps the current Marketplace search or category URL together with its text syntax, include and exclude terms, price bounds, buyer-state filter, location lists, and Sponsored or shipping preferences. Loading a view restores those local filters and returns to its captured Marketplace URL. A view with the same name updates the existing entry instead of creating a duplicate.

### Local data controls

- Export settings, filters, saved buyer views, listing states, notes, and the last captured result order as JSON. The script downloads a file where the browser supports it and provides a copy prompt as a fallback.
- Import a workspace JSON backup by pasting it into the import prompt. The script validates the whole backup before replacing current data.
- Clear listing decisions and notes without resetting filters, saved buyer views, or seen history.
- Forget seen history without clearing listing decisions or other settings.
- Reset the workspace only after confirmation.
- Reject an invalid import without replacing the current data.

## Privacy, storage, and permissions

The script requests page access only for `www.facebook.com/marketplace/*` and `www.facebook.com/saved/*`. Its userscript grants read, write, and remove workspace records in userscript-manager storage. It loads no remote executable code and sends no workspace data to a third party.

Settings, filters, saved buyer views, seen listing IDs, states, notes, and navigation context stay in the userscript manager's local storage. Export creates a local JSON copy that can contain listing IDs, your notes, and captured Marketplace URLs. Treat that file as personal data. Removing the script's storage, using private browsing, or changing browser profiles can remove the workspace unless you exported a backup.

Storage is bounded. The workspace keeps up to 2,000 nonempty listing records, 5,000 seen listing IDs, and 12 saved buyer views. Touching a listing decision or note moves that record to the newest end before old records are pruned.

Facebook still receives its normal page requests. Applying URL controls or opening a listing behaves like using Facebook's own interface.

## Limitations

- Facebook changes its page structure often. The script fails open when it cannot identify a card, which means an uncertain card stays visible.
- Card filters and navigation cover results loaded into the page. Scroll to load more results before expecting them in counts or Previous and Next navigation.
- New this session means the listing ID was not in local seen history when the userscript started on that page. Reloading starts a new session.
- Sponsored, delivery, and location signals depend on text and attributes Facebook places in the page. Language changes or missing labels can reduce detection.
- Location lists compare visible place text. They do not calculate road distance or contact a geocoding service.
- Local price filters and statistics use the first recognizable dollar price displayed on each card. Negotiable, free, trade-only, or localized non-dollar prices remain visible unless another filter matches them.
- Facebook controls which sort and recency URL parameters it accepts. Unsupported combinations may be ignored or normalized by Facebook.
- The layout targets the current desktop and responsive web interface. Facebook's dedicated mobile apps do not run userscripts.

## Manual test checklist

### Validation performed for 1.0.1

- `npm test` passes the repository validator, version check, syntax check, and 33 buyer-workspace behavior tests.
- A signed-in Facebook desktop session at 1280 by 800 was checked on Marketplace home, a Marketplace search, and Saved products in dark mode.
- The focused 1.0.1 live check recognized 20 current div-based cards and dimmed all eight loaded Ships to you cards. Turning the option off restored them and turning it back on dimmed them again.
- The live card toolbar stayed at the same 439.07-pixel card height after changing Buyer status, opening More buyer actions, and toggling Favorite. Hide, Include listings hidden by me, and Unhide were also exercised end to end.
- Dark-mode headings, field labels, inputs, toolbar controls, notes, reasons, and help text resolved to Facebook's current light text colors on its dark surfaces.
- Earlier live Marketplace checks covered navigation-region discovery, compact and expanded panel dimensions, duplicate-free controls, price parsing and filtering, saved-view persistence through userscript storage mocks, delivery and condition URL synchronization, and zero uncaught page errors.
- The live Saved-products check confirmed one 360 by 52 Back to Marketplace row and no leaked workspace or card controls.
- The shared Facebook page was reloaded after browser checks, so injected test UI and in-memory test data were removed.

The remaining checklist is intentionally retained for cross-device userscript-manager acceptance and future Facebook regressions.

### Setup and startup

- [ ] Install the script in Tampermonkey or Violentmonkey and confirm it reports no syntax or permission errors.
- [ ] Confirm the workspace appears once on a supported route and never duplicates after several page mutations.
- [ ] Confirm no workspace UI appears on Facebook routes outside Marketplace and Saved.
- [ ] Collapse and expand the workspace, reload, and confirm the saved panel state returns.
- [ ] Disable the script and confirm Facebook returns to its unmodified behavior.

### Light, dark, and responsive layout

- [ ] Test Facebook in light mode. Check text contrast, borders, inputs, buttons, focus rings, selected states, and filtered-card captions.
- [ ] Test Facebook in dark mode. Check the same controls and confirm no fixed light backgrounds remain.
- [ ] Switch themes without reloading and confirm the workspace follows the new theme.
- [ ] Test a wide desktop window and confirm the panel does not cover Marketplace navigation or result cards.
- [ ] Test a narrow browser window and confirm controls wrap or collapse without horizontal page scrolling.
- [ ] Zoom the browser to 200 percent and confirm every control remains reachable by keyboard and pointer.
- [ ] Confirm long queries, location names, notes, and validation messages do not overflow the panel or cards.

### Routes and SPA navigation

- [ ] Open Marketplace home and confirm the Saved items shortcut and Buyer workspace launcher appear only where needed and never duplicate.
- [ ] Open a text search and confirm newly loaded cards receive filters and listing controls.
- [ ] Open a category page and confirm the same behavior.
- [ ] Open an item page from the grid and confirm Previous, Next, and the position counter appear when navigation context exists.
- [ ] Open an item page directly in a new tab and confirm the script handles missing result context without an error.
- [ ] Open Facebook's saved-products page and confirm Back to Marketplace appears once.
- [ ] Move among home, search, category, item, and saved pages through Facebook links without a full reload. Confirm controls are removed, inserted, and refreshed for the active route.
- [ ] Use browser Back and Forward across those routes. Confirm the URL, page content, filters, and navigation controls stay synchronized.
- [ ] Scroll until Facebook loads another batch of cards and confirm counts and controls update without rescanning loops or noticeable input lag.

### Text and listing filters

- [ ] Enter mixed-case plain text and confirm matching is case-insensitive.
- [ ] Test plain-language AND / OR matching and nested groups with parentheses. Confirm legacy `+` and `|` saved filters still work.
- [ ] Test adjacent AND / OR terms and a quoted phrase.
- [ ] Test an invalid AND / OR expression and confirm the grid remains visible with a useful error.
- [ ] Test a valid regular expression and confirm expected cards match.
- [ ] Test an invalid expression, an expression over 160 characters, and a nested-repetition expression. Confirm validation prevents a broken or frozen grid.
- [ ] Toggle Sponsored and Ships to you filtering one at a time. Confirm each dims the right cards with the correct reason.
- [ ] Add and remove allowed and blocked location terms using both new lines and commas. Confirm matching is case-insensitive, a block match takes priority, and an empty entry never matches.
- [ ] Add excluded terms and minimum or maximum prices. Confirm unknown prices remain visible and an inverted price range fails open with an error.
- [ ] Switch among All, New this session, Seen before, Unreviewed, Interested, Later, Pass, and Favorites and confirm nonmatching states are dimmed without clearing data.
- [ ] Use Hide from results, turn on Include listings hidden by me, and confirm the card can always be recovered with Unhide.
- [ ] Combine text, location, delivery, ad, and hidden-state filters. Confirm reasons and visible or filtered counts remain correct.
- [ ] Clear the query and location filters and confirm all eligible cards return without losing saved states or notes.

### Listing states and notes

- [ ] Set separate listings to Interested, Later, and Pass. Confirm each Buyer status is distinct and readable in both themes.
- [ ] Change a listing from one main state to another and confirm the old state clears.
- [ ] Toggle Favorite and Hidden independently, including on a listing that already has a main state.
- [ ] Hide a listing, reveal it, and restore it without clearing unrelated records.
- [ ] Add, edit, and remove a note. Test an empty note and the 500-character limit.
- [ ] Reload and revisit the same listing through a different Marketplace route. Confirm its state and note follow its listing ID.
- [ ] Confirm listing controls do not activate the underlying card link when clicked.
- [ ] Confirm keyboard focus can reach every state and note control and that screen-reader names describe their actions.
- [ ] Change Buyer status, toggle Favorite, and open More buyer actions. Confirm the card does not resize or move.

### Navigation and links

- [ ] Open a middle listing from a loaded grid. Confirm Previous and Next open the adjacent loaded listings and update the counter.
- [ ] Test the first and last listing and confirm the unavailable direction is disabled.
- [ ] Test Arrow Left and Arrow Right and confirm they do nothing while typing in a field.
- [ ] Use browser Back after moving through listings and confirm the originating results remain reachable.
- [ ] Use a card's Open control and confirm it opens a canonical item URL in a new tab without `ref` or tracking parameters.
- [ ] Middle-click, Command-click or Control-click, and use Open link in new tab on Facebook's original card link. Confirm the script preserves each browser action.
- [ ] Use Back to results on an item page and confirm it opens the captured search or category URL.
- [ ] Load more cards on the result page and confirm navigation deduplicates listing IDs.

### Facebook URL controls

- [ ] Apply Best match, Newest first, Nearest first, Price low to high, and Price high to low. Confirm the expected `sortBy` value and selected control survive the navigation.
- [ ] Apply Any time, 1, 3, 7, 14, and 30 days. Confirm the expected `daysSinceListed` value and unrelated URL parameters remain unchanged.
- [ ] Apply and clear delivery method and item condition. Confirm the selected values match Facebook's native filters.
- [ ] Clear the workspace URL controls and confirm unrelated Facebook search text, category, location, price, and radius parameters remain intact.
- [ ] Use Back and Forward after applying URL controls and confirm the panel reads the active URL rather than stale saved values.

### Import, export, and reset

- [ ] Export after creating settings, filters, states, and notes. Inspect the JSON and confirm it contains no Facebook cookies, login tokens, or page HTML.
- [ ] Confirm export downloads a dated JSON file. Test the copy-prompt fallback in a browser environment without object-URL support.
- [ ] Reset the workspace, import that export, and confirm the workspace restores the supported data.
- [ ] Clear listing decisions and confirm filters, saved views, and seen history remain. Forget seen history and confirm listing decisions remain.
- [ ] Import malformed JSON and a JSON value with the wrong shape. Confirm the script rejects both without changing current data.
- [ ] Save, update, load, and delete a named buyer view. Confirm its captured Marketplace URL and local filter settings return together.
- [ ] Import a backup with unknown fields and confirm the importer ignores or safely preserves them according to the documented format.
- [ ] Start Reset, cancel the confirmation, and confirm nothing changes.
- [ ] Confirm Reset removes settings, navigation context, states, and notes, then returns to documented defaults.

### Regression and failure checks

- [ ] Confirm filtered cards never leave permanent gaps after filters are cleared.
- [ ] Confirm repeated infinite-scroll updates do not add duplicate controls, event handlers, sidebar rows, or style elements.
- [ ] Confirm an unrecognized card stays visible and gets no destructive action.
- [ ] Confirm the browser console has no uncaught errors during typing, scrolling, theme changes, SPA navigation, import, or reset.
- [ ] Confirm the script does not make requests to non-Facebook domains.
- [ ] Run `npm test` from the repository root.

## Greasy Fork status

- Status: draft
- Listing: pending
- Raw source: [GitHub raw URL](https://raw.githubusercontent.com/austinpresley/tampermonkey-scripts/main/scripts/facebook-marketplace-buyer-workspace/facebook-marketplace-buyer-workspace.user.js)

Do not mark this script published until its Greasy Fork listing confirms publication.

License: MIT.
