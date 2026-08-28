# Facebook Marketplace userscript feature inventory

Research date: 2026-08-28

## Scope and method

This inventory covers source-backed userscripts that target Facebook Marketplace or Messenger's Marketplace inbox, plus a small set of adjacent open-source tools with ideas that transfer to a userscript. Searches covered Greasy Fork, GitHub, GitHub Gists, OpenUserJS, Userscripts.Zone, and general web and repository search. A script is included only when its listing, repository, or source was available from the original host. Search-only mirrors and download aggregators were excluded.

The labels used below are:

- **Advertised:** a feature claimed by the author in the listing or README.
- **Verified:** behavior visible in the source code. This is source inspection, not a live Facebook compatibility test.
- **Status:** the latest version or update shown by the primary host. “Current” means the source is still public and was updated recently; it does not guarantee that it works against Facebook's current DOM.

OpenUserJS produced two near-duplicate seller-automation scripts. No source-backed Userscripts.Zone listing survived this pass. That is a search result, not proof that Userscripts.Zone has never carried a Marketplace script.

## Executive take

The strongest foundation is a local-first buyer workspace: composable text and location filters, reversible dim/hide behavior with reasons, persistent per-listing statuses and notes, result navigation, and a settings/data-management panel. The useful ideas are spread across many scripts, but the most complete patterns appear in [Marketplace Filter](https://github.com/ai36/marketplace-filter), [FB - Clean my feeds](https://github.com/Artificial-Sweetener/facebook-clean-my-feeds), [Next/Previous Navigation](https://greasyfork.org/en/scripts/569131-facebook-marketplace-next-previous-navigation), and [FB Marketplace Item Sort](https://greasyfork.org/en/scripts/548233-fb-marketplace-item-sort).

Seller automation is the danger zone. Existing scripts auto-renew, relist, delete, archive, and even publish. Those actions should never auto-start. Any implementation should use explicit selection, a dry run, an exact affected-item count, confirmation, cancellation, conservative rate limits, and an activity log.

## Feature taxonomy and priorities

| Area | Consolidated feature ideas | Best source examples | Priority and design note |
|---|---|---|---|
| Filter language | Plain text, include/exclude terms, Boolean AND/OR/groups, validated regex, separate fields such as title, location, price, and description | [Marketplace Filter](https://github.com/ai36/marketplace-filter), [regex filter](https://greasyfork.org/en/scripts/556725-facebook-marketplace-regex-filter-for-search-results), [Clean my feeds](https://greasyfork.org/en/scripts/552339-fb-clean-my-feeds-6-3-1) | P0. Debounce scans, catch invalid regex, and show exactly why a card matched or failed. |
| Native search controls | Newest, price ascending/descending, recency window, min/max price, local pickup, distance/radius, condition, availability | [Item Sort](https://greasyfork.org/en/scripts/548233-fb-marketplace-item-sort), [MarketplaceLocalListingsOnly](https://github.com/terrypearson/fb-marketplace-local-userscript), [Marketplace Lens](https://github.com/realbcole/marketplace-lens) | P0. Prefer documented URL parameters and preserve every unrelated query parameter. |
| Listing disposition | Good, Bad, Later, hidden, seen, favorite; filters by state; per-item notes; clear/manage stored data | [Marketplace Filter](https://github.com/ai36/marketplace-filter), [FBMP Hider](https://gist.github.com/JarrettR/a4b1ecb12aa8e1982d0f41b6b9886bf3), [Item Hider](https://gist.github.com/ErgEnn/b7dab785aee3b37806ff61875bc5e2df) | P0. Store by normalized listing ID. Supply undo, bulk clear, export, and storage pruning. |
| Card treatment | Hide, dim, blur, outline, reveal on hover, reason caption, tidy collapsed grid | [Clean my feeds](https://greasyfork.org/en/scripts/552339-fb-clean-my-feeds-6-3-1), [Ad Dimmer](https://greasyfork.org/en/scripts/591693-facebook-marketplace-ad-dimmer), [Marketplace Lens](https://github.com/realbcole/marketplace-lens) | P0. Default to reversible dimming, not DOM removal. Let users reveal and inspect every filtered result. |
| Ad and delivery cleanup | Sponsored/ad detection, shipped-item removal, local-only enforcement, price/description blocklists | [Hide Shipped and Sponsored](https://greasyfork.org/en/scripts/433800-hide-shipped-and-sponsored-items-in-facebook-marketplace), [Clean my feeds](https://greasyfork.org/en/scripts/552339-fb-clean-my-feeds-6-3-1), [local-only](https://github.com/dylanarmstrong/userscripts/blob/master/archive/facebook-marketplace-local-only.js) | P0. Use several conservative signals and label the reason. Exact English strings and generated CSS classes are fallback signals only. |
| Location controls | Whitelist/blacklist places, dim distant areas, hide unknown locations, strict radius | [Dim Distant Locations](https://greasyfork.org/en/scripts/485303-facebook-marketplace-dim-distant-locations), [Marketplace Lens](https://github.com/realbcole/marketplace-lens) | P0/P1. Text matching can remain local. External geocoding must be opt-in and disclose the place data sent. |
| Result navigation | Previous/next controls, loaded-position counter, keyboard shortcuts, safe return to results, proper links that open in new tabs | [Next/Previous Navigation](https://greasyfork.org/en/scripts/569131-facebook-marketplace-next-previous-navigation), [Sane links](https://github.com/jaredsohn/userscript/blob/46fcc9811c161584eedc87b49b08a2ee95fae6a0/scripts/1/11923.user.js) | P0. Avoid global History API monkeypatches where possible. Preserve Back and modified-click behavior. |
| Saved-item access | A stable Saved shortcut in the Marketplace sidebar, with duplicate prevention and SPA reinsertion | [Buyer Workspace](../../scripts/facebook-marketplace-buyer-workspace/README.md) | P0. Saved access is integrated into the buyer workspace. It uses Facebook's own Saved route and preserves native sidebar behavior. |
| Freshness | Listing age on cards, relative-age filters, periodic refresh, new-item indicator | [Show Listing Time](https://greasyfork.org/en/scripts/569137-facebook-marketplace-show-listing-time), [MarketplaceFilterLastHour](https://gist.github.com/kofifus/60f19794a828a2f05d915a670716ecd8), [Item Sort](https://greasyfork.org/en/scripts/548233-fb-marketplace-item-sort) | P1. Lazy-fetch only visible cards, cap concurrency, cache results, and make refresh opt-in. |
| Settings and data | Collapsible/draggable panel, local persistence, search history, import/export/reset, multilingual labels, debug reveal/highlight | [Clean my feeds](https://greasyfork.org/en/scripts/552339-fb-clean-my-feeds-6-3-1), [Facebook Enhancer](https://greasyfork.org/en/scripts/537863-facebook-enhancer-v3-32-tweaked), [Marketplace Filter](https://github.com/ai36/marketplace-filter) | P0. One settings surface should own all filters, data retention, and privacy disclosures. |
| Media and analysis | More-image arrows, local price distribution and summary statistics for loaded results | [Marketplace Helper](https://github.com/ksucpea/marketplacehelper), [fbmarketplace](https://github.com/Tophness/fbmarketplace) | P1. Analyze only cards the browser already loaded unless the user explicitly requests more collection. |
| Saved searches and alerts | Saved query presets, multi-search rotation, deduped new-result alerts, configurable refresh | [marketplace-rss](https://github.com/regek/facebook-marketplace-rss), [AI Marketplace Monitor](https://github.com/BoPeng/ai-marketplace-monitor) | P1/P2. Start with local browser notifications. Do not send listing content to third parties by default. |
| Seller workspace | Master listing, per-market overrides, listing status, published URL, React-safe field fill, condition/category/delivery presets | [Cross-Market](https://github.com/zoltan-dulac/cross-market), [FBM Autofill](https://github.com/ryanclanigan/TampermonkeyScripts/blob/master/FBMAutofill.js) | P1. Fill fields only after a user action and stop before Next, Publish, or photo upload. |
| Seller bulk actions | Renew, relist, update, archive, delete sold/out-of-stock, select by text or metrics, progress and stop controls | [Renew/Relist All](https://greasyfork.org/en/scripts/544689-fb-marketplace-renew-relist-all), [Listing Manager](https://greasyfork.org/en/scripts/541418-fbmp-listing-manager), [Archive Chats](https://github.com/karimjaouhar/messenger-marketplace-auto-bulk-archive) | P2, guarded. Require selection, preview, dry run, confirmation, conservative rate limits, cancellation, and a local audit log. Never auto-start. |
| Focus and guest modes | Marketplace-only navigation, hide unrelated navigation, remove guest login obstruction | [Absolute Redirect](https://greasyfork.org/en/scripts/568510-facebook-marketplace-absolute-redirect), [Marketplace Only](https://github.com/melledijkstra/ducttape/blob/e5c4e414b0c71c581e3b06dd19f4b8444353aca1/tampermonkey/facebook-marketplace-only.js), [Overlay Remover](https://greasyfork.org/en/scripts/530191-facebook-marketplace-overlay-remover) | P2. Make this optional. Use explicit selectors, not blanket removal of large high-z-index elements or global redirects. |

## Greasy Fork buyer and interface scripts

### Hide Shipped and Sponsored Items in Facebook Marketplace

- **Status:** v1.0.6, updated 2021-12-04, MIT. Public but old, with multiple reports that it no longer works.
- **Advertised:** hides sponsored and shipped results.
- **Verified:** observes dynamically added results and removes or hides cards using redirect-link, non-item-link, seller-icon, “Sponsored,” and “Ships to you” heuristics. It skips item detail pages. The selectors, link patterns, and English labels are brittle, and false positives are possible. [Listing and source](https://greasyfork.org/en/scripts/433800-hide-shipped-and-sponsored-items-in-facebook-marketplace/code)

### Remove “Ship to you” FB marketplace listings

- **Status:** v1.0.1, updated 2022-08-22. No license shown.
- **Advertised:** removes shipped Marketplace items.
- **Verified:** adds a Filter button beside the Marketplace heading and removes currently visible anchors containing “Ships to you” when clicked. It does not continuously filter new cards. It loads executable jQuery from a CDN and depends on generated classes and English text. [Listing and source](https://greasyfork.org/en/scripts/448178-remove-ship-to-you-fb-marketplace-listings/code)

### Remove Facebook Marketplace Ads

- **Status:** v0.5, updated 2023-08-21, MIT. Public, with a bad user rating.
- **Advertised:** removes Marketplace ads.
- **Verified:** once per second it dims cards without a Marketplace item link and attempts to detect “Ships to you” and “Sponsored.” The code calls the nonexistent `String.contains`, so the text checks likely throw before completing. The reusable idea is dimming with a timer; the implementation is not a sound base. [Listing and source](https://greasyfork.org/en/scripts/455499-remove-facebook-marketplace-ads/code)

### Facebook Hide Marketplace Deals

- **Status:** v1.0.2, updated 2026-03-31, MIT.
- **Advertised:** hides sponsored deals in Marketplace search.
- **Verified:** a mutation observer removes the parent card of any link whose URL contains `tracking`, including when `href` changes. The current update date is encouraging, but the broad tracking-link test can remove legitimate items. [Listing and source](https://greasyfork.org/en/scripts/404280-facebook-hide-marketplace-deals/code)

### Facebook Marketplace Ad Dimmer

- **Status:** v1.1, updated 2026-08-17, MIT.
- **Advertised:** dims ads to 50 percent opacity.
- **Verified:** detects an exact cleaned English “Ad” badge, dims the card to 10 percent, restores it on hover, and re-dims it on mouse leave. It uses a debounced observer plus a two-second fallback scan. The advertised 50 percent and coded 10 percent values disagree. [Listing and source](https://greasyfork.org/en/scripts/591693-facebook-marketplace-ad-dimmer/code)

### Facebook - Hides Suggested and Sponsored Posts

- **Status:** v0.6.1, updated 2021-11-01. No license shown.
- **Advertised:** hides suggested and sponsored content across Facebook, including Marketplace ads.
- **Verified:** on Marketplace it hides cards containing `/ads/` links and a sponsored-ads heading; elsewhere it polls and scans on scroll. It loads executable jQuery from Google and uses English labels and generated classes. [Listing and source](https://greasyfork.org/en/scripts/432516-facebook-hides-suggested-and-sponsored-posts/code)

### FB - Clean my feeds, versions 5 and 6

- **Status:** [v5.02](https://greasyfork.org/en/scripts/431970-fb-clean-my-feeds-5-02), updated 2024-11-02, MIT; [v6.3.1](https://greasyfork.org/en/scripts/552339-fb-clean-my-feeds-6-3-1), updated 2026-07-06, GPL-3.0-only. The v6 repository identifies zbluebugz's v5 as its origin, so these are one continued family, not two independent feature concepts.
- **Advertised and verified:** optionally hides Marketplace sponsored cards; filters by configurable price text and description text, with optional regex; covers normal feeds, category/search results, related items on detail pages, and SPA updates. The broader framework supplies a local multilingual settings panel, dark mode, import/export/reset, reason captions, configurable colors, and debug highlight/reveal modes. [v6 source repository](https://github.com/Artificial-Sweetener/facebook-clean-my-feeds)

### Facebook Marketplace Overlay Remover

- **Status:** v0.1, updated 2025-03-18, MIT.
- **Advertised:** restores guest access by removing blocking overlays.
- **Verified:** removes any fixed or absolutely positioned element covering more than half the viewport with a z-index over 100, and rescans the entire DOM on mutations. It does not bypass authentication or restore server-hidden data. The heuristic can remove legitimate filters, dialogs, viewers, and safety prompts. [Listing and source](https://greasyfork.org/en/scripts/530191-facebook-marketplace-overlay-remover/code)

### Facebook Login Bypass

- **Status:** v4.0, updated 2025-05-28, MIT. Low listing score at research time.
- **Advertised:** prevents Facebook's login prompt from blocking Marketplace and other public pages.
- **Verified:** removes a generated-class container containing the exact English text “See more on Facebook” and restores page scrolling. It is a prompt remover, not an authentication bypass. [Listing and source](https://greasyfork.org/en/scripts/537571-facebook-login-bypass/code)

### Facebook Marketplace Absolute Redirect

- **Status:** v3.0, updated 2026-03-05, MIT. Listing author and source `@author` differ.
- **Advertised and verified:** makes Facebook act as a Marketplace kiosk by redirecting non-safelisted Facebook routes back to Marketplace. It intercepts initial load, clicks, `pushState`, `replaceState`, and `popstate`, while allowing item, photo/media, messages, and stories routes. It can disrupt ordinary navigation and browser history. [Listing and source](https://greasyfork.org/en/scripts/568510-facebook-marketplace-absolute-redirect/code)

### Facebook Marketplace regex filter for search results

- **Status:** v1.0, updated 2025-11-23, MIT.
- **Advertised and verified:** adds a regex input below Marketplace search, compiles it case-insensitively, and hides cards whose text does not match after excluding the first price line. Invalid regex disables filtering. It re-inserts and reapplies the control through SPA mutations. It has no persistence or match count, and expensive regex can stall full-page rescans. [Listing and source](https://greasyfork.org/en/scripts/556725-facebook-marketplace-regex-filter-for-search-results/code)

### Facebook Marketplace - Show Listing Time

- **Status:** v1.7, updated 2026-03-10. No license shown.
- **Advertised and verified:** displays listing age on each result card. It fetches every item page with the user's Facebook credentials, parses relative “Listed … in” or aria-label text, shows loading/error states, caches by URL for the session, aborts after ten seconds, and staggers requests by 200 ms. The many authenticated requests can trigger rate limits; parsing also assumes English and some hard-coded currency/location tokens. [Listing and source](https://greasyfork.org/en/scripts/569137-facebook-marketplace-show-listing-time/code)

### Facebook Marketplace Next/Previous Navigation

- **Status:** v2.4, updated 2026-03-10. No license shown.
- **Advertised and verified:** collects unique listing IDs from loaded result cards and adds floating Previous/Next buttons, a position counter, Left/A and Right/D shortcuts, disabled edge states, and SPA handling. It activates the original card link and changes its own detail-to-detail history entries from push to replace so Back returns to results. Navigation covers only cards already loaded, and the History API patch is a compatibility risk. [Listing and source](https://greasyfork.org/en/scripts/569131-facebook-marketplace-next-previous-navigation/code)

### Facebook Marketplace: Dim Distant Locations

- **Status:** v0.7, updated 2025-03-30, MIT.
- **Advertised and verified:** dims cards matching a hard-coded location blacklist to 15 percent opacity and reapplies through mutations. It skips rentals, profiles, seller pages, notifications, and inbox. Users must edit source to change locations, and updates overwrite those changes. [Listing and source](https://greasyfork.org/en/scripts/485303-facebook-marketplace-dim-distant-locations/code)

### FB Marketplace Item Sort

- **Status:** v2025-09-24.2, updated 2025-09-24. No license shown.
- **Advertised and verified:** a floating Chinese-language panel sets Recommended, Distance, Newest, Price low-to-high, or Price high-to-low plus a 1-to-30-day recency window. It updates `sortBy` and `daysSinceListed`, reloads, reads current parameters, persists collapsed state, and hides itself on non-Marketplace and item routes. [Listing and source](https://greasyfork.org/en/scripts/548233-fb-marketplace-item-sort/code)

### FB Marketplace Auto Scroll (Simplified Input)

- **Status:** v1.5, updated 2025-08-01, MIT.
- **Advertised and verified:** on seller listings, a floating panel takes an interval in seconds and distance in ten-pixel units, with Start/Stop smooth scrolling. It has no end detection or saved settings. [Listing and source](https://greasyfork.org/en/scripts/544310-fb-marketplace-auto-scroll-simplified-input/code)

## Greasy Fork seller automation scripts

These are useful as workflow research, not safe defaults. Facebook can change its UI and policies independently, and repeated automated account actions can produce unintended deletions, sales-state changes, or account restrictions.

### AutoBot FBMP Enhanced

- **Status:** v5.8.8, updated 2026-08-23, MIT.
- **Advertised and verified:** auto-starts two seconds after load, locates Indonesian relist and update buckets, clicks “delete and relist” and “update,” uses random delays and cooldowns, supports a 1-to-1000 loop limit and Start/Stop, logs timestamps, closes dialogs, and stops when both buckets reach zero. Locale dependence, auto-start, and high loop limits make it risky. [Listing and source](https://greasyfork.org/en/scripts/540187-autobot-fbmp-enhanced/code)

### Auto Delete Listing

- **Status:** v1.2, updated 2025-07-18, MIT.
- **Advertised:** uses “AI” and stealth behavior to delete listings.
- **Verified:** switches to list view, finds Indonesian zero-click listings, opens each menu, deletes the listing, and selects sold/unsold/no-answer reasons. Its “AI” behavior is random selection from a local response list. The panel supplies count, cooldown, random-delay, reason, Start/Stop, and logs, but no dry run. This is destructive. [Listing and source](https://greasyfork.org/en/scripts/542919-auto-delete-listing/code)

### FBMP Listing Manager

- **Status:** v7.5.0, updated 2026-08-11, MIT. Same author and automation family as AutoBot and Auto Delete Listing.
- **Advertised and verified:** combines a zero-click deletion “Terminator,” batch Delete & Relist, update-from-tips, manual text-matched updates, and auto-scroll. It supplies processed-ID deduplication and highlights, DOM-stability checks, counts, cooldowns, random delays, one Start/Stop control, progress, failure handling, and a bounded log. Its “AI” is a random local response bank, not a model. The script is large, locale-sensitive, and capable of destructive bulk actions. [Listing and source](https://greasyfork.org/en/scripts/541418-fbmp-listing-manager/code)

### FB Marketplace: Renew/Relist All

- **Status:** v3.90, updated 2026-02-16, MIT.
- **Advertised and verified:** adds Renew/Relist All and Clean Sold/OOS controls, scrolls until page height stabilizes, renews, relists, and deletes sold or out-of-stock listings with confirmation. It saves Auto Run and Performance settings; performance mode hides images, video, chat, banners, navigation, and animations. A Tampermonkey Debug Mode performs a dry run with counts. Dry run and target counts are patterns worth reusing, but bulk deletion and auto-run remain high risk. [Listing and source](https://greasyfork.org/en/scripts/544689-fb-marketplace-renew-relist-all/code)

### PERBARUI

- **Status:** v2.8, updated 2026-02-06, MIT.
- **Advertised and verified:** auto-starts, clicks all visible Indonesian “Update” controls with randomized 300-to-1300-ms delays, clicks Done, logs actions, supports Start/Stop, waits up to 90 seconds, then reloads for another batch. Auto-start and repeated reload-driven account actions are unsafe defaults. [Listing and source](https://greasyfork.org/en/scripts/546035-perbarui/code)

## OpenUserJS seller automation scripts

### Fix and Web AutoUpdate BOT FB Marketplace

- **Status:** both are v3.1, MIT, and published by the same author. [Fix AutoUpdate](https://openuserjs.org/scripts/behesty/Fix_AutoUpdate_BOT_FB_Marketplace) targets `www.facebook.com`; [Web AutoUpdate](https://openuserjs.org/scripts/behesty/Web_AutoUpdate_BOT_FB_Marketplace) targets `web.facebook.com`. They are host variants of the same feature set, not independent ideas.
- **Advertised and verified:** both auto-start after two seconds, process Indonesian “delete and relist” and “update” queues, click visible action and Done controls with randomized delays, display a timestamped log and Start/Stop toggle, run up to five cycles, and return to the seller page. They overlap heavily with the newer Greasy Fork AutoBot family and add no safeguards such as target selection, preview, or dry run.

## GitHub and Gist userscripts

### Marketplace Filter

- **Status:** v2.4.1 in source; repository created 2026-07-04 and pushed 2026-07-05. No license file was present at research time.
- **Advertised and verified:** a bottom-left collapsible panel supports case-insensitive terms, `+` AND, `|` OR, and grouped expressions; match count; ten-entry query history; and dynamic cards/SPA navigation. Each listing can carry one persistent Good, Bad, or Later state and a 50-character note. State filters, bad-item dimming with hover reveal, clear-all confirmation, and immediate updates are included. Data stays in Tampermonkey storage and the script has no external network grant. [Repository and source](https://github.com/ai36/marketplace-filter)

### Facebook Marketplace Item Hider

- **Status:** one-revision Gist, updated 2023-10-22.
- **Advertised and verified:** right-clicking prompts to hide a listing, stores its ID in Tampermonkey storage, dims it to 10 percent, and reapplies hiding as cards load. The handler prompts before it knows whether the target is a listing, climbs a fixed six ancestors, and has no unhide, clear, or retention UI. [Gist and source](https://gist.github.com/ErgEnn/b7dab785aee3b37806ff61875bc5e2df)

### FBMP Hider

- **Status:** seven-revision Gist, updated 2024-09-08.
- **Advertised and verified:** adds a Hide control to each result, stores listing-ID timestamps, and re-hides dynamic cards. It has no unhide or pruning workflow, and refreshing a hidden item's timestamp prevents natural expiry. It loads jQuery and `waitForKeyElements.js` as remote executable dependencies. [Gist and source](https://gist.github.com/JarrettR/a4b1ecb12aa8e1982d0f41b6b9886bf3)

### MarketplaceFilterLastHour

- **Status:** six-revision Gist, updated 2023-01-31; instructions and selectors target Facebook's old layout.
- **Advertised and verified:** removes cards whose time labels contain “hours,” “day,” or “week,” leaving very recent results; observes mutations, widens the old layout, and reloads after three minutes. It misses singular “hour,” uses obsolete selectors, and loads jQuery over plain HTTP. [Gist and source](https://gist.github.com/kofifus/60f19794a828a2f05d915a670716ecd8)

### MarketplaceLocalListingsOnly

- **Status:** v0.1, repository last pushed 2022-05-25. The README's install link points to an older owner, suggesting a fork or transfer.
- **Advertised and verified:** adds `deliveryMethod=local_pick_up` without replacing an existing value, preserving the rest of the query, and reloads after ten minutes. It also invokes the URL check for many DOM and `href` mutations. The source remotely loads old jQuery over HTTP and `waitForKeyElements`, although neither is needed by the implementation. [Repository and source](https://github.com/terrypearson/fb-marketplace-local-userscript)

### Facebook Marketplace sort and local-only archive scripts

- **Status:** both live under the explicitly unmaintained `archive/` directory of [dylanarmstrong/userscripts](https://github.com/dylanarmstrong/userscripts). The sort script credits `meinhimmel`; the local-only script credits Dylan Armstrong, so they are separate origins collected in one repository.
- **Verified, sort:** recognizes a fixed English list from “1 hour ago” through “over a week ago,” then reorders old-layout cards by age, location, and description after every scroll. [Sort source](https://github.com/dylanarmstrong/userscripts/blob/master/archive/facebook-marketplace.js)
- **Verified, local-only:** every two seconds hides cards whose deeply nested exact text is “Ships to you.” [Local-only source](https://github.com/dylanarmstrong/userscripts/blob/master/archive/facebook-marketplace-local-only.js)

### Facebook Marketplace: Sane links

- **Status:** v0.1.0 in an old archived userscript collection; the pinned source uses Facebook's retired `classified_` and `listing.php` interface.
- **Advertised and verified:** changes JavaScript-only listing anchors into real `href` links so middle-click and new-tab behavior work. The current code is obsolete, but proper link semantics remain a valuable feature. [Pinned source](https://github.com/jaredsohn/userscript/blob/46fcc9811c161584eedc87b49b08a2ee95fae6a0/scripts/1/11923.user.js)

### Facebook Marketplace Only

- **Status:** v1.1 at the pinned 2025-era commit.
- **Advertised:** hides feeds and distractions so only Marketplace remains.
- **Verified:** outside Marketplace it removes the complementary region and attempts to replace the main region with a notice. The script creates the notice but calls `mainFeed.replaceWith()` without passing it, so the main region is simply removed. On Marketplace, `hideClutter()` is empty. Treat the implementation as broken; retain only the optional focus-mode idea. [Pinned source](https://github.com/melledijkstra/ducttape/blob/e5c4e414b0c71c581e3b06dd19f4b8444353aca1/tampermonkey/facebook-marketplace-only.js)

### FB-MP Archive Chats v2

- **Status:** v2025-06-29, repository pushed 2025-06-29.
- **Advertised:** archives all Marketplace chats, including hundreds after scrolling.
- **Verified:** adds an Archive ALL button, counts currently visible “More options” buttons, asks for confirmation, opens each menu, clicks Archive, waits 100 ms, and reports the requested count. Contrary to the README, the code does not auto-scroll or repeatedly discover newly loaded chats. It also has no mid-run cancel. [Repository and source](https://github.com/karimjaouhar/messenger-marketplace-auto-bulk-archive)

### FBM Autofill and FBM Refresher

- **Status:** v0.3 and v0.2 in [ryanclanigan/TampermonkeyScripts](https://github.com/ryanclanigan/TampermonkeyScripts). Narrow personal workflow scripts.
- **Verified, Autofill:** pasting a description triggers Used-Good condition, Video Games category, title-inferred platform, local pickup and shipping, a $5 shipping rate, Next, and Publish. It includes a React-compatible native value setter and input/change events. Auto-publish makes it consequential and the exact English workflow is brittle. [Autofill source](https://github.com/ryanclanigan/TampermonkeyScripts/blob/master/FBMAutofill.js)
- **Verified, Refresher:** clicks each exact-English Renew control at one-second intervals, reloads when none remain, and also schedules a daily reload. It has no confirmation, selection, stop control, or rate policy. [Refresher source](https://github.com/ryanclanigan/TampermonkeyScripts/blob/master/FBMRefresher.js)

### Cross-Market companion userscript

- **Status:** active MIT repository, created 2026-08-15 and pushed 2026-08-26. This is a local Node dashboard plus a Greasemonkey companion, not a standalone userscript.
- **Advertised and source-backed workflow:** one master listing stores title, price, condition, category, location, tags, description, and local photos; each marketplace can override selected fields. Listings move through Not posted, Draft, Live, Sold, and Removed, with per-market URLs and sale records. The companion fills visible supported Facebook, Kijiji, and Karrot fields only after a user action, leaves existing text unless replacement is enabled, and never clicks Post/Next, uploads photos, or handles CAPTCHA. Local data is served on `127.0.0.1`; no account passwords or cookies are stored. [Repository](https://github.com/zoltan-dulac/cross-market)

## Broad Facebook scripts that only hide Marketplace entry points

These scripts mention Marketplace but do not enhance its listings:

- [Facebook Cleaner v1.16](https://greasyfork.org/en/scripts/409912-facebook-cleaner/code), updated 2020-09-17, includes a setting that hides the Marketplace top-navigation item.
- [Silent Facebook v1.0.4](https://greasyfork.org/en/scripts/422284-silent-facebook/code), updated 2021-10-06, is user CSS that hides Marketplace navigation; commented rules can hide the Marketplace collection and sidebar.
- [Simplify Fb Feed v1.0](https://greasyfork.org/en/scripts/511647-simplify-fb-feed/code), updated 2024-10-06, includes the Marketplace icon in hidden top-bar selectors.
- [Facebook Enhancer v3.32 (Tweaked)](https://greasyfork.org/en/scripts/537863-facebook-enhancer-v3-32-tweaked/code), updated 2025-12-16, can hide Marketplace navigation. Its reusable general framework includes a draggable saved-position panel, import/export/reset, hide/soft-remove/blur/review modes, regex and keyword filters, hotkeys, throttled observation, and custom CSS. Those features are not Marketplace-card-specific.

## Adjacent open-source idea sources

These are not userscripts, so their features should be treated as product research rather than code that can be copied directly.

- [Marketplace Lens](https://github.com/realbcole/marketplace-lens) is a Chrome extension with an in-page filter pill and popup. It combines Facebook URL filters for recency, newest, local-only, and price with client-side location allow/block lists, unknown-location hiding, strict radius, include/exclude keywords, a local price backstop, hidden-count badges, live apply, and collapsed-gap cleanup. It says listing data stays local, but place names can be sent to Open-Meteo and Zippopotam for geocoding.
- [Marketplace Helper](https://github.com/ksucpea/marketplacehelper) is a work-in-progress DevTools extension that collects loaded cards while scrolling, filters/sorts without refresh, summarizes price data, and adds arrows for browsing more listing images.
- [fbmarketplace](https://github.com/Tophness/fbmarketplace) is a desktop/API project with exact, partial, and exclusion filters over title, description, and attributes; multi-level sort; detail and image caching; favorites and wishlists; pagination; a local JSON cache; and a GUI. It uses Facebook's private GraphQL surface, which is unsuitable for a robust userscript foundation.
- [Facebook Marketplace Nationwide](https://github.com/gmoz22/facebook-marketplace-nationwide) generates multiple location searches for supported countries with condition, availability, delivery, day, and sort filters. It is useful inspiration for multi-region saved searches.
- [facebook-marketplace-rss](https://github.com/regek/facebook-marketplace-rss) advertises RSS alerts for new ads using search URLs and hierarchical keyword levels. The transferable feature is a deduplicated saved-search feed.
- [Facebook Marketplace Monitor](https://github.com/Dinura-W/fb-marketplace-monitor) uses Playwright, SQLite deduplication, Claude scoring and reasoning, configurable searches, and ntfy alerts. Listing data and the user's criteria are sent to Anthropic, and browser automation adds account/CAPTCHA risk.
- [AI Marketplace Monitor](https://github.com/BoPeng/ai-marketplace-monitor) advertises multi-search monitoring, price/location/exclusion and seller filters, OpenAI/Claude/DeepSeek/Ollama evaluation, several notification services, a web configuration UI, logs, and repeat-notification levels. Its README explicitly warns about Facebook EULA risk.
- [FB Chat Monitor](https://github.com/JuanHopla/FB-Chat-Monitor) advertises unread Marketplace chat monitoring, manual/automatic/AI-generated response modes, a control UI, and response logs. Full source is restricted, so these claims are not code-verifiable. It requires an OpenAI API key and external processing. Useful local-only derivatives would be an unread queue, canned response drafts, and an activity log.

## Safety, privacy, and licensing findings

1. **Remote executable code is common in old scripts.** The shipped-item filter, feed hider, both persistent hiders, last-hour filter, and local-only redirect use remote jQuery or helper scripts. This repository's rules require primary behavior in the submitted script, so those dependencies must not be copied.
2. **DOM brittleness is the dominant compatibility problem.** Many scripts rely on generated Facebook classes, exact English or Indonesian labels, fixed ancestor counts, and old `data-testid` or Classic Facebook structures. A new enhancer should centralize selectors and text dictionaries, use stable URL/role/aria signals, and fail open when confidence is low.
3. **Local storage still needs management.** Status, notes, hidden IDs, panel state, and query history are generally private to Tampermonkey, but permanent per-ID keys accumulate. Add retention, export, selective clear, and a plain-language data inventory.
4. **Authenticated detail fetching needs a budget.** Show Listing Time makes a Facebook request per card. Any similar feature needs viewport-only work, strict concurrency and timeout limits, caching, exponential backoff, and an off switch.
5. **External geocoding or AI changes the privacy boundary.** Place names sent to geocoders and listing content sent to model providers must be opt-in with an exact disclosure of fields, destination, retention assumptions, and cost.
6. **Bulk mutations need transaction-like safeguards.** Random delays marketed as “stealth” do not make deletion, relisting, renewing, publishing, or archiving safe. Preview the exact targets, require confirmation, make dry run the initial mode, support cancellation, rate-limit, and log results locally.
7. **Licenses are mixed.** MIT is common, but several useful scripts have no declared license, Marketplace Filter has no visible license file, and Clean my feeds v6 is GPL-3.0-only. Ideas and observable behavior can inform a fresh implementation; code reuse requires a compatible license and attribution review.
8. **Misleading names and descriptions need correction.** “Login Bypass” only removes a prompt, “AI” deletion scripts use random choices, Overlay Remover cannot restore protected content, Ad Dimmer's description and opacity differ, and Archive Chats does not implement its README's auto-scroll claim.

## Recommended implementation sequence

### Phase 1: trustworthy buyer core

- Build one SPA-aware card adapter with normalized listing IDs and a debounced mutation pipeline.
- Add Boolean/plain-text filtering, safe regex, shipped/ad/local/location filters, reversible dim/hide modes, reason labels, and active/match counts.
- Add Good/Bad/Later/Hidden states, short notes, undo, a data manager, import/export/reset, and retention controls.
- Keep Saved access integrated as a small module in the shared buyer interface.
- Add proper links and previous/next navigation while preserving modified clicks and Back.

### Phase 2: search and research tools

- Add saved queries/history, URL-backed sort/recency/price/local-pickup controls, listing age with a request budget, and opt-in periodic refresh/new-result indicators.
- Add local price summaries and multi-image navigation for cards already loaded.
- Add location allow/block lists first; offer external strict-radius geocoding only as an explicit integration.

### Phase 3: seller assistance

- Add user-triggered field presets and master-listing data with per-market overrides, status, and published URLs. Stop before consequential navigation or submission.
- If bulk renew/relist/archive/delete is ever added, ship it separately or behind an advanced gate with selection, preview, dry run, confirmation, conservative pacing, cancellation, and audit history. Do not auto-start or claim “stealth.”
