// ==UserScript==
// @name         Facebook Marketplace Buyer Workspace
// @namespace    https://github.com/austinpresley/tampermonkey-scripts
// @version      1.0.1
// @description  Adds buyer filters, listing organization, navigation, and Saved access to Facebook Marketplace.
// @match        https://www.facebook.com/marketplace/*
// @include      https://www.facebook.com/saved/*dashboard_section=PRODUCTS*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/austinpresley/tampermonkey-scripts/tree/main/scripts/facebook-marketplace-buyer-workspace
// @supportURL   https://github.com/austinpresley/tampermonkey-scripts/issues
// ==/UserScript==

(() => {
  'use strict';

  const STARTED_ATTRIBUTE = 'data-fbmw-started';
  const STORAGE_KEY = 'facebook-marketplace-buyer-workspace:v1';
  const DATA_FORMAT = 'facebook-marketplace-buyer-workspace';
  const NOTE_LIMIT = 500;
  const LISTING_RECORD_LIMIT = 2000;
  const SEEN_LISTING_LIMIT = 5000;
  const SAVED_VIEW_LIMIT = 12;
  const SAVED_VIEW_NAME_LIMIT = 60;
  const MANAGED_URL_PARAMETERS = [
    'sortBy',
    'daysSinceListed',
    'deliveryMethod',
    'itemCondition',
  ];
  const SAVED_VIEW_SETTING_KEYS = [
    'query',
    'filterMode',
    'excludedTerms',
    'minimumPrice',
    'maximumPrice',
    'viewState',
    'allowedLocations',
    'blockedLocations',
    'dimSponsored',
    'dimShipping',
  ];

  if (document.documentElement.hasAttribute(STARTED_ATTRIBUTE)) return;
  document.documentElement.setAttribute(STARTED_ATTRIBUTE, 'true');

  const DEFAULT_SETTINGS = Object.freeze({
    query: '',
    filterMode: 'simple',
    excludedTerms: '',
    minimumPrice: '',
    maximumPrice: '',
    viewState: 'all',
    allowedLocations: '',
    blockedLocations: '',
    dimSponsored: true,
    dimShipping: true,
    showHidden: false,
    collapsed: true,
  });

  const workspace = createBuyerWorkspace();
  workspace.start();

  function createBuyerWorkspace() {
    let data = loadData();
    let renderQueued = false;
    let rendering = false;
    let filterError = '';
    let currentItemTargets = null;
    let selectedViewId = '';
    let seenBeforeSession = new Set(Object.keys(data.seen));

    const observer = new MutationObserver((records) => {
      const pageChanged = records.some((record) => {
        const listingAdded = [...record.addedNodes].some(
          (node) =>
            node instanceof Element &&
            (node.matches('a[href*="/marketplace/item/"], [data-fixture-listing-id]') ||
              node.querySelector('a[href*="/marketplace/item/"]')),
        );
        if (listingAdded) return true;
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        return !target?.closest('[data-fbmw-owned]');
      });
      if (pageChanged) queueRender();
    });

    function start() {
      installStyles();
      installEvents();
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      queueRender();
    }

    function queueRender() {
      if (renderQueued) return;
      renderQueued = true;
      queueMicrotask(() => {
        renderQueued = false;
        if (rendering) return;
        rendering = true;
        try {
          render();
        } finally {
          rendering = false;
        }
      });
    }

    function render() {
      const route = getRoute();
      currentItemTargets = null;

      if (route.kind === 'saved') {
        removeMarketplaceInterface();
        restoreCards();
        ensureBackToMarketplace();
        return;
      }

      document.querySelectorAll('[data-fbmw-back-link]').forEach((element) => element.remove());

      if (route.kind === 'item') {
        removeMarketplaceInterface();
        restoreCards();
        renderItemNavigation(route.itemId);
        return;
      }

      document.querySelectorAll('[data-fbmw-item-navigation]').forEach((element) => element.remove());

      if (route.kind !== 'results') {
        removeMarketplaceInterface();
        restoreCards();
        return;
      }

      ensureMarketplaceInterface();
      observeResultContainers();
      const matcher = buildTextMatcher(data.settings.filterMode, data.settings.query);
      filterError = matcher.error;
      const listings = collectListings();
      const counts = renderListings(listings, matcher.matches);
      captureResultOrder(listings);
      rememberSeenListings(listings);
      syncWorkspace(counts);
    }

    function observeResultContainers() {
      const selectors = [
        '[aria-label*="Marketplace results" i]',
        '[role="main"] [role="feed"]',
        'main [role="feed"]',
      ];
      document.querySelectorAll(selectors.join(',')).forEach((container) => {
        observer.observe(container, { childList: true, subtree: true, characterData: true });
      });
    }

    function getRoute() {
      const path = window.location.pathname;
      if (
        path.startsWith('/saved/') &&
        new URL(window.location.href).searchParams.get('dashboard_section') === 'PRODUCTS'
      ) {
        return { kind: 'saved' };
      }

      const itemMatch = path.match(/^\/marketplace\/item\/(\d+)/);
      if (itemMatch) return { kind: 'item', itemId: itemMatch[1] };

      const excluded = [
        /^\/marketplace\/create(?:\/|$)/,
        /^\/marketplace\/you(?:\/|$)/,
      ];
      if (path.startsWith('/marketplace/') && !excluded.some((pattern) => pattern.test(path))) {
        return { kind: 'results' };
      }
      return { kind: 'unsupported' };
    }

    function collectListings() {
      const listings = new Map();
      const previouslyManaged = new Set(document.querySelectorAll('[data-fbmw-card]'));
      const anchors = document.querySelectorAll(
        'a[href*="/marketplace/item/"]:not([data-fbmw-open])',
      );

      for (const anchor of anchors) {
        const id = listingIdFromUrl(anchor.href);
        if (!id) continue;

        const card = findListingCard(anchor);
        if (!card || card.closest('[data-fbmw-workspace], [data-fbmw-item-navigation]')) continue;
        if (!isElementVisible(card) || listings.has(id)) continue;

        const sourceParts = listingSourceParts(card);
        listings.set(id, {
          id,
          card,
          anchor,
          canonicalUrl: canonicalItemUrl(id),
          sourceText: sourceParts.join('\n'),
          signals: listingSignals(sourceParts),
          normalizedLocation: normalizeText(listingLocationText(anchor)),
          price: listingPrice(anchor),
        });
      }

      const selectedCards = new Set([...listings.values()].map((listing) => listing.card));
      for (const card of previouslyManaged) {
        if (!selectedCards.has(card)) restoreCard(card);
      }
      for (const listing of listings.values()) {
        rememberCardPresentation(listing.card);
        listing.card.setAttribute('data-fbmw-card', listing.id);
      }

      return [...listings.values()];
    }

    function findListingCard(anchor) {
      const explicitCard = anchor.closest(
        '[data-fixture-listing-id], article, [role="article"], [role="listitem"]',
      );
      if (explicitCard) return explicitCard;

      const id = listingIdFromUrl(anchor.href);
      if (!id) return null;

      const anchorRectangle = anchor.getBoundingClientRect();
      let card = null;
      let candidate = anchor.parentElement;
      for (let depth = 0; candidate && depth < 12; depth += 1) {
        if (candidate.parentElement?.matches('main, [role="main"]')) break;
        if (isListingCollection(candidate)) break;

        const listingIds = listingIdsWithin(candidate);
        if (listingIds.size !== 1 || !listingIds.has(id)) break;
        if (candidate.querySelector('img') && isCardSized(candidate, anchorRectangle)) {
          card = candidate;
        }
        candidate = candidate.parentElement;
      }
      return card;
    }

    function isListingCollection(element) {
      if (element.matches('main, [role="main"], [role="feed"]')) return true;
      const label = element.getAttribute('aria-label') || '';
      return /marketplace (?:results|listings)|search results/i.test(label);
    }

    function listingIdsWithin(element) {
      const ids = new Set();
      for (const link of element.querySelectorAll(
        'a[href*="/marketplace/item/"]:not([data-fbmw-open])',
      )) {
        const id = listingIdFromUrl(link.href);
        if (id) ids.add(id);
      }
      return ids;
    }

    function isCardSized(element, anchorRectangle) {
      const rectangle = element.getBoundingClientRect();
      if (!rectangle.width || !anchorRectangle.width) return true;
      return rectangle.width <= Math.max(anchorRectangle.width * 1.4, anchorRectangle.width + 64);
    }

    function isElementVisible(element) {
      if (element.getAttribute('data-fbmw-hidden') === 'true') {
        return Boolean(
          element.isConnected &&
          element.getAttribute('data-fbmw-original-hidden') !== 'true' &&
          element.getAttribute('data-fbmw-original-display') !== 'none'
        );
      }
      return Boolean(
        !element.hidden &&
        element.getAttribute('aria-hidden') !== 'true' &&
        getComputedStyle(element).display !== 'none' &&
        element.getClientRects().length > 0
      );
    }

    function rememberCardPresentation(card) {
      if (card.hasAttribute('data-fbmw-original-hidden')) return;
      card.setAttribute('data-fbmw-original-hidden', String(card.hidden));
      card.setAttribute('data-fbmw-original-display', card.style.display);
    }

    function listingSourceParts(card) {
      const parts = [];
      const add = (value) => {
        const text = value?.trim();
        if (text) parts.push(text);
      };

      for (const element of [
        card,
        ...card.querySelectorAll('[aria-label], img[alt], span, [dir="auto"]'),
      ]) {
        if (element.closest('[data-fbmw-owned]')) continue;
        add(element.getAttribute('aria-label'));
        add(element.getAttribute('alt'));
        if (element.matches('span, [dir="auto"]')) add(element.textContent);
      }

      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const parent = walker.currentNode.parentElement;
        if (!parent?.closest('[data-fbmw-owned]')) add(walker.currentNode.nodeValue);
      }

      return [...new Set(parts)];
    }

    function listingSignals(sourceParts) {
      const facts = new Set(sourceParts.map(normalizeText));
      return {
        sponsored: facts.has('sponsored') || facts.has('ad'),
        shipping: [
          'ship to you',
          'ships to you',
          'shipping available',
          'delivery available',
        ].some((fact) => facts.has(fact)),
      };
    }

    function listingLocationText(anchor) {
      const titleLabels = [...anchor.querySelectorAll('img[alt]')]
        .map((image) => normalizeText(image.alt))
        .filter(Boolean);
      const excludedFact = /^(?:sponsored|ad|ships? to you|shipping available|delivery available|just listed|listed today|new listing)$/i;
      const candidates = [...anchor.querySelectorAll('span, [dir="auto"]')]
        .filter((element) => !element.querySelector('span, [dir="auto"]'))
        .map((element) => element.textContent?.trim() || '')
        .filter(Boolean)
        .filter((text) => !/^[$€£]\s*[\d,.]+/.test(text))
        .filter((text) => !excludedFact.test(text))
        .filter((text) => {
          const normalized = normalizeText(text);
          return !titleLabels.some(
            (label) => label === normalized || label.startsWith(`${normalized} in `),
          );
        });
      return [...new Set(candidates)].join('\n');
    }

    function listingPrice(anchor) {
      const priceTexts = [...anchor.querySelectorAll('span, [dir="auto"]')]
        .filter((element) => !element.querySelector('span, [dir="auto"]'))
        .map((element) => element.textContent?.trim() || '');
      for (const text of priceTexts) {
        const match = text.match(/^(?:US\s*)?\$\s*([\d,]+(?:\.\d{1,2})?)/i);
        if (match) return Number(match[1].replaceAll(',', ''));
      }
      return null;
    }

    function renderListings(listings, textMatches) {
      const excludedTerms = termsFromLines(data.settings.excludedTerms);
      const allowedLocations = termsFromLines(data.settings.allowedLocations);
      const blockedLocations = termsFromLines(data.settings.blockedLocations);
      let minimumPrice = nonNegativeNumber(data.settings.minimumPrice);
      let maximumPrice = nonNegativeNumber(data.settings.maximumPrice);
      if (minimumPrice !== null && maximumPrice !== null && minimumPrice > maximumPrice) {
        filterError = [filterError, 'Minimum price cannot exceed maximum price.']
          .filter(Boolean)
          .join(' ');
        minimumPrice = null;
        maximumPrice = null;
      }
      let visible = 0;
      let filtered = 0;

      for (const listing of listings) {
        const record = data.listings[listing.id] || createListingRecord();
        const reasons = [];
        const normalizedSource = normalizeText(listing.sourceText);

        if (textMatches && !textMatches(listing.sourceText)) reasons.push('Does not match text filter');
        const excludedMatch = excludedTerms.find((term) => normalizedSource.includes(term));
        if (excludedMatch) reasons.push(`Excluded text: ${displayTerm(excludedMatch)}`);
        if (listing.price !== null && minimumPrice !== null && listing.price < minimumPrice) {
          reasons.push('Below minimum price');
        }
        if (listing.price !== null && maximumPrice !== null && listing.price > maximumPrice) {
          reasons.push('Above maximum price');
        }
        if (!matchesBuyerState(record, data.settings.viewState, listing.id)) {
          reasons.push('Does not match buyer state');
        }
        if (data.settings.dimSponsored && listing.signals.sponsored) {
          reasons.push('Sponsored');
        }
        if (data.settings.dimShipping && listing.signals.shipping) {
          reasons.push('Ships to you');
        }

        const blockedMatch = blockedLocations.find((term) =>
          listing.normalizedLocation.includes(term),
        );
        if (blockedMatch) {
          reasons.push(`Blocked location: ${displayTerm(blockedMatch)}`);
        } else if (
          allowedLocations.length > 0 &&
          !allowedLocations.some((term) => listing.normalizedLocation.includes(term))
        ) {
          reasons.push('Outside allowed locations');
        }

        const concealed = record.hidden && !data.settings.showHidden;
        if (record.hidden && data.settings.showHidden) reasons.push('Hidden by you');

        ensureListingInterface(listing, record);
        applyCardPresentation(listing.card, concealed, reasons);

        if (concealed || reasons.length > 0) filtered += 1;
        else visible += 1;
      }

      return {
        total: listings.length,
        visible,
        filtered,
        prices: listings.map((listing) => listing.price).filter(Number.isFinite),
      };
    }

    function matchesBuyerState(record, viewState, listingId) {
      if (viewState === 'all') return true;
      if (viewState === 'new') return !seenBeforeSession.has(listingId);
      if (viewState === 'seen') return seenBeforeSession.has(listingId);
      if (viewState === 'unreviewed') {
        return !record.disposition && !record.favorite && !record.hidden && !record.note;
      }
      if (viewState === 'favorites') return record.favorite;
      return record.disposition === viewState;
    }

    function rememberSeenListings(listings) {
      let changed = false;
      const seenAt = Date.now();
      for (const listing of listings) {
        if (data.seen[listing.id]) continue;
        data.seen[listing.id] = seenAt;
        changed = true;
      }
      if (changed) persist();
    }

    function ensureListingInterface(listing, record) {
      let openLink = listing.card.querySelector(
        `:scope > [data-fbmw-open][data-listing-id="${listing.id}"]`,
      );
      if (!openLink) {
        openLink = document.createElement('a');
        openLink.setAttribute('data-fbmw-owned', '');
        openLink.setAttribute('data-fbmw-open', '');
        openLink.dataset.listingId = listing.id;
        openLink.className = 'fbmw-open';
        openLink.target = '_blank';
        openLink.rel = 'noopener noreferrer';
        openLink.textContent = 'Open';
        openLink.setAttribute('aria-label', 'Open listing in new tab');
        listing.card.insertBefore(openLink, listing.card.firstChild);
      }
      openLink.href = listing.canonicalUrl;

      let actions = listing.card.querySelector(
        `:scope > [data-fbmw-listing-actions][data-listing-id="${listing.id}"]`,
      );
      if (!actions) {
        actions = document.createElement('section');
        actions.setAttribute('data-fbmw-owned', '');
        actions.setAttribute('data-fbmw-listing-actions', '');
        actions.dataset.listingId = listing.id;
        actions.className = 'fbmw-listing-actions';
        actions.setAttribute('aria-label', 'Buyer listing controls');
        actions.innerHTML = `
          <div class="fbmw-listing-toolbar" data-fbmw-listing-toolbar>
            <select data-fbmw-disposition aria-label="Buyer status">
              <option value="">Unreviewed</option>
              <option value="interested">Interested</option>
              <option value="later">Later</option>
              <option value="pass">Pass</option>
            </select>
            <button type="button" class="fbmw-favorite" data-listing-action="favorite" aria-label="Favorite listing" aria-pressed="false">☆</button>
            <details class="fbmw-listing-menu">
              <summary aria-label="More buyer actions">•••</summary>
              <div class="fbmw-listing-menu-panel">
                <label class="fbmw-note-label">
                  <span>Private note</span>
                  <input data-fbmw-note aria-label="Private note for listing" maxlength="${NOTE_LIMIT}" placeholder="Add a private note" type="text">
                </label>
                <button type="button" data-listing-action="hidden" aria-pressed="false">Hide from results</button>
              </div>
            </details>
          </div>
          <p class="fbmw-reason" data-fbmw-reason hidden></p>
        `;
        listing.card.append(actions);
      }

      syncListingInterface(actions, record);
    }

    function syncListingInterface(actions, record) {
      const disposition = actions.querySelector('[data-fbmw-disposition]');
      if (document.activeElement !== disposition) disposition.value = record.disposition || '';

      const favorite = actions.querySelector('[data-listing-action="favorite"]');
      favorite.setAttribute('aria-pressed', String(record.favorite));
      setText(favorite, record.favorite ? '★' : '☆');
      favorite.setAttribute(
        'aria-label',
        record.favorite ? 'Remove listing from favorites' : 'Favorite listing',
      );

      const hidden = actions.querySelector('[data-listing-action="hidden"]');
      hidden.setAttribute('aria-pressed', String(record.hidden));
      setText(hidden, record.hidden ? 'Unhide' : 'Hide from results');
      hidden.setAttribute('aria-label', record.hidden ? 'Unhide listing' : 'Hide from results');

      const note = actions.querySelector('[data-fbmw-note]');
      if (document.activeElement !== note && note.value !== record.note) note.value = record.note;
      const menu = actions.querySelector('.fbmw-listing-menu');
      menu.setAttribute('data-has-note', String(Boolean(record.note)));
      menu.querySelector('summary').setAttribute(
        'aria-label',
        record.note ? 'More buyer actions, private note saved' : 'More buyer actions',
      );
    }

    function applyCardPresentation(card, concealed, reasons) {
      const dimmed = !concealed && reasons.length > 0;
      card.hidden = concealed || card.getAttribute('data-fbmw-original-hidden') === 'true';
      card.style.display = concealed
        ? 'none'
        : card.getAttribute('data-fbmw-original-display') || '';
      card.setAttribute('data-fbmw-hidden', String(concealed));
      card.setAttribute('data-fbmw-dimmed', String(dimmed));

      const reason = card.querySelector('[data-fbmw-reason]');
      if (reason) {
        const text = reasons.join(' · ');
        if (reason.textContent !== text) reason.textContent = text;
        reason.hidden = !text;
      }
    }

    function ensureMarketplaceInterface() {
      const sidebar = findSidebar('Marketplace');
      const sidebarContent = findSidebarContent(sidebar);
      ensureSavedLink(sidebarContent);

      let panel = document.querySelector('[data-fbmw-workspace]');
      const launcher = document.querySelector('[data-fbmw-launcher]');

      if (sidebar) {
        if (!panel) panel = createWorkspace();
        panel.removeAttribute('data-fbmw-floating');
        panel.hidden = false;
        if (panel.parentElement !== sidebarContent) sidebarContent.prepend(panel);
        launcher?.remove();
        return;
      }

      if (!panel && !launcher) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('data-fbmw-owned', '');
        button.setAttribute('data-fbmw-launcher', '');
        button.className = 'fbmw-launcher';
        button.textContent = 'Buyer workspace';
        document.body.append(button);
      }
    }

    function ensureSavedLink(sidebar) {
      if (!sidebar) return;
      const nativeLink = sidebar.querySelector(
        'a[href^="/marketplace/you/saved"], a[href*="facebook.com/marketplace/you/saved"]',
      );
      if (nativeLink) {
        nativeLink.setAttribute('data-fbmw-saved-link', 'native');
        sidebar.querySelectorAll('[data-fbmw-saved-link="fallback"]').forEach((link) => link.remove());
        return;
      }
      if (sidebar.querySelector('[data-fbmw-saved-link="fallback"]')) return;
      const link = document.createElement('a');
      link.setAttribute('data-fbmw-owned', '');
      link.setAttribute('data-fbmw-saved-link', 'fallback');
      link.className = 'fbmw-shortcut';
      link.href = '/saved/?dashboard_section=PRODUCTS';
      link.textContent = 'Saved items';

      const nav = sidebar.querySelector('nav') || sidebar;
      const createLink = [...nav.querySelectorAll('a')].find((candidate) =>
        /create new listing/i.test(candidate.textContent || ''),
      );
      if (!createLink) {
        nav.append(link);
        return;
      }

      let reference = createLink;
      while (
        reference.parentElement &&
        reference.parentElement !== nav &&
        reference.parentElement.children.length === 1
      ) {
        reference = reference.parentElement;
      }
      reference.parentElement.insertBefore(link, reference);
    }

    function ensureBackToMarketplace() {
      const sidebar = findSidebar('Saved');
      if (!sidebar || sidebar.querySelector('[data-fbmw-back-link]')) return;
      const link = document.createElement('a');
      link.setAttribute('data-fbmw-owned', '');
      link.setAttribute('data-fbmw-back-link', '');
      link.className = 'fbmw-shortcut';
      link.href = '/marketplace/';
      link.textContent = 'Back to Marketplace';
      (sidebar.querySelector('nav') || sidebar).prepend(link);
    }

    function findSidebar(label) {
      const labelled = document.querySelector(
        `aside[aria-label*="${label}" i], [role="navigation"][aria-label*="${label}" i]`,
      );
      if (labelled) return labelled;

      if (label === 'Marketplace') {
        const search = document.querySelector(
          'input[role="combobox"][aria-label="Search Marketplace"], input[aria-label="Search Marketplace"]',
        );
        const searchRegion = search?.closest('aside, [role="navigation"], [role="complementary"]');
        if (searchRegion) return searchRegion;

        const buyingLink = document.querySelector(
          'a[href^="/marketplace/you/"], a[href*="facebook.com/marketplace/you/"]',
        );
        const buyingRegion = buyingLink?.closest(
          'aside, [role="navigation"], [role="complementary"]',
        );
        if (buyingRegion) return buyingRegion;
      }

      if (label === 'Saved') {
        const productLink = document.querySelector(
          'a[href*="/saved/"][href*="dashboard_section=PRODUCTS"]',
        );
        const savedRegion = productLink?.closest(
          'aside, [role="navigation"], [role="complementary"]',
        );
        if (savedRegion) return savedRegion;
      }

      return [...document.querySelectorAll('aside')].find((aside) =>
        new RegExp(`^${label}$`, 'i').test(aside.querySelector('h1')?.textContent?.trim() || ''),
      );
    }

    function findSidebarContent(sidebar) {
      if (!sidebar) return null;
      const createLink = [...sidebar.querySelectorAll('a')].find((candidate) =>
        /create new listing/i.test(candidate.textContent || ''),
      );
      for (
        let candidate = createLink?.parentElement;
        candidate && candidate !== sidebar;
        candidate = candidate.parentElement
      ) {
        if (['auto', 'scroll'].includes(getComputedStyle(candidate).overflowY)) return candidate;
      }
      return sidebar;
    }

    function createWorkspace() {
      const panel = document.createElement('section');
      panel.setAttribute('data-fbmw-owned', '');
      panel.setAttribute('data-fbmw-workspace', '');
      panel.className = 'fbmw-workspace';
      panel.setAttribute('aria-label', 'Facebook Marketplace Buyer workspace');
      panel.innerHTML = `
        <header class="fbmw-header">
          <h2>Buyer workspace</h2>
          <button type="button" data-workspace-action="collapse" aria-label="Collapse Buyer workspace">−</button>
        </header>
        <div class="fbmw-panel-body" data-fbmw-panel-body>
          <label>
            <span>Search these loaded results</span>
            <input type="search" data-setting="query" aria-label="Filter loaded listings" aria-describedby="fbmw-text-matching-help" autocomplete="off" placeholder="Try a title, location, or detail">
          </label>
          <details class="fbmw-text-matching">
            <summary data-fbmw-text-matching-summary>Text matching: Contains this text</summary>
            <div class="fbmw-detail-body">
              <label>
                <span>Text matching</span>
                <select data-setting="filterMode" aria-label="Text matching">
                  <option value="simple">Contains this text</option>
                  <option value="boolean">Use AND / OR</option>
                  <option value="regex">Regular expression (advanced)</option>
                </select>
              </label>
              <p class="fbmw-help" id="fbmw-text-matching-help" data-fbmw-text-matching-help></p>
            </div>
          </details>
          <p class="fbmw-alert" data-fbmw-filter-error role="alert" hidden></p>
          <p class="fbmw-count" data-fbmw-count aria-live="polite"></p>
          <p class="fbmw-help" data-fbmw-price-summary></p>
          <details>
            <summary>More buyer filters</summary>
            <div class="fbmw-detail-body">
              <label>
                <span>Excluded terms</span>
                <textarea data-setting="excludedTerms" aria-label="Excluded terms" rows="2" placeholder="One per line or comma-separated"></textarea>
              </label>
              <div class="fbmw-two-columns">
                <label>
                  <span>Minimum price</span>
                  <input type="number" min="0" step="1" inputmode="decimal" data-setting="minimumPrice" aria-label="Minimum price" placeholder="No minimum">
                </label>
                <label>
                  <span>Maximum price</span>
                  <input type="number" min="0" step="1" inputmode="decimal" data-setting="maximumPrice" aria-label="Maximum price" placeholder="No maximum">
                </label>
              </div>
            <label>
              <span>Buyer state</span>
              <select data-setting="viewState" aria-label="Buyer state">
                <option value="all">All listings</option>
                <option value="new">New this session</option>
                <option value="seen">Seen before</option>
                <option value="unreviewed">Unreviewed</option>
                <option value="interested">Interested</option>
                <option value="later">Later</option>
                <option value="pass">Pass</option>
                <option value="favorites">Favorites</option>
              </select>
            </label>
            <div class="fbmw-two-columns">
              <label>
                <span>Allowed locations</span>
                <textarea data-setting="allowedLocations" aria-label="Allowed locations" rows="2" placeholder="One per line"></textarea>
              </label>
              <label>
                <span>Blocked locations</span>
                <textarea data-setting="blockedLocations" aria-label="Blocked locations" rows="2" placeholder="One per line"></textarea>
              </label>
            </div>
            <label class="fbmw-check"><input type="checkbox" data-setting="dimSponsored"> Dim Sponsored listings</label>
            <label class="fbmw-check"><input type="checkbox" data-setting="dimShipping"> Dim Ships to you listings</label>
            <label class="fbmw-check"><input type="checkbox" data-setting="showHidden"> Include listings hidden by me</label>
            <p class="fbmw-help">Hide from results removes a card until this is turned on.</p>
            </div>
          </details>
          <details>
            <summary>Facebook search</summary>
            <div class="fbmw-detail-body">
            <label>
              <span>Marketplace sort</span>
              <select data-url-control="sort" aria-label="Marketplace sort">
                <option value="">Best match</option>
                <option value="creation_time_descend">Newest first</option>
                <option value="distance_ascend">Nearest first</option>
                <option value="price_ascend">Price: low to high</option>
                <option value="price_descend">Price: high to low</option>
              </select>
            </label>
            <label>
              <span>Listed within</span>
              <select data-url-control="recency" aria-label="Listed within">
                <option value="">Any time</option>
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </label>
            <label>
              <span>Delivery method</span>
              <select data-url-control="delivery" aria-label="Delivery method">
                <option value="">Any delivery method</option>
                <option value="local_pick_up">Local pickup</option>
                <option value="shipping">Shipping</option>
              </select>
            </label>
            <label>
              <span>Item condition</span>
              <select data-url-control="condition" aria-label="Item condition">
                <option value="">Any condition</option>
                <option value="new">New</option>
                <option value="used_like_new">Used: like new</option>
                <option value="used_good">Used: good</option>
                <option value="used_fair">Used: fair</option>
              </select>
            </label>
            <div class="fbmw-action-row">
              <button type="button" data-workspace-action="apply-url">Apply search filters</button>
              <button type="button" data-workspace-action="clear-url">Clear URL controls</button>
            </div>
            </div>
          </details>
          <details>
            <summary>Saved buyer views</summary>
            <div class="fbmw-detail-body">
            <label>
              <span>Saved view name</span>
              <input type="text" data-fbmw-view-name aria-label="Saved view name" maxlength="${SAVED_VIEW_NAME_LIMIT}" placeholder="Example: Local cameras">
            </label>
            <label>
              <span>Saved buyer views</span>
              <select data-fbmw-view-select aria-label="Saved buyer views"></select>
            </label>
            <div class="fbmw-action-row">
              <button type="button" data-workspace-action="save-view">Save current view</button>
              <button type="button" data-workspace-action="load-view">Load saved view</button>
              <button type="button" data-workspace-action="delete-view">Delete saved view</button>
            </div>
            </div>
          </details>
          <details>
            <summary>Workspace data</summary>
            <div class="fbmw-detail-body">
              <button type="button" data-workspace-action="export">Export buyer data</button>
              <button type="button" data-workspace-action="import">Import buyer data</button>
              <button type="button" data-workspace-action="clear-listings">Clear listing decisions</button>
              <button type="button" data-workspace-action="clear-seen">Forget seen history</button>
              <button type="button" data-workspace-action="reset">Reset buyer workspace data</button>
            </div>
          </details>
          <p class="fbmw-alert" data-fbmw-data-message role="alert" hidden></p>
        </div>
      `;
      return panel;
    }

    function syncWorkspace(counts) {
      const panel = document.querySelector('[data-fbmw-workspace]');
      if (!panel) return;

      for (const control of panel.querySelectorAll('[data-setting]')) {
        const value = data.settings[control.dataset.setting];
        if (control.type === 'checkbox') {
          control.checked = Boolean(value);
        } else if (document.activeElement !== control && control.value !== value) {
          control.value = value;
        }
      }

      const body = panel.querySelector('[data-fbmw-panel-body]');
      body.hidden = data.settings.collapsed;
      const collapse = panel.querySelector('[data-workspace-action="collapse"]');
      collapse.textContent = data.settings.collapsed ? '+' : '−';
      collapse.setAttribute(
        'aria-label',
        `${data.settings.collapsed ? 'Expand' : 'Collapse'} Buyer workspace`,
      );

      const matchingHelp = panel.querySelector('[data-fbmw-text-matching-help]');
      const matchingLabels = {
        simple: 'Contains this text',
        boolean: 'Use AND / OR',
        regex: 'Regular expression',
      };
      setText(
        panel.querySelector('[data-fbmw-text-matching-summary]'),
        `Text matching: ${matchingLabels[data.settings.filterMode]}`,
      );
      const matchingHelpText = {
        simple: 'Matches this text together, in the same order.',
        boolean: 'Use AND to require both and OR to allow either. Quotes keep a phrase together.',
        regex: 'Advanced: enter a case-insensitive regular expression.',
      }[data.settings.filterMode];
      if (matchingHelp.textContent !== matchingHelpText) {
        matchingHelp.textContent = matchingHelpText;
      }

      const count = panel.querySelector('[data-fbmw-count]');
      const countText = `${counts.visible} visible · ${counts.filtered} filtered · ${counts.total} loaded`;
      if (count.textContent !== countText) count.textContent = countText;

      const priceSummary = panel.querySelector('[data-fbmw-price-summary]');
      const summaryText = summarizePrices(counts.prices);
      if (priceSummary.textContent !== summaryText) priceSummary.textContent = summaryText;
      priceSummary.hidden = !summaryText;
      syncSavedViews(panel);

      const error = panel.querySelector('[data-fbmw-filter-error]');
      if (error.textContent !== filterError) error.textContent = filterError;
      error.hidden = !filterError;

      const currentUrl = new URL(window.location.href);
      const sort = panel.querySelector('[data-url-control="sort"]');
      const recency = panel.querySelector('[data-url-control="recency"]');
      const delivery = panel.querySelector('[data-url-control="delivery"]');
      const condition = panel.querySelector('[data-url-control="condition"]');
      if (panel.dataset.fbmwControlsUrl !== currentUrl.href) {
        sort.value = currentUrl.searchParams.get('sortBy') || '';
        recency.value = currentUrl.searchParams.get('daysSinceListed') || '';
        delivery.value = currentUrl.searchParams.get('deliveryMethod') || '';
        condition.value = currentUrl.searchParams.get('itemCondition') || '';
        panel.dataset.fbmwControlsUrl = currentUrl.href;
      }
    }

    function renderItemNavigation(itemId) {
      const items = data.navigation.items;
      const index = items.findIndex((item) => item.id === itemId);
      const existing = document.querySelector('[data-fbmw-item-navigation]');
      if (index < 0) {
        existing?.remove();
        return;
      }

      const previous = items[index - 1] || null;
      const next = items[index + 1] || null;
      currentItemTargets = { previous: previous?.url || null, next: next?.url || null };
      const context = JSON.stringify({ itemId, items, sourceUrl: data.navigation.sourceUrl });
      if (existing?.dataset.fbmwContext === context) return;
      existing?.remove();

      const navigation = document.createElement('nav');
      navigation.setAttribute('data-fbmw-owned', '');
      navigation.setAttribute('data-fbmw-item-navigation', '');
      navigation.dataset.fbmwContext = context;
      navigation.className = 'fbmw-item-navigation';
      navigation.setAttribute('aria-label', 'Buyer listing navigation');
      navigation.innerHTML = `
        ${navigationLink(previous, 'Previous listing')}
        <span class="fbmw-position">${index + 1} of ${items.length}</span>
        ${navigationLink(next, 'Next listing')}
        <a class="fbmw-back" href="${escapeAttribute(data.navigation.sourceUrl || '/marketplace/')}">Back to results</a>
      `;
      (document.querySelector('main') || document.body).prepend(navigation);
    }

    function navigationLink(item, label) {
      if (!item) return `<span class="fbmw-disabled" aria-disabled="true">${label}</span>`;
      return `<a href="${escapeAttribute(item.url)}" data-fbmw-nav-target aria-label="${label}">${label}</a>`;
    }

    function captureResultOrder(listings) {
      if (listings.length === 0) return;
      const items = listings.map(({ id, canonicalUrl }) => ({ id, url: canonicalUrl }));
      const sourceUrl = window.location.href;
      const next = { sourceUrl, items };
      if (JSON.stringify(data.navigation) === JSON.stringify(next)) return;
      data.navigation = next;
      persist();
    }

    function installEvents() {
      document.addEventListener('input', handleInput, true);
      document.addEventListener('change', handleInput, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeydown, true);
      window.addEventListener('popstate', queueRender);
    }

    function handleInput(event) {
      const control = event.target;
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
        return;
      }

      if (control.matches('[data-setting]')) {
        const key = control.dataset.setting;
        data.settings[key] = control.type === 'checkbox' ? control.checked : control.value;
        persist();
        queueRender();
        return;
      }

      if (control.matches('[data-fbmw-view-select]')) {
        selectedViewId = control.value;
        return;
      }

      if (control.matches('[data-fbmw-disposition]')) {
        const id = control.closest('[data-fbmw-listing-actions]')?.dataset.listingId;
        if (!id) return;
        const record = listingRecord(id);
        record.disposition = control.value || null;
        pruneListingRecord(id);
        persist();
        queueRender();
        return;
      }

      if (control.matches('[data-fbmw-note]')) {
        const actions = control.closest('[data-fbmw-listing-actions]');
        const id = actions?.dataset.listingId;
        if (!id) return;
        const record = listingRecord(id);
        record.note = control.value.slice(0, NOTE_LIMIT);
        pruneListingRecord(id);
        persist();
      }
    }

    function handleClick(event) {
      const itemNavigationLink = event.target.closest('[data-fbmw-nav-target]');
      if (
        itemNavigationLink &&
        event.button === 0 &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        navigate(itemNavigationLink.href, true);
        return;
      }

      const action = event.target.closest('[data-listing-action]');
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        updateListingRecord(action);
        return;
      }

      const workspaceAction = event.target.closest('[data-workspace-action]');
      if (workspaceAction) {
        event.preventDefault();
        event.stopPropagation();
        runWorkspaceAction(workspaceAction.dataset.workspaceAction);
        return;
      }

      const launcher = event.target.closest('[data-fbmw-launcher]');
      if (launcher) {
        event.preventDefault();
        const panel = createWorkspace();
        panel.setAttribute('data-fbmw-floating', '');
        document.body.append(panel);
        launcher.remove();
        syncWorkspace({ total: 0, visible: 0, filtered: 0 });
      }
    }

    function updateListingRecord(action) {
      const id = action.closest('[data-fbmw-listing-actions]')?.dataset.listingId;
      if (!id) return;
      const record = listingRecord(id);
      const kind = action.dataset.listingAction;

      if (kind === 'disposition') {
        record.disposition = record.disposition === action.dataset.value ? null : action.dataset.value;
      } else if (kind === 'favorite') {
        record.favorite = !record.favorite;
      } else if (kind === 'hidden') {
        record.hidden = !record.hidden;
      }

      pruneListingRecord(id);
      persist();
      queueRender();
    }

    function runWorkspaceAction(action) {
      if (action === 'collapse') {
        data.settings.collapsed = !data.settings.collapsed;
        persist();
        queueRender();
      } else if (action === 'apply-url') {
        applyUrlControls();
      } else if (action === 'clear-url') {
        clearUrlControls();
      } else if (action === 'save-view') {
        saveCurrentView();
      } else if (action === 'load-view') {
        loadSavedView();
      } else if (action === 'delete-view') {
        deleteSavedView();
      } else if (action === 'clear-listings') {
        clearListingData();
      } else if (action === 'clear-seen') {
        clearSeenHistory();
      } else if (action === 'export') {
        exportData();
      } else if (action === 'import') {
        importData();
      } else if (action === 'reset') {
        resetData();
      }
    }

    function handleKeydown(event) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !currentItemTargets ||
        !['ArrowLeft', 'ArrowRight'].includes(event.key) ||
        isTypingTarget(event.target)
      ) {
        return;
      }

      const target = event.key === 'ArrowLeft'
        ? currentItemTargets.previous
        : currentItemTargets.next;
      if (!target) return;
      event.preventDefault();
      navigate(target, true);
    }

    function isTypingTarget(target) {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
    }

    function applyUrlControls() {
      const panel = document.querySelector('[data-fbmw-workspace]');
      if (!panel) return;
      const url = new URL(window.location.href);
      updateUrlParameter(url, 'sortBy', panel.querySelector('[data-url-control="sort"]').value);
      updateUrlParameter(
        url,
        'daysSinceListed',
        panel.querySelector('[data-url-control="recency"]').value,
      );
      updateUrlParameter(
        url,
        'deliveryMethod',
        panel.querySelector('[data-url-control="delivery"]').value,
      );
      updateUrlParameter(
        url,
        'itemCondition',
        panel.querySelector('[data-url-control="condition"]').value,
      );
      navigate(url.href);
    }

    function clearUrlControls() {
      const url = new URL(window.location.href);
      MANAGED_URL_PARAMETERS.forEach((parameter) => url.searchParams.delete(parameter));
      navigate(url.href);
    }

    function updateUrlParameter(url, parameter, value) {
      if (value) url.searchParams.set(parameter, value);
      else url.searchParams.delete(parameter);
    }

    function syncSavedViews(panel) {
      const select = panel.querySelector('[data-fbmw-view-select]');
      if (!select) return;
      if (!data.savedViews.some((view) => view.id === selectedViewId)) selectedViewId = '';

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = data.savedViews.length ? 'Choose a saved view' : 'No saved views yet';
      while (select.firstChild) select.firstChild.remove();
      select.append(placeholder);
      for (const view of data.savedViews) {
        const option = document.createElement('option');
        option.value = view.id;
        option.textContent = view.name;
        select.append(option);
      }
      select.value = selectedViewId;
    }

    function saveCurrentView() {
      const panel = document.querySelector('[data-fbmw-workspace]');
      const nameInput = panel?.querySelector('[data-fbmw-view-name]');
      const name = nameInput?.value.trim().slice(0, SAVED_VIEW_NAME_LIMIT) || '';
      if (!name) {
        showDataMessage('Enter a name before saving this buyer view.');
        nameInput?.focus();
        return;
      }

      const existing = data.savedViews.find((view) => normalizeText(view.name) === normalizeText(name));
      const view = {
        id: existing?.id || savedViewId(),
        name,
        sourceUrl: marketplaceSourceUrl(window.location.href),
        settings: savedViewSettings(data.settings),
      };
      data.savedViews = [view, ...data.savedViews.filter((candidate) => candidate.id !== view.id)]
        .slice(0, SAVED_VIEW_LIMIT);
      selectedViewId = view.id;
      nameInput.value = '';
      persist();
      showDataMessage(existing ? 'Saved buyer view updated.' : 'Buyer view saved.');
      queueRender();
    }

    function loadSavedView() {
      const view = data.savedViews.find((candidate) => candidate.id === selectedViewId);
      if (!view) {
        showDataMessage('Choose a saved buyer view first.');
        return;
      }
      data.settings = { ...data.settings, ...view.settings };
      persist();
      showDataMessage(`Loaded buyer view: ${view.name}.`);
      if (view.sourceUrl && view.sourceUrl !== window.location.href) navigate(view.sourceUrl);
      else queueRender();
    }

    function deleteSavedView() {
      const view = data.savedViews.find((candidate) => candidate.id === selectedViewId);
      if (!view) {
        showDataMessage('Choose a saved buyer view first.');
        return;
      }
      data.savedViews = data.savedViews.filter((candidate) => candidate.id !== view.id);
      selectedViewId = '';
      persist();
      showDataMessage(`Deleted buyer view: ${view.name}.`);
      queueRender();
    }

    function navigate(url, replace = false) {
      window.location[replace ? 'replace' : 'assign'](url);
    }

    function exportData() {
      const payload = JSON.stringify(
        {
          format: DATA_FORMAT,
          version: 1,
          exportedAt: new Date().toISOString(),
          settings: data.settings,
          listings: data.listings,
          navigation: data.navigation,
          savedViews: data.savedViews,
          seen: data.seen,
        },
        null,
        2,
      );

      if (typeof URL.createObjectURL !== 'function') {
        window.prompt('Copy your Buyer workspace data', payload);
        return;
      }

      const blobUrl = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `facebook-marketplace-buyer-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
      showDataMessage('Buyer data exported.');
    }

    function importData() {
      const input = window.prompt('Paste exported Buyer workspace JSON');
      if (input === null) return;

      try {
        const candidate = validateImport(JSON.parse(input));
        data = candidate;
        seenBeforeSession = new Set(Object.keys(data.seen));
        persist();
        showDataMessage('Buyer data imported.');
        queueRender();
      } catch {
        showDataMessage('Could not import: invalid JSON or Buyer workspace data.');
      }
    }

    function resetData() {
      if (!window.confirm('Reset all Buyer workspace settings, listing decisions, and notes?')) return;
      GM_deleteValue(STORAGE_KEY);
      data = createDefaultData();
      seenBeforeSession = new Set();
      showDataMessage('Buyer workspace data reset.');
      queueRender();
    }

    function clearListingData() {
      if (!window.confirm('Clear all listing decisions, favorites, hidden states, and notes?')) return;
      data.listings = {};
      persist();
      showDataMessage('Listing decisions and notes cleared.');
      queueRender();
    }

    function clearSeenHistory() {
      if (!window.confirm('Forget which Marketplace listings have been seen?')) return;
      data.seen = {};
      seenBeforeSession = new Set();
      persist();
      showDataMessage('Seen-listing history cleared.');
      queueRender();
    }

    function showDataMessage(message) {
      const element = document.querySelector('[data-fbmw-data-message]');
      if (!element) return;
      element.textContent = message;
      element.hidden = false;
    }

    function removeMarketplaceInterface() {
      document
        .querySelectorAll(
          '[data-fbmw-workspace], [data-fbmw-launcher], [data-fbmw-saved-link="fallback"]',
        )
        .forEach((element) => element.remove());
      document
        .querySelectorAll('[data-fbmw-saved-link="native"]')
        .forEach((element) => element.removeAttribute('data-fbmw-saved-link'));
    }

    function restoreCards() {
      for (const card of document.querySelectorAll('[data-fbmw-card]')) {
        restoreCard(card);
      }
    }

    function restoreCard(card) {
      card.hidden = card.getAttribute('data-fbmw-original-hidden') === 'true';
      card.style.display = card.getAttribute('data-fbmw-original-display') || '';
      card.removeAttribute('data-fbmw-card');
      card.removeAttribute('data-fbmw-hidden');
      card.removeAttribute('data-fbmw-dimmed');
      card.removeAttribute('data-fbmw-original-hidden');
      card.removeAttribute('data-fbmw-original-display');
      card
        .querySelectorAll(':scope > [data-fbmw-open], :scope > [data-fbmw-listing-actions]')
        .forEach((element) => element.remove());
    }

    function installStyles() {
      if (document.querySelector('[data-fbmw-style]')) return;
      const style = document.createElement('style');
      style.setAttribute('data-fbmw-owned', '');
      style.setAttribute('data-fbmw-style', '');
      style.textContent = `
        [data-fbmw-workspace], [data-fbmw-item-navigation], [data-fbmw-listing-actions],
        [data-fbmw-launcher], [data-fbmw-open], [data-fbmw-saved-link="fallback"],
        [data-fbmw-back-link] {
          --fbmw-primary-text: var(--primary-text, #050505);
          --fbmw-secondary-text: var(--secondary-text, #65676b);
          --fbmw-surface: var(--card-background, #fff);
          --fbmw-control: var(--comment-background, #f0f2f5);
          --fbmw-button: var(--secondary-button-background, #e4e6eb);
          box-sizing: border-box;
          color: var(--fbmw-primary-text);
          color-scheme: light dark;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 14px;
        }
        .fbmw-workspace {
          background: var(--fbmw-surface);
          border: 1px solid var(--divider, #ced0d4);
          border-radius: 12px;
          display: block;
          flex: 0 0 auto;
          margin: 12px 8px;
          overflow: hidden;
          width: calc(100% - 16px);
        }
        .fbmw-workspace[data-fbmw-floating] {
          bottom: 72px;
          box-shadow: 0 8px 24px rgb(0 0 0 / 22%);
          max-height: min(720px, calc(100vh - 96px));
          max-width: 360px;
          overflow: auto;
          position: fixed;
          right: 16px;
          width: calc(100vw - 32px);
          z-index: 1000;
        }
        .fbmw-header {
          align-items: center;
          display: flex;
          justify-content: space-between;
          padding: 12px;
        }
        .fbmw-header h2,
        .fbmw-panel-body label,
        .fbmw-panel-body label > span,
        .fbmw-note-label,
        .fbmw-note-label > span {
          color: var(--fbmw-primary-text);
        }
        .fbmw-header h2 { font-size: 17px; margin: 0; }
        .fbmw-panel-body { display: grid; gap: 10px; padding: 0 12px 12px; }
        .fbmw-panel-body[hidden] { display: none; }
        .fbmw-panel-body label:not(.fbmw-check) { display: grid; gap: 5px; }
        .fbmw-panel-body input[type="search"], .fbmw-panel-body input[type="text"],
        .fbmw-panel-body input[type="number"],
        .fbmw-panel-body select, .fbmw-panel-body textarea {
          background: var(--fbmw-control);
          border: 1px solid transparent;
          border-radius: 8px;
          color: var(--fbmw-primary-text);
          font: inherit;
          min-width: 0;
          padding: 8px 10px;
          resize: vertical;
          width: 100%;
        }
        .fbmw-panel-body :is(input, select, textarea, button, summary, a):focus-visible,
        .fbmw-listing-actions :is(input, select, button, summary):focus-visible,
        .fbmw-open:focus-visible {
          outline: 2px solid var(--accent, #0866ff);
          outline-offset: 2px;
        }
        .fbmw-panel-body button, .fbmw-header button, .fbmw-listing-actions button,
        .fbmw-listing-menu summary,
        .fbmw-item-navigation a, .fbmw-item-navigation .fbmw-disabled {
          background: var(--fbmw-button);
          border: 0;
          border-radius: 7px;
          color: var(--fbmw-primary-text);
          cursor: pointer;
          font: inherit;
          padding: 7px 9px;
          text-decoration: none;
        }
        .fbmw-panel-body button[aria-pressed="true"],
        .fbmw-listing-actions button[aria-pressed="true"] {
          background: var(--primary-button-background, #0866ff);
          color: var(--primary-button-text, #fff);
        }
        .fbmw-listing-actions [data-value="later"][aria-pressed="true"] {
          background: #f7b928;
          color: #1c1e21;
        }
        .fbmw-listing-actions [data-value="pass"][aria-pressed="true"],
        .fbmw-listing-actions [data-listing-action="hidden"][aria-pressed="true"] {
          background: var(--negative, #b42318);
          color: #fff;
        }
        .fbmw-listing-actions [data-listing-action="favorite"][aria-pressed="true"] {
          background: #f7b928;
          color: #1c1e21;
        }
        .fbmw-help, .fbmw-count, .fbmw-alert { margin: 0; }
        .fbmw-help, .fbmw-count { color: var(--fbmw-secondary-text); font-size: 12px; }
        .fbmw-alert { color: var(--negative, #b42318); font-size: 12px; }
        .fbmw-two-columns { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
        .fbmw-check { align-items: center; display: flex; gap: 7px; }
        .fbmw-panel-body details {
          border: 1px solid var(--divider, #ced0d4);
          border-radius: 8px;
          padding: 9px 10px;
        }
        .fbmw-panel-body summary { cursor: pointer; font-weight: 600; }
        .fbmw-panel-body ::placeholder,
        .fbmw-listing-actions ::placeholder {
          color: var(--fbmw-secondary-text);
          opacity: 1;
        }
        .fbmw-detail-body { display: grid; gap: 8px; padding-top: 9px; }
        .fbmw-action-row, .fbmw-data-actions { display: flex; flex-wrap: wrap; gap: 6px; }
        .fbmw-data-actions { margin-top: 8px; }
        .fbmw-shortcut {
          align-items: center;
          border-radius: 8px;
          color: var(--fbmw-primary-text);
          display: flex;
          font-weight: 600;
          min-height: 52px;
          padding: 0 12px;
          text-decoration: none;
        }
        .fbmw-shortcut:hover { background: var(--hover-overlay, rgb(0 0 0 / 5%)); }
        .fbmw-launcher {
          background: var(--primary-button-background, #0866ff);
          border: 0;
          border-radius: 22px;
          bottom: 16px;
          box-shadow: 0 4px 12px rgb(0 0 0 / 22%);
          color: var(--primary-button-text, #fff);
          cursor: pointer;
          font-weight: 600;
          padding: 12px 16px;
          position: fixed;
          right: 16px;
          z-index: 999;
        }
        [data-fbmw-card] { position: relative; }
        [data-fbmw-card][data-fbmw-dimmed="true"] > a:not([data-fbmw-open]),
        [data-fbmw-card][data-fbmw-dimmed="true"] > :not([data-fbmw-owned]) { opacity: .58; }
        [data-fbmw-card][data-fbmw-dimmed="true"]:is(:hover, :focus-within) > a:not([data-fbmw-open]),
        [data-fbmw-card][data-fbmw-dimmed="true"]:is(:hover, :focus-within) > :not([data-fbmw-owned]) {
          opacity: .72;
        }
        .fbmw-open {
          background: var(--fbmw-button);
          border-radius: 7px;
          padding: 5px 8px;
          position: absolute;
          right: 8px;
          text-decoration: none;
          top: 8px;
          z-index: 2;
        }
        .fbmw-listing-actions {
          display: grid;
          gap: 5px;
          margin-top: 4px;
          min-height: 36px;
          position: relative;
        }
        .fbmw-listing-toolbar {
          align-items: center;
          display: grid;
          gap: 6px;
          grid-template-columns: minmax(0, 1fr) 36px 36px;
          min-height: 36px;
        }
        .fbmw-listing-toolbar > select {
          background: var(--fbmw-control);
          border: 1px solid var(--divider, #ced0d4);
          border-radius: 7px;
          color: var(--fbmw-primary-text);
          font: inherit;
          height: 36px;
          min-width: 0;
          padding: 6px 8px;
          width: 100%;
        }
        .fbmw-favorite,
        .fbmw-listing-menu > summary {
          align-items: center;
          display: flex;
          height: 36px;
          justify-content: center;
          list-style: none;
          padding: 0;
          width: 36px;
        }
        .fbmw-listing-menu > summary::-webkit-details-marker { display: none; }
        .fbmw-listing-menu { position: relative; }
        .fbmw-listing-menu[data-has-note="true"] > summary {
          box-shadow: inset 0 0 0 2px var(--accent, #0866ff);
        }
        .fbmw-listing-menu-panel {
          background: var(--fbmw-surface);
          border: 1px solid var(--divider, #ced0d4);
          border-radius: 10px;
          bottom: calc(100% + 6px);
          box-shadow: 0 8px 24px rgb(0 0 0 / 24%);
          display: grid;
          gap: 8px;
          padding: 10px;
          position: absolute;
          right: 0;
          width: min(240px, calc(100vw - 32px));
          z-index: 4;
        }
        .fbmw-listing-menu:not([open]) > .fbmw-listing-menu-panel { display: none; }
        .fbmw-note-label { display: grid; gap: 4px; }
        .fbmw-note-label input {
          background: var(--fbmw-control);
          border: 1px solid var(--divider, #ced0d4);
          border-radius: 7px;
          color: var(--fbmw-primary-text);
          font: inherit;
          min-width: 0;
          padding: 7px 8px;
          width: 100%;
        }
        .fbmw-reason {
          background: var(--fbmw-button);
          border-radius: 7px;
          color: var(--fbmw-secondary-text);
          font-size: 12px;
          margin: 0;
          padding: 5px 7px;
        }
        .fbmw-item-navigation {
          align-items: center;
          background: var(--fbmw-surface);
          border: 1px solid var(--divider, #ced0d4);
          border-radius: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 12px;
          padding: 10px;
        }
        .fbmw-item-navigation .fbmw-disabled { cursor: default; opacity: .55; }
        .fbmw-position { color: var(--fbmw-secondary-text); }
        .fbmw-back { margin-left: auto; }
        @media (prefers-color-scheme: dark) {
          [data-fbmw-workspace], [data-fbmw-item-navigation], [data-fbmw-listing-actions],
          [data-fbmw-launcher], [data-fbmw-open], [data-fbmw-saved-link="fallback"],
          [data-fbmw-back-link] {
            --fbmw-primary-text: var(--primary-text, #e4e6eb);
            --fbmw-secondary-text: var(--secondary-text, #b0b3b8);
            --fbmw-surface: var(--card-background, #242526);
            --fbmw-control: var(--comment-background, #3a3b3c);
            --fbmw-button: var(--secondary-button-background, #3a3b3c);
          }
        }
        @media (max-width: 700px) {
          .fbmw-two-columns { grid-template-columns: 1fr; }
          .fbmw-workspace:not([data-fbmw-floating]) { margin-inline: 4px; width: calc(100% - 8px); }
          .fbmw-item-navigation { margin-inline: 6px; }
        }
      `;
      (document.head || document.documentElement).append(style);
    }

    return { start };

    function listingRecord(id) {
      const record = data.listings[id] || createListingRecord();
      delete data.listings[id];
      data.listings[id] = record;
      return record;
    }

    function pruneListingRecord(id) {
      const record = data.listings[id];
      if (
        record &&
        record.disposition === null &&
        !record.favorite &&
        !record.hidden &&
        !record.note
      ) {
        delete data.listings[id];
      }
    }

    function persist() {
      trimOldestEntries(data.listings, LISTING_RECORD_LIMIT);
      trimOldestEntries(data.seen, SEEN_LISTING_LIMIT);
      GM_setValue(STORAGE_KEY, data);
    }
  }

  function createDefaultData() {
    return {
      settings: { ...DEFAULT_SETTINGS },
      listings: {},
      navigation: { sourceUrl: '', items: [] },
      savedViews: [],
      seen: {},
    };
  }

  function createListingRecord() {
    return { disposition: null, favorite: false, hidden: false, note: '' };
  }

  function loadData() {
    try {
      return normalizeStoredData(GM_getValue(STORAGE_KEY, null));
    } catch {
      return createDefaultData();
    }
  }

  function normalizeStoredData(value) {
    if (!isPlainObject(value)) return createDefaultData();
    const normalized = createDefaultData();

    if (isPlainObject(value.settings)) {
      normalized.settings = normalizeSettings(value.settings);
    }
    if (isPlainObject(value.listings)) {
      normalized.listings = normalizeListings(value.listings, false);
    }
    if (isPlainObject(value.navigation)) {
      normalized.navigation = normalizeNavigation(value.navigation, false);
    }
    if (Array.isArray(value.savedViews)) {
      normalized.savedViews = normalizeSavedViews(value.savedViews, false);
    }
    if (isPlainObject(value.seen)) {
      normalized.seen = normalizeSeenListings(value.seen, false);
    }
    return normalized;
  }

  function validateImport(value) {
    if (!isPlainObject(value) || value.format !== DATA_FORMAT || value.version !== 1) {
      throw new TypeError('Unsupported Buyer workspace export');
    }
    if (!isPlainObject(value.settings) || !isPlainObject(value.listings)) {
      throw new TypeError('Missing Buyer workspace data');
    }
    return {
      settings: normalizeSettings(value.settings, true),
      listings: normalizeListings(value.listings, true),
      navigation: normalizeNavigation(value.navigation, true),
      savedViews: normalizeSavedViews(value.savedViews, true),
      seen: normalizeSeenListings(value.seen, true),
    };
  }

  function normalizeSettings(settings, strict = false) {
    const normalized = { ...DEFAULT_SETTINGS };
    const stringKeys = [
      'query',
      'excludedTerms',
      'minimumPrice',
      'maximumPrice',
      'allowedLocations',
      'blockedLocations',
    ];
    const booleanKeys = ['dimSponsored', 'dimShipping', 'showHidden', 'collapsed'];

    for (const key of stringKeys) {
      if (settings[key] === undefined) continue;
      if (typeof settings[key] !== 'string') {
        if (strict) throw new TypeError(`Invalid setting: ${key}`);
        continue;
      }
      normalized[key] = settings[key];
    }

    for (const key of booleanKeys) {
      if (settings[key] === undefined) continue;
      if (typeof settings[key] !== 'boolean') {
        if (strict) throw new TypeError(`Invalid setting: ${key}`);
        continue;
      }
      normalized[key] = settings[key];
    }

    if (settings.filterMode !== undefined) {
      if (!['simple', 'boolean', 'regex'].includes(settings.filterMode)) {
        if (strict) throw new TypeError('Invalid filter mode');
      } else {
        normalized.filterMode = settings.filterMode;
      }
    }
    if (settings.viewState !== undefined) {
      if (![
        'all',
        'new',
        'seen',
        'unreviewed',
        'interested',
        'later',
        'pass',
        'favorites',
      ].includes(settings.viewState)) {
        if (strict) throw new TypeError('Invalid buyer state filter');
      } else {
        normalized.viewState = settings.viewState;
      }
    }
    return normalized;
  }

  function normalizeListings(listings, strict = false) {
    const normalized = {};
    for (const [id, record] of Object.entries(listings)) {
      if (!/^\d+$/.test(id) || !isPlainObject(record)) {
        if (strict) throw new TypeError('Invalid listing record');
        continue;
      }

      const disposition = record.disposition ?? null;
      const favorite = record.favorite ?? false;
      const hidden = record.hidden ?? false;
      const note = record.note ?? '';
      if (
        ![null, 'interested', 'later', 'pass'].includes(disposition) ||
        typeof favorite !== 'boolean' ||
        typeof hidden !== 'boolean' ||
        typeof note !== 'string' ||
        note.length > NOTE_LIMIT
      ) {
        if (strict) throw new TypeError('Invalid listing record');
        continue;
      }
      normalized[id] = { disposition, favorite, hidden, note };
    }
    return normalized;
  }

  function normalizeNavigation(navigation, strict = false) {
    const fallback = { sourceUrl: '', items: [] };
    if (!isPlainObject(navigation)) {
      if (strict && navigation !== undefined) throw new TypeError('Invalid navigation data');
      return fallback;
    }

    if (typeof navigation.sourceUrl !== 'string' || !Array.isArray(navigation.items)) {
      if (strict) throw new TypeError('Invalid navigation data');
      return fallback;
    }

    const sourceUrl = marketplaceSourceUrl(navigation.sourceUrl);
    if (navigation.sourceUrl && !sourceUrl) {
      if (strict) throw new TypeError('Invalid navigation source');
      return fallback;
    }

    const items = [];
    const seen = new Set();
    for (const item of navigation.items) {
      if (
        !isPlainObject(item) ||
        typeof item.id !== 'string' ||
        !/^\d+$/.test(item.id) ||
        item.url !== canonicalItemUrl(item.id)
      ) {
        if (strict) throw new TypeError('Invalid navigation item');
        continue;
      }
      if (!seen.has(item.id)) items.push({ id: item.id, url: item.url });
      seen.add(item.id);
    }
    return { sourceUrl, items };
  }

  function normalizeSavedViews(views, strict = false) {
    if (views === undefined) return [];
    if (!Array.isArray(views)) {
      if (strict) throw new TypeError('Invalid saved buyer views');
      return [];
    }

    const normalized = [];
    const seen = new Set();
    for (const view of views.slice(0, SAVED_VIEW_LIMIT)) {
      if (
        !isPlainObject(view) ||
        typeof view.id !== 'string' ||
        !/^[a-z0-9-]{6,80}$/i.test(view.id) ||
        typeof view.name !== 'string' ||
        !view.name.trim() ||
        view.name.length > SAVED_VIEW_NAME_LIMIT ||
        !isPlainObject(view.settings)
      ) {
        if (strict) throw new TypeError('Invalid saved buyer view');
        continue;
      }
      const sourceUrl = marketplaceSourceUrl(view.sourceUrl || '');
      if (view.sourceUrl && !sourceUrl) {
        if (strict) throw new TypeError('Invalid saved buyer view URL');
        continue;
      }
      if (seen.has(view.id)) {
        if (strict) throw new TypeError('Duplicate saved buyer view');
        continue;
      }
      seen.add(view.id);
      normalized.push({
        id: view.id,
        name: view.name.trim(),
        sourceUrl,
        settings: savedViewSettings(normalizeSettings(view.settings, strict)),
      });
    }
    return normalized;
  }

  function normalizeSeenListings(seen, strict = false) {
    if (seen === undefined) return {};
    if (!isPlainObject(seen)) {
      if (strict) throw new TypeError('Invalid seen-listing history');
      return {};
    }

    const normalized = {};
    for (const [id, timestamp] of Object.entries(seen)) {
      if (!/^\d+$/.test(id) || !Number.isFinite(timestamp) || timestamp <= 0) {
        if (strict) throw new TypeError('Invalid seen-listing record');
        continue;
      }
      normalized[id] = timestamp;
    }
    trimOldestEntries(normalized, SEEN_LISTING_LIMIT);
    return normalized;
  }

  function savedViewSettings(settings) {
    return Object.fromEntries(SAVED_VIEW_SETTING_KEYS.map((key) => [key, settings[key]]));
  }

  function savedViewId() {
    return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function trimOldestEntries(value, limit) {
    const keys = Object.keys(value);
    for (const key of keys.slice(0, Math.max(0, keys.length - limit))) delete value[key];
  }

  function buildTextMatcher(mode, query) {
    const trimmed = query.trim();
    if (!trimmed) return { error: '', matches: null };

    if (mode === 'simple') {
      const needle = normalizeText(trimmed);
      return { error: '', matches: (text) => normalizeText(text).includes(needle) };
    }

    if (mode === 'regex') {
      if (trimmed.length > 160 || hasUnsafeRegexShape(trimmed)) {
        return {
          error: 'Invalid regular expression: use a shorter expression without nested repetition.',
          matches: null,
        };
      }
      try {
        const expression = new RegExp(trimmed, 'i');
        return { error: '', matches: (text) => expression.test(text) };
      } catch {
        return { error: 'Invalid regular expression.', matches: null };
      }
    }

    try {
      const expression = parseBooleanExpression(trimmed);
      return {
        error: '',
        matches: (text) => evaluateBooleanExpression(expression, normalizeText(text)),
      };
    } catch {
      return { error: 'Invalid AND / OR filter.', matches: null };
    }
  }

  function hasUnsafeRegexShape(pattern) {
    return /\\\d/.test(pattern) || /\([^)]*[+*][^)]*\)[+*{]/.test(pattern);
  }

  function parseBooleanExpression(source) {
    const tokens = [];
    const tokenPattern = /\s*(\+|\||\(|\)|"(?:\\.|[^"\\])*"|[^\s+|()]+)/gy;
    let position = 0;
    while (position < source.length) {
      tokenPattern.lastIndex = position;
      const match = tokenPattern.exec(source);
      if (!match) throw new SyntaxError('Unexpected token');
      const token = match[1];
      if (!token.startsWith('"') && /^and$/i.test(token)) tokens.push('+');
      else if (!token.startsWith('"') && /^or$/i.test(token)) tokens.push('|');
      else tokens.push(token);
      position = tokenPattern.lastIndex;
    }

    let index = 0;
    function parseOr() {
      let node = parseAnd();
      while (tokens[index] === '|') {
        index += 1;
        node = { type: 'or', left: node, right: parseAnd() };
      }
      return node;
    }

    function parseAnd() {
      let node = parsePrimary();
      while (tokens[index] === '+' || isPrimaryStart(tokens[index])) {
        if (tokens[index] === '+') index += 1;
        node = { type: 'and', left: node, right: parsePrimary() };
      }
      return node;
    }

    function parsePrimary() {
      const token = tokens[index];
      if (token === '(') {
        index += 1;
        const node = parseOr();
        if (tokens[index] !== ')') throw new SyntaxError('Missing parenthesis');
        index += 1;
        return node;
      }
      if (!isPrimaryStart(token) || token === '(') throw new SyntaxError('Missing term');
      index += 1;
      const value = token.startsWith('"')
        ? token.slice(1, -1).replace(/\\"/g, '"')
        : token;
      return { type: 'term', value: normalizeText(value) };
    }

    const result = parseOr();
    if (index !== tokens.length) throw new SyntaxError('Unexpected token');
    return result;
  }

  function isPrimaryStart(token) {
    return Boolean(token && !['+', '|', ')'].includes(token));
  }

  function evaluateBooleanExpression(node, text) {
    if (node.type === 'term') return text.includes(node.value);
    if (node.type === 'and') {
      return evaluateBooleanExpression(node.left, text) && evaluateBooleanExpression(node.right, text);
    }
    return evaluateBooleanExpression(node.left, text) || evaluateBooleanExpression(node.right, text);
  }

  function termsFromLines(value) {
    return [...new Set(value.split(/[\n,]/).map(normalizeText).filter(Boolean))];
  }

  function nonNegativeNumber(value) {
    if (value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function summarizePrices(prices) {
    if (prices.length === 0) return '';
    const sorted = [...prices].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
    return `Loaded prices: ${formatPrice(sorted[0])}–${formatPrice(sorted.at(-1))} · median ${formatPrice(median)}`;
  }

  function formatPrice(value) {
    return `$${value.toLocaleString(undefined, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    })}`;
  }

  function displayTerm(term) {
    return term.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
  }

  function normalizeText(value) {
    return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  }

  function listingIdFromUrl(value) {
    try {
      const url = new URL(value, window.location.origin);
      if (url.origin !== window.location.origin) return null;
      return url.pathname.match(/^\/marketplace\/item\/(\d+)/)?.[1] || null;
    } catch {
      return null;
    }
  }

  function canonicalItemUrl(id) {
    return `https://www.facebook.com/marketplace/item/${id}/`;
  }

  function marketplaceSourceUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      if (
        url.origin !== 'https://www.facebook.com' ||
        !url.pathname.startsWith('/marketplace/') ||
        url.username ||
        url.password
      ) {
        return '';
      }
      return url.href;
    } catch {
      return '';
    }
  }

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function escapeAttribute(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }
})();
