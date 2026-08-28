// ==UserScript==
// @name         Facebook Marketplace: Saved items in sidebar
// @namespace    https://github.com/austinpresley/tampermonkey-scripts
// @version      1.0.1
// @description  Adds a Saved items shortcut to the Facebook Marketplace sidebar.
// @match        https://www.facebook.com/marketplace/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/austinpresley/tampermonkey-scripts/tree/main/scripts/facebook-marketplace-saved-sidebar
// @supportURL   https://github.com/austinpresley/tampermonkey-scripts/issues
// ==/UserScript==

(() => {
  'use strict';

  const ITEM_ATTRIBUTE = 'data-facebook-marketplace-saved-sidebar';
  const LABEL = 'Saved items';
  const MARKETPLACE_PATH = '/marketplace';
  const SAVED_PATH = '/saved/';
  const SAVED_URL = `${SAVED_PATH}?dashboard_section=PRODUCTS`;

  let renderQueued = false;

  function normalizedPath(pathname) {
    return pathname.replace(/\/+$/, '') || '/';
  }

  function linkUrl(link) {
    try {
      return new URL(link.getAttribute('href'), location.href);
    } catch {
      return null;
    }
  }

  function isVisibleSidebarLink(link) {
    if (link.closest('[aria-hidden="true"]')) return false;

    const rectangles = link.getClientRects();
    if (!rectangles.length) return false;

    const rectangle = link.getBoundingClientRect();
    const sidebarLimit = Math.min(window.innerWidth * 0.45, 480);
    if (rectangle.width < 120 || rectangle.height < 24) return false;
    if (rectangle.right <= 0 || rectangle.left >= sidebarLimit) return false;
    if (rectangle.bottom <= 0 || rectangle.top >= window.innerHeight) return false;

    const style = getComputedStyle(link);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function findSidebarLink(pathname, includeNestedPaths = false) {
    const targetPath = normalizedPath(pathname);

    return Array.from(document.querySelectorAll('a[href]')).find((link) => {
      const url = linkUrl(link);
      const pathnameMatches = url && (
        normalizedPath(url.pathname) === targetPath
        || (includeNestedPaths && normalizedPath(url.pathname).startsWith(`${targetPath}/`))
      );
      return url
        && url.origin === location.origin
        && pathnameMatches
        && isVisibleSidebarLink(link);
    }) || null;
  }

  function isProductSavesLink(link) {
    const url = linkUrl(link);
    return Boolean(
      url
      && url.origin === location.origin
      && normalizedPath(url.pathname) === normalizedPath(SAVED_PATH)
      && url.searchParams.get('dashboard_section') === 'PRODUCTS'
      && isVisibleSidebarLink(link)
    );
  }

  function directChildLink(element) {
    if (element.matches('a[href]')) return element;
    return element.querySelector('a[href]');
  }

  function findMenuRow(link) {
    let row = link;
    let parent = link.parentElement;

    for (let depth = 0; parent && depth < 5; depth += 1) {
      const linkedChildren = Array.from(parent.children).filter(directChildLink);
      if (linkedChildren.length > 1) return row;

      row = parent;
      parent = parent.parentElement;
    }

    return link;
  }

  function correspondingLink(sourceRow, clonedRow, sourceLink) {
    if (sourceRow === sourceLink) return clonedRow;

    const sourceLinks = Array.from(sourceRow.querySelectorAll('a[href]'));
    const clonedLinks = Array.from(clonedRow.querySelectorAll('a[href]'));
    return clonedLinks[sourceLinks.indexOf(sourceLink)] || clonedLinks[0] || null;
  }

  function removeIds(element) {
    element.removeAttribute('id');
    for (const descendant of element.querySelectorAll('[id]')) {
      descendant.removeAttribute('id');
    }
  }

  function replaceLabel(link, oldLabel) {
    const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.trim()) textNodes.push(walker.currentNode);
    }

    let replacements = 0;
    for (const textNode of textNodes) {
      if (textNode.nodeValue.trim() !== oldLabel) continue;
      textNode.nodeValue = textNode.nodeValue.replace(oldLabel, LABEL);
      replacements += 1;
    }

    if (!replacements && textNodes.length) {
      const textNode = textNodes[textNodes.length - 1];
      textNode.nodeValue = textNode.nodeValue.replace(textNode.nodeValue.trim(), LABEL);
    }
  }

  function bookmarkIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.style.width = '20px';
    svg.style.height = '20px';
    svg.style.display = 'block';
    svg.style.fill = 'currentColor';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M6.75 2h10.5A1.75 1.75 0 0 1 19 3.75v17.5a.75.75 0 0 1-1.19.61L12 17.7l-5.81 4.16A.75.75 0 0 1 5 21.25V3.75A1.75 1.75 0 0 1 6.75 2Z');
    svg.append(path);

    return svg;
  }

  function replaceIcon(link) {
    const icon = link.querySelector('i[aria-hidden="true"], i[data-visualcompletion], svg[aria-hidden="true"], img[aria-hidden="true"]');
    if (icon) icon.replaceWith(bookmarkIcon());
  }

  function makeSavedRow(sourceLink) {
    const sourceRow = findMenuRow(sourceLink);
    const clonedRow = sourceRow.cloneNode(true);
    const clonedLink = correspondingLink(sourceRow, clonedRow, sourceLink);
    if (!clonedLink) return null;

    const oldLabel = (sourceLink.innerText || sourceLink.textContent || '').trim();

    removeIds(clonedRow);
    clonedRow.setAttribute(ITEM_ATTRIBUTE, '');
    clonedLink.setAttribute('href', SAVED_URL);
    clonedLink.setAttribute('aria-label', LABEL);
    clonedLink.removeAttribute('aria-current');
    clonedLink.querySelectorAll('[aria-current]').forEach((element) => {
      element.removeAttribute('aria-current');
    });
    if (clonedLink.hasAttribute('title')) clonedLink.setAttribute('title', LABEL);

    replaceLabel(clonedLink, oldLabel);
    replaceIcon(clonedLink);

    return { clonedRow, sourceRow };
  }

  function render() {
    renderQueued = false;

    const installedRows = Array.from(document.querySelectorAll(`[${ITEM_ATTRIBUTE}]`));
    if (!normalizedPath(location.pathname).startsWith(MARKETPLACE_PATH)) {
      installedRows.forEach((row) => row.remove());
      return;
    }

    if (installedRows.some((row) => row.isConnected)) return;
    if (Array.from(document.querySelectorAll('a[href]')).some(isProductSavesLink)) return;

    const sellingLink = findSidebarLink('/marketplace/you/selling');
    const browseLink = findSidebarLink('/marketplace');
    const createListingLink = findSidebarLink('/marketplace/create', true);
    const referenceLink = sellingLink || browseLink || createListingLink;
    if (!referenceLink) return;

    const savedRow = makeSavedRow(referenceLink);
    if (!savedRow) return;

    if (sellingLink || createListingLink) savedRow.sourceRow.after(savedRow.clonedRow);
    else savedRow.sourceRow.before(savedRow.clonedRow);
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(render);
  }

  const observer = new MutationObserver(queueRender);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('resize', queueRender, { passive: true });
  window.addEventListener('popstate', queueRender);
  queueRender();
})();
