// ==UserScript==
// @name         StreetEasy: Open in Google Maps
// @namespace    https://github.com/austinpresley/tampermonkey-scripts
// @version      1.0.0
// @description  Adds a StreetEasy-style button that searches Google Maps for the listing's written address.
// @match        https://streeteasy.com/building/*
// @match        https://streeteasy.com/property/*
// @match        https://www.streeteasy.com/building/*
// @match        https://www.streeteasy.com/property/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/austinpresley/tampermonkey-scripts/tree/main/scripts/streeteasy-google-maps
// @supportURL   https://github.com/austinpresley/tampermonkey-scripts/issues
// ==/UserScript==

(() => {
  'use strict';

  const SCRIPT_ID = 'streeteasy-google-maps';
  const ADDRESS_PATTERN = /\b\d{1,6}(?:-\d{1,6})?\s+[A-Za-z0-9.' -]{2,70},\s*[A-Za-z.' -]{2,40},\s*(?:NY|NJ)\s+\d{5}(?:-\d{4})?\b/i;
  let refreshTimer = 0;

  function normalizeText(value) {
    return value?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function mapsSearchUrl(address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  function addStyles() {
    if (document.getElementById(`${SCRIPT_ID}-styles`)) return;

    const style = document.createElement('style');
    style.id = `${SCRIPT_ID}-styles`;
    style.textContent = `
      #${SCRIPT_ID}-button {
        box-sizing: border-box;
        display: flex;
        width: 100%;
        height: 40px;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1px solid #949494;
        border-radius: 0;
        padding: 0 24px;
        color: #0041d9 !important;
        background: #fff;
        font-family: "Source Sans Pro", Helvetica, Arial, Geneva, sans-serif;
        font-size: 14px;
        font-weight: 700;
        line-height: 20px;
        text-decoration: none !important;
        cursor: pointer;
      }

      #${SCRIPT_ID}-button:hover {
        border-color: #0041d9;
        background: #f7f9ff;
      }

      #${SCRIPT_ID}-button:active { background: #edf2ff; }
      #${SCRIPT_ID}-button:focus-visible { outline: 2px solid #0041d9; outline-offset: 2px; }

      #${SCRIPT_ID}-button svg {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
        fill: currentColor;
      }

      #${SCRIPT_ID}-button.${SCRIPT_ID}-address-fallback {
        width: fit-content;
        margin-top: 12px;
      }
    `;
    document.head.append(style);
  }

  function createButton(href) {
    const button = document.createElement('a');
    button.id = `${SCRIPT_ID}-button`;
    button.href = href;
    button.target = '_blank';
    button.rel = 'noopener noreferrer';
    button.setAttribute('aria-label', 'Open this address in Google Maps in a new tab');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 10.25A3.25 3.25 0 1 1 12 5.75a3.25 3.25 0 0 1 0 6.5Z"></path>
      </svg>
      <span>Open in Google Maps</span>
    `;
    return button;
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

  function pageListingTitle() {
    const titlePrefix = normalizeText(document.title.split(' in ')[0]).replace(/^StreetEasy:\s*/i, '');
    return normalizeText(titlePrefix.match(/\bat\s+(.+)$/i)?.[1] || titlePrefix);
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

  function titleAddress() {
    const title = pageListingTitle().replace(/\s+#\S+$/, '');
    const match = title.match(/^\d{1,6}(?:-\d{1,6})?\s+\S.*$/);
    return match ? `${match[0]}, New York metropolitan area` : '';
  }

  function findActionHost() {
    const contactBox = document.querySelector('[data-testid="contactbox-cta"]');
    const contactButton = contactBox
      ? Array.from(contactBox.querySelectorAll('button')).find((button) => /^(?:contact agent|request a tour|ask a question)$/i.test(normalizeText(button.textContent)))
      : null;

    return contactButton?.parentElement ?? null;
  }

  function updateButton() {
    const addressInfo = findBuildingSectionAddress();
    const address = addressInfo?.address || findStructuredAddress() || titleAddress();
    let button = document.getElementById(`${SCRIPT_ID}-button`);

    if (!address) {
      button?.remove();
      return;
    }

    const href = mapsSearchUrl(address);
    const actionHost = findActionHost();
    if (!button) button = createButton(href);

    button.href = href;
    button.title = `Open ${address} in Google Maps`;

    if (actionHost) {
      button.classList.remove(`${SCRIPT_ID}-address-fallback`);
      if (button.parentElement !== actionHost) actionHost.append(button);
      return;
    }

    if (addressInfo?.element) {
      button.classList.add(`${SCRIPT_ID}-address-fallback`);
      if (button.previousElementSibling !== addressInfo.element) {
        addressInfo.element.insertAdjacentElement('afterend', button);
      }
    }
  }

  function refresh() {
    addStyles();
    updateButton();
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, 120);
  }

  refresh();
  new MutationObserver(scheduleRefresh).observe(document.body, { childList: true, subtree: true });
})();
