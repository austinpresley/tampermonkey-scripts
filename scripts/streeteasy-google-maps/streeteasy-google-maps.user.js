// ==UserScript==
// @name         StreetEasy: Open in Google Maps
// @namespace    https://github.com/austinpresley/tampermonkey-scripts
// @version      1.0.0
// @description  Adds Google Maps buttons to StreetEasy listings and property cards using each property's street address.
// @match        https://streeteasy.com/building/*
// @match        https://streeteasy.com/property/*
// @match        https://streeteasy.com/for-sale/*
// @match        https://streeteasy.com/for-rent/*
// @match        https://www.streeteasy.com/building/*
// @match        https://www.streeteasy.com/property/*
// @match        https://www.streeteasy.com/for-sale/*
// @match        https://www.streeteasy.com/for-rent/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/austinpresley/tampermonkey-scripts/tree/main/scripts/streeteasy-google-maps
// @supportURL   https://github.com/austinpresley/tampermonkey-scripts/issues
// ==/UserScript==

(() => {
  'use strict';

  const SCRIPT_ID = 'streeteasy-google-maps';
  const BUTTON_CLASS = `${SCRIPT_ID}-button`;
  const CARD_BUTTON_CLASS = `${SCRIPT_ID}-card-button`;
  const ADDRESS_PATTERN = /\b\d{1,6}(?:-\d{1,6})?\s+[A-Za-z0-9.' -]{2,70},\s*[A-Za-z.' -]{2,40},\s*(?:NY|NJ)\s+\d{5}(?:-\d{4})?\b/i;
  const LISTING_PATH_PATTERN = /^\/(?:building\/[^/]+(?:\/[^/]+)?|property\/[^/]+)\/?$/;
  const DETAIL_PATH_PATTERN = /^\/(?:building|property)\//;
  const LOCATION_LABEL_PATTERN = /\b(?:condo|co-op|house|rental unit|townhouse|multi-family home|two-family home|other type|building)\s+in\s+(.+)$/i;

  let refreshTimer = 0;

  function normalizeText(value) {
    return value?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function mapsSearchUrl(address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  function pinIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s6-5.15 6-11a6 6 0 1 0-12 0c0 5.85 6 11 6 11Z"></path>
        <circle cx="12" cy="10" r="2.25"></circle>
      </svg>
    `;
  }

  function addStyles() {
    if (document.getElementById(`${SCRIPT_ID}-styles`)) return;

    const style = document.createElement('style');
    style.id = `${SCRIPT_ID}-styles`;
    style.textContent = `
      .${BUTTON_CLASS} {
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-height: 36px;
        border: 1px solid #1a73e8;
        border-radius: 999px;
        padding: 7px 13px;
        color: #fff !important;
        background: #1a73e8;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px;
        font-weight: 650;
        line-height: 1.2;
        text-decoration: none !important;
        white-space: nowrap;
        box-shadow: 0 2px 7px rgba(0, 0, 0, .16);
        transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
      }

      .${BUTTON_CLASS}:hover {
        border-color: #1557b0;
        background: #1557b0;
      }

      .${BUTTON_CLASS}:active { transform: translateY(1px); }
      .${BUTTON_CLASS}:focus-visible { outline: 3px solid rgba(26, 115, 232, .35); outline-offset: 2px; }
      .${BUTTON_CLASS} svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; }

      .${CARD_BUTTON_CLASS} {
        min-height: 28px;
        margin-inline-start: 8px;
        padding: 4px 9px;
        font-size: 12px;
        vertical-align: middle;
        box-shadow: none;
      }

      .${CARD_BUTTON_CLASS} svg { width: 14px; height: 14px; }

      #${SCRIPT_ID}-primary {
        position: fixed;
        z-index: 2147483000;
        right: 22px;
        bottom: 22px;
        min-height: 44px;
        padding: 10px 17px;
        font-size: 14px;
        box-shadow: 0 5px 18px rgba(0, 0, 0, .24);
      }

      @media (max-width: 640px) {
        #${SCRIPT_ID}-primary {
          right: 12px;
          bottom: 12px;
        }
      }
    `;
    document.head.append(style);
  }

  function createButton(label, href, extraClass = '') {
    const button = document.createElement('a');
    button.className = `${BUTTON_CLASS}${extraClass ? ` ${extraClass}` : ''}`;
    button.href = href;
    button.target = '_blank';
    button.rel = 'noopener noreferrer';
    button.setAttribute('aria-label', `${label} in a new tab`);
    button.innerHTML = `${pinIcon()}<span>${label}</span>`;
    button.addEventListener('click', (event) => event.stopPropagation());
    button.addEventListener('mousedown', (event) => event.stopPropagation());
    return button;
  }

  function isStreetEasyListingLink(anchor) {
    try {
      const url = new URL(anchor.href, window.location.href);
      return /^(?:www\.)?streeteasy\.com$/i.test(url.hostname)
        && LISTING_PATH_PATTERN.test(url.pathname);
    } catch {
      return false;
    }
  }

  function looksLikeListingTitle(text) {
    return /^\d{1,6}(?:-\d{1,6})?\s+\S/.test(text) || /\s#\S+$/.test(text);
  }

  function directText(element) {
    return normalizeText(
      Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(' '),
    );
  }

  function findCardLocation(anchor) {
    let container = anchor.parentElement;

    for (let depth = 0; container && depth < 7; depth += 1, container = container.parentElement) {
      const candidates = Array.from(container.querySelectorAll('div, p, span'));
      for (const candidate of candidates) {
        const texts = [directText(candidate), normalizeText(candidate.textContent)];
        for (const text of texts) {
          const match = text.length <= 90 ? text.match(LOCATION_LABEL_PATTERN) : null;
          if (match) return normalizeText(match[1]);
        }
      }

      const containerText = normalizeText(container.textContent);
      if (/\bListing by\b|\b(?:bed|bath)s?\b|\$[\d,.]+/i.test(containerText)) break;
    }

    return '';
  }

  function cardMapQuery(anchor, title) {
    const streetAddress = title.replace(/\s+#\S+$/, '');
    const location = findCardLocation(anchor);
    return location ? `${streetAddress}, ${location}` : `${streetAddress}, New York metropolitan area`;
  }

  function enhanceListingCards() {
    const anchors = document.querySelectorAll('a[href]');
    const currentTitle = pageListingTitle();

    for (const anchor of anchors) {
      if (anchor.closest(`.${BUTTON_CLASS}, header, nav, footer`)) continue;
      if (!isStreetEasyListingLink(anchor)) continue;

      const title = normalizeText(anchor.textContent);
      if (!looksLikeListingTitle(title)) continue;
      if (DETAIL_PATH_PATTERN.test(window.location.pathname) && title === currentTitle) continue;

      const source = `${anchor.href}|${title}`;
      if (anchor.dataset.streeteasyMapsSource === source) continue;

      if (anchor.nextElementSibling?.classList.contains(CARD_BUTTON_CLASS)) {
        anchor.nextElementSibling.remove();
      }
      const button = createButton('Map', mapsSearchUrl(cardMapQuery(anchor, title)), CARD_BUTTON_CLASS);
      button.title = `Open ${title} in Google Maps`;
      anchor.insertAdjacentElement('afterend', button);
      anchor.dataset.streeteasyMapsSource = source;
    }
  }

  function findExistingMapUrl() {
    const links = Array.from(document.querySelectorAll('a[href*="google.com/maps"]'));
    const exactLink = links.find((link) => normalizeText(link.textContent).toLowerCase() === 'view on google maps');
    const coordinateLink = links.find((link) => /\/maps\/(?:place|search)\/-?\d+(?:\.\d+)?(?:%2C|,)-?\d+/i.test(link.href));
    return exactLink?.href || coordinateLink?.href || '';
  }

  function formatPostalAddress(address) {
    if (!address || typeof address !== 'object') return '';

    const street = normalizeText(address.streetAddress);
    const locality = normalizeText(address.addressLocality);
    const region = normalizeText(address.addressRegion);
    const postalCode = normalizeText(address.postalCode);
    if (!street || !locality || !(region || postalCode)) return '';

    return `${street}, ${locality}, ${[region, postalCode].filter(Boolean).join(' ')}`;
  }

  function collectStructuredAddresses(value, results) {
    if (!value || typeof value !== 'object') return;

    if (!Array.isArray(value)) {
      const address = formatPostalAddress(value);
      if (address) results.push(address);
    }

    for (const child of Object.values(value)) collectStructuredAddresses(child, results);
  }

  function findStructuredAddress() {
    const addresses = [];

    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        collectStructuredAddresses(JSON.parse(script.textContent), addresses);
      } catch {
        // Ignore malformed structured data from the page.
      }
    }

    const titleStreet = pageListingTitle().replace(/\s+#\S+$/, '').toLowerCase();
    return addresses.find((address) => titleStreet && address.toLowerCase().includes(titleStreet))
      || addresses[0]
      || '';
  }

  function findBuildingSectionAddress() {
    const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .find((element) => /^about the building$/i.test(normalizeText(element.textContent)));
    if (!heading) return null;

    let scope = heading.parentElement;
    for (let depth = 0; scope && depth < 4; depth += 1, scope = scope.parentElement) {
      const matches = Array.from(scope.querySelectorAll('address, p, div, span'))
        .map((element) => ({ element, match: normalizeText(element.textContent).match(ADDRESS_PATTERN) }))
        .filter(({ element, match }) => match && normalizeText(element.textContent).length <= match[0].length + 30)
        .sort((left, right) => normalizeText(left.element.textContent).length - normalizeText(right.element.textContent).length);

      if (matches.length) {
        return { address: normalizeText(matches[0].match[0]), element: matches[0].element };
      }
    }

    return null;
  }

  function pageListingTitle() {
    const titlePrefix = normalizeText(document.title.split(' in ')[0]).replace(/^StreetEasy:\s*/i, '');
    return normalizeText(titlePrefix.match(/\bat\s+(.+)$/i)?.[1] || titlePrefix);
  }

  function titleAddress() {
    const title = pageListingTitle();
    if (!looksLikeListingTitle(title)) return '';
    return `${title.replace(/\s+#\S+$/, '')}, New York metropolitan area`;
  }

  function addAddressButton(addressInfo, href) {
    const { element } = addressInfo ?? {};
    if (!element || element.dataset.streeteasyMapsAddressButton === 'true') return;

    const button = createButton('Open in Google Maps', href);
    button.style.marginInlineStart = '10px';
    button.style.marginBlock = '6px';
    element.insertAdjacentElement('afterend', button);
    element.dataset.streeteasyMapsAddressButton = 'true';
  }

  function updatePrimaryButton() {
    let primaryButton = document.getElementById(`${SCRIPT_ID}-primary`);
    if (!DETAIL_PATH_PATTERN.test(window.location.pathname)) {
      primaryButton?.remove();
      return;
    }

    const addressInfo = findBuildingSectionAddress();
    const address = addressInfo?.address || findStructuredAddress() || titleAddress();
    const href = findExistingMapUrl() || (address ? mapsSearchUrl(address) : '');
    if (!href) {
      primaryButton?.remove();
      return;
    }

    if (!primaryButton) {
      primaryButton = createButton('Open in Google Maps', href);
      primaryButton.id = `${SCRIPT_ID}-primary`;
      document.body.append(primaryButton);
    }

    primaryButton.href = href;
    primaryButton.title = address ? `Open ${address} in Google Maps` : 'Open this listing in Google Maps';
    addAddressButton(addressInfo, href);
  }

  function refresh() {
    addStyles();
    enhanceListingCards();
    updatePrimaryButton();
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, 120);
  }

  refresh();
  new MutationObserver(scheduleRefresh).observe(document.body, { childList: true, subtree: true });
})();
