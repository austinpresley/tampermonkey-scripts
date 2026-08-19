// ==UserScript==
// @name         Depop Gallery Zoom
// @namespace    https://depop.com/
// @version      1.0.1
// @description  A clean, full-screen image viewer with zoom, pan, thumbnails, and gallery navigation for Depop listings.
// @author       Austin Presley
// @match        https://www.depop.com/*
// @match        https://depop.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=depop.com
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/austinpresley/tampermonkey-scripts/tree/main/scripts/depop-gallery-zoom
// @supportURL   https://github.com/austinpresley/tampermonkey-scripts/issues
// ==/UserScript==

(() => {
  'use strict';

  if (window.__depopGalleryZoomInstalled) return;
  window.__depopGalleryZoomInstalled = true;

  const ID = 'depop-gallery-zoom';
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 6;
  const CLICK_ZOOM = 2.5;

  const state = {
    open: false,
    images: [],
    index: 0,
    scale: 1,
    panX: 0,
    panY: 0,
    pointers: new Map(),
    pinch: null,
    dragging: false,
    moved: false,
    dragStartX: 0,
    dragStartY: 0,
    startPanX: 0,
    startPanY: 0,
    previousFocus: null,
    pageOverflow: '',
    pagePaddingRight: '',
    toastTimer: 0,
  };

  let ui = null;

  const icon = (name) => {
    const paths = {
      close: '<path d="M6 6l12 12M18 6 6 18"/>',
      prev: '<path d="m15 18-6-6 6-6"/>',
      next: '<path d="m9 18 6-6-6-6"/>',
      minus: '<path d="M5 12h14"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  };

  function createUI() {
    if (ui) return ui;

    const style = document.createElement('style');
    style.id = `${ID}-styles`;
    style.textContent = `
      #${ID} {
        --dpz-panel: rgba(24, 24, 27, .72);
        --dpz-panel-strong: rgba(17, 17, 19, .9);
        --dpz-border: rgba(255, 255, 255, .14);
        --dpz-muted: rgba(255, 255, 255, .64);
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: none;
        overflow: hidden;
        color: #fff;
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1;
        isolation: isolate;
      }

      #${ID}[data-open="true"] { display: block; }

      #${ID}, #${ID} * { box-sizing: border-box; }

      #${ID} .dpz-backdrop {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 50% 42%, rgba(55, 55, 60, .58), transparent 58%),
          rgba(8, 8, 10, .965);
        backdrop-filter: blur(18px) saturate(.8);
      }

      #${ID} .dpz-stage {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        overflow: hidden;
        outline: none;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
      }

      #${ID} .dpz-image {
        display: block;
        max-width: calc(100vw - 152px);
        max-height: calc(100vh - 156px);
        width: auto;
        height: auto;
        object-fit: contain;
        transform: translate3d(0, 0, 0) scale(1);
        transform-origin: center center;
        cursor: zoom-in;
        will-change: transform, opacity;
        -webkit-user-drag: none;
        filter: drop-shadow(0 20px 50px rgba(0, 0, 0, .34));
      }

      #${ID} .dpz-image.dpz-animate { transition: transform 170ms cubic-bezier(.2, .75, .2, 1); }
      #${ID} .dpz-image.dpz-switching { opacity: .18; transition: opacity 90ms ease; }
      #${ID}[data-zoomed="true"] .dpz-image { cursor: grab; }
      #${ID}[data-dragging="true"] .dpz-image { cursor: grabbing; }

      #${ID} button {
        appearance: none;
        border: 1px solid var(--dpz-border);
        margin: 0;
        padding: 0;
        color: #fff;
        background: var(--dpz-panel);
        font: inherit;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        backdrop-filter: blur(18px) saturate(1.15);
      }

      #${ID} button:hover { background: rgba(55, 55, 60, .86); }
      #${ID} button:active { transform: scale(.96); }
      #${ID} button:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

      #${ID} .dpz-round-button {
        position: absolute;
        z-index: 3;
        display: grid;
        width: 46px;
        height: 46px;
        place-items: center;
        border-radius: 999px;
        transition: background 130ms ease, transform 130ms ease, opacity 130ms ease;
      }

      #${ID} .dpz-round-button svg,
      #${ID} .dpz-tool svg {
        width: 21px;
        height: 21px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      #${ID} .dpz-close { top: 18px; right: 20px; }
      #${ID} .dpz-prev { left: 20px; top: 50%; transform: translateY(-50%); }
      #${ID} .dpz-next { right: 20px; top: 50%; transform: translateY(-50%); }
      #${ID} .dpz-prev:active,
      #${ID} .dpz-next:active { transform: translateY(-50%) scale(.96); }

      #${ID}[data-single="true"] .dpz-prev,
      #${ID}[data-single="true"] .dpz-next { display: none; }

      #${ID} .dpz-counter {
        position: absolute;
        z-index: 3;
        top: 21px;
        left: 22px;
        min-width: 58px;
        padding: 11px 14px;
        border: 1px solid var(--dpz-border);
        border-radius: 999px;
        background: var(--dpz-panel);
        color: rgba(255, 255, 255, .86);
        text-align: center;
        font-size: 12px;
        font-weight: 650;
        letter-spacing: .04em;
        backdrop-filter: blur(18px) saturate(1.15);
      }

      #${ID} .dpz-toolbar {
        position: absolute;
        z-index: 3;
        top: 18px;
        left: 50%;
        display: flex;
        height: 46px;
        align-items: center;
        padding: 4px;
        border: 1px solid var(--dpz-border);
        border-radius: 999px;
        background: var(--dpz-panel);
        transform: translateX(-50%);
        backdrop-filter: blur(18px) saturate(1.15);
      }

      #${ID} .dpz-tool {
        display: grid;
        width: 36px;
        height: 36px;
        place-items: center;
        border: 0;
        border-radius: 999px;
        background: transparent;
        backdrop-filter: none;
      }

      #${ID} .dpz-zoom-value {
        width: 62px;
        height: 36px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: rgba(255, 255, 255, .84);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        font-weight: 650;
      }

      #${ID} .dpz-filmstrip-wrap {
        position: absolute;
        z-index: 3;
        right: 18px;
        bottom: 16px;
        left: 18px;
        display: flex;
        justify-content: center;
        pointer-events: none;
      }

      #${ID} .dpz-filmstrip {
        display: flex;
        max-width: min(720px, calc(100vw - 36px));
        gap: 7px;
        overflow-x: auto;
        padding: 7px;
        border: 1px solid var(--dpz-border);
        border-radius: 16px;
        background: var(--dpz-panel-strong);
        scrollbar-width: none;
        pointer-events: auto;
        backdrop-filter: blur(20px) saturate(1.12);
        box-shadow: 0 14px 44px rgba(0, 0, 0, .3);
      }

      #${ID} .dpz-filmstrip::-webkit-scrollbar { display: none; }

      #${ID} .dpz-thumb {
        position: relative;
        flex: 0 0 58px;
        width: 58px;
        height: 58px;
        overflow: hidden;
        border: 0;
        border-radius: 10px;
        background: #202024;
        opacity: .5;
        transition: opacity 130ms ease, box-shadow 130ms ease, transform 130ms ease;
      }

      #${ID} .dpz-thumb:hover { opacity: .82; }
      #${ID} .dpz-thumb[aria-current="true"] {
        opacity: 1;
        box-shadow: inset 0 0 0 2px #fff;
      }

      #${ID} .dpz-thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        pointer-events: none;
      }

      #${ID} .dpz-spinner {
        position: absolute;
        z-index: 1;
        width: 30px;
        height: 30px;
        border: 2px solid rgba(255, 255, 255, .16);
        border-top-color: rgba(255, 255, 255, .85);
        border-radius: 50%;
        opacity: 0;
        animation: dpz-spin .7s linear infinite;
        pointer-events: none;
      }

      #${ID}[data-loading="true"] .dpz-spinner { opacity: 1; }
      @keyframes dpz-spin { to { transform: rotate(360deg); } }

      #${ID} .dpz-toast {
        position: absolute;
        z-index: 5;
        left: 50%;
        bottom: 102px;
        padding: 10px 13px;
        border: 1px solid var(--dpz-border);
        border-radius: 999px;
        background: rgba(20, 20, 22, .88);
        color: rgba(255, 255, 255, .82);
        font-size: 12px;
        opacity: 0;
        transform: translate(-50%, 8px);
        transition: opacity 150ms ease, transform 150ms ease;
        pointer-events: none;
        backdrop-filter: blur(16px);
      }

      #${ID} .dpz-toast[data-show="true"] {
        opacity: 1;
        transform: translate(-50%, 0);
      }

      #${ID} .dpz-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      img[data-depop-gallery-zoom="true"] { cursor: zoom-in !important; }

      @media (max-width: 700px) {
        #${ID} .dpz-image {
          max-width: 100vw;
          max-height: calc(100vh - 130px);
        }
        #${ID} .dpz-close { top: 12px; right: 12px; }
        #${ID} .dpz-counter { top: 15px; left: 12px; }
        #${ID} .dpz-toolbar { top: auto; bottom: 91px; }
        #${ID} .dpz-prev { left: 10px; }
        #${ID} .dpz-next { right: 10px; }
        #${ID} .dpz-round-button { width: 42px; height: 42px; }
        #${ID} .dpz-filmstrip-wrap { right: 8px; bottom: 8px; left: 8px; }
        #${ID} .dpz-filmstrip { max-width: calc(100vw - 16px); }
        #${ID} .dpz-thumb { flex-basis: 52px; width: 52px; height: 52px; }
        #${ID} .dpz-toast { bottom: 146px; }
      }

      @media (prefers-reduced-motion: reduce) {
        #${ID} *, #${ID} *::before, #${ID} *::after {
          scroll-behavior: auto !important;
          transition-duration: .001ms !important;
          animation-duration: .001ms !important;
          animation-iteration-count: 1 !important;
        }
      }
    `;

    const root = document.createElement('div');
    root.id = ID;
    root.dataset.open = 'false';
    root.dataset.zoomed = 'false';
    root.dataset.dragging = 'false';
    root.dataset.loading = 'false';
    root.dataset.single = 'false';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Depop product image viewer');
    root.innerHTML = `
      <div class="dpz-backdrop"></div>
      <div class="dpz-stage" tabindex="-1" aria-label="Zoomable product image">
        <div class="dpz-spinner" aria-hidden="true"></div>
        <img class="dpz-image" alt="" draggable="false">
      </div>

      <div class="dpz-counter" aria-hidden="true">1 / 1</div>

      <div class="dpz-toolbar" aria-label="Zoom controls">
        <button class="dpz-tool" data-action="zoom-out" type="button" aria-label="Zoom out" title="Zoom out (−)">
          ${icon('minus')}
        </button>
        <button class="dpz-zoom-value" data-action="reset" type="button" aria-label="Reset zoom" title="Reset zoom (0)">100%</button>
        <button class="dpz-tool" data-action="zoom-in" type="button" aria-label="Zoom in" title="Zoom in (+)">
          ${icon('plus')}
        </button>
      </div>

      <button class="dpz-round-button dpz-close" data-action="close" type="button" aria-label="Close viewer" title="Close (Esc)">
        ${icon('close')}
      </button>
      <button class="dpz-round-button dpz-prev" data-action="prev" type="button" aria-label="Previous image" title="Previous image (←)">
        ${icon('prev')}
      </button>
      <button class="dpz-round-button dpz-next" data-action="next" type="button" aria-label="Next image" title="Next image (→)">
        ${icon('next')}
      </button>

      <div class="dpz-filmstrip-wrap">
        <div class="dpz-filmstrip" role="list" aria-label="Product images"></div>
      </div>

      <div class="dpz-toast" role="status"></div>
      <div class="dpz-sr-only" aria-live="polite"></div>
    `;

    document.head.appendChild(style);
    document.body.appendChild(root);

    ui = {
      root,
      stage: root.querySelector('.dpz-stage'),
      image: root.querySelector('.dpz-image'),
      close: root.querySelector('.dpz-close'),
      counter: root.querySelector('.dpz-counter'),
      zoomValue: root.querySelector('.dpz-zoom-value'),
      filmstrip: root.querySelector('.dpz-filmstrip'),
      toast: root.querySelector('.dpz-toast'),
      live: root.querySelector('.dpz-sr-only'),
    };

    root.addEventListener('click', onControlClick);
    ui.stage.addEventListener('wheel', onWheel, { passive: false });
    ui.image.addEventListener('pointerdown', onPointerDown);
    ui.image.addEventListener('pointermove', onPointerMove);
    ui.image.addEventListener('pointerup', onPointerEnd);
    ui.image.addEventListener('pointercancel', onPointerEnd);
    ui.image.addEventListener('load', onImageLoad);
    ui.image.addEventListener('error', onImageError);
    window.addEventListener('resize', onResize, { passive: true });

    return ui;
  }

  function isProductPage() {
    return /^\/products\/[^/]+\/?/.test(location.pathname);
  }

  function isDepopPhoto(url) {
    try {
      return /(^|\.)depop\.com$/i.test(new URL(url, location.href).hostname);
    } catch {
      return false;
    }
  }

  function isGalleryImage(image) {
    if (!(image instanceof HTMLImageElement) || !isProductPage()) return false;
    if (image.closest(`#${ID}`)) return false;

    const source = image.currentSrc || image.src || '';
    if (!isDepopPhoto(source)) return false;

    // Recommendation cards link to another /products/ page; the listing's own
    // gallery images do not. This keeps clicks below the listing untouched.
    if (image.closest('a[href*="/products/"]')) return false;

    const alt = image.alt || '';
    const looksLikeListingPhoto = /^item listed by\b/i.test(alt);
    const inKnownGallery = Boolean(
      image.closest('[class*="desktopViewContainer"], [class*="imageContainer"]')
    );

    return looksLikeListingPhoto || inKnownGallery;
  }

  function markGalleryImages(root = document) {
    if (!isProductPage()) return;
    const images = [];

    if (root instanceof HTMLImageElement) images.push(root);
    if (root.querySelectorAll) images.push(...root.querySelectorAll('img'));

    for (const image of images) {
      if (isGalleryImage(image)) image.dataset.depopGalleryZoom = 'true';
    }
  }

  function bestSource(image) {
    const candidates = [];

    if (image.srcset) {
      for (const candidate of image.srcset.split(',')) {
        const [url, descriptor = '0w'] = candidate.trim().split(/\s+/);
        const width = Number.parseInt(descriptor, 10) || 0;
        if (url) candidates.push({ url, width });
      }
    }

    if (image.currentSrc) candidates.push({ url: image.currentSrc, width: image.naturalWidth || 0 });
    if (image.src) candidates.push({ url: image.src, width: image.naturalWidth || 0 });

    candidates.sort((a, b) => b.width - a.width);
    return candidates[0]?.url || '';
  }

  function originalDepopSource(source) {
    if (!source) return source;
    return source.replace(/\/P\d+\.(jpe?g|png|webp)(\?.*)?$/i, '/P0.$1$2');
  }

  function thumbnailSource(source) {
    return source.replace(/\/P\d+\.(jpe?g|png|webp)(\?.*)?$/i, '/P2.$1$2');
  }

  function collectGalleryImages() {
    const main = document.querySelector('main') || document.body;
    const seen = new Set();
    const result = [];

    for (const image of main.querySelectorAll('img')) {
      if (!isGalleryImage(image)) continue;

      const fallback = bestSource(image);
      const full = originalDepopSource(fallback);
      if (!full) continue;

      const key = full.split('?')[0];
      if (seen.has(key)) continue;
      seen.add(key);

      result.push({
        element: image,
        full,
        fallback,
        thumb: thumbnailSource(fallback),
        alt: image.alt || `Product image ${result.length + 1}`,
      });
    }

    return result;
  }

  function openViewer(clickedImage) {
    createUI();

    const images = collectGalleryImages();
    if (!images.length) return;

    const clickedSource = originalDepopSource(bestSource(clickedImage)).split('?')[0];
    const clickedIndex = images.findIndex((item) =>
      item.element === clickedImage || item.full.split('?')[0] === clickedSource
    );

    state.images = images;
    state.index = clickedIndex >= 0 ? clickedIndex : 0;
    state.open = true;
    state.previousFocus = document.activeElement;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    state.pageOverflow = document.documentElement.style.overflow;
    state.pagePaddingRight = document.documentElement.style.paddingRight;
    document.documentElement.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.documentElement.style.paddingRight = `${scrollbarWidth}px`;

    ui.root.dataset.open = 'true';
    ui.root.dataset.single = String(images.length < 2);
    renderThumbnails();
    showImage(state.index, false);

    requestAnimationFrame(() => ui.close.focus({ preventScroll: true }));
  }

  function closeViewer() {
    if (!state.open) return;

    state.open = false;
    state.pointers.clear();
    state.pinch = null;
    state.dragging = false;
    ui.root.dataset.open = 'false';
    ui.root.dataset.dragging = 'false';
    document.documentElement.style.overflow = state.pageOverflow;
    document.documentElement.style.paddingRight = state.pagePaddingRight;

    if (state.previousFocus instanceof HTMLElement) {
      state.previousFocus.focus({ preventScroll: true });
    }
  }

  function renderThumbnails() {
    ui.filmstrip.replaceChildren();

    state.images.forEach((item, index) => {
      const button = document.createElement('button');
      button.className = 'dpz-thumb';
      button.type = 'button';
      button.dataset.action = 'image';
      button.dataset.index = String(index);
      button.setAttribute('role', 'listitem');
      button.setAttribute('aria-label', `View image ${index + 1}`);

      const image = document.createElement('img');
      image.src = item.thumb;
      image.alt = '';
      image.loading = 'eager';
      button.appendChild(image);
      ui.filmstrip.appendChild(button);
    });
  }

  function showImage(index, announce = true) {
    if (!state.images.length) return;

    state.index = (index + state.images.length) % state.images.length;
    const item = state.images[state.index];

    resetTransform(false);
    ui.root.dataset.loading = 'true';
    ui.image.classList.add('dpz-switching');
    ui.image.dataset.fallbackTried = 'false';
    ui.image.alt = item.alt;
    ui.image.src = item.full;

    updateUI(announce, true);
    preloadNeighbors();
  }

  function onImageLoad() {
    if (!ui || !state.open) return;
    ui.root.dataset.loading = 'false';
    requestAnimationFrame(() => ui.image.classList.remove('dpz-switching'));
    clampPan();
    renderTransform(false);
  }

  function onImageError() {
    if (!state.open) return;
    const item = state.images[state.index];

    if (ui.image.dataset.fallbackTried === 'false' && item.fallback !== item.full) {
      ui.image.dataset.fallbackTried = 'true';
      ui.image.src = item.fallback;
      return;
    }

    ui.root.dataset.loading = 'false';
    showToast('Could not load this image');
  }

  function preloadNeighbors() {
    if (state.images.length < 2) return;
    const indexes = [
      (state.index + 1) % state.images.length,
      (state.index - 1 + state.images.length) % state.images.length,
    ];

    for (const index of new Set(indexes)) {
      const preloader = new Image();
      preloader.src = state.images[index].full;
    }
  }

  function updateUI(announce = false, scrollThumbnail = false) {
    const percent = Math.round(state.scale * 100);
    ui.counter.textContent = `${state.index + 1} / ${state.images.length}`;
    ui.zoomValue.textContent = `${percent}%`;
    ui.root.dataset.zoomed = String(state.scale > 1.001);

    const thumbs = ui.filmstrip.querySelectorAll('.dpz-thumb');
    thumbs.forEach((thumb, index) => {
      thumb.setAttribute('aria-current', String(index === state.index));
    });

    if (scrollThumbnail) {
      const activeThumb = thumbs[state.index];
      activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    if (announce) {
      ui.live.textContent = `Image ${state.index + 1} of ${state.images.length}, zoom ${percent} percent`;
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampPan() {
    if (!ui || state.scale <= 1) {
      state.panX = 0;
      state.panY = 0;
      return;
    }

    const stageWidth = ui.stage.clientWidth;
    const stageHeight = ui.stage.clientHeight;
    const imageWidth = ui.image.offsetWidth * state.scale;
    const imageHeight = ui.image.offsetHeight * state.scale;
    const maxX = Math.max(0, (imageWidth - stageWidth) / 2);
    const maxY = Math.max(0, (imageHeight - stageHeight) / 2);

    state.panX = clamp(state.panX, -maxX, maxX);
    state.panY = clamp(state.panY, -maxY, maxY);
  }

  function renderTransform(animate = false) {
    ui.image.classList.toggle('dpz-animate', animate);
    ui.image.style.transform = `translate3d(${state.panX}px, ${state.panY}px, 0) scale(${state.scale})`;
    updateUI(false, false);

    if (animate) {
      window.setTimeout(() => ui?.image.classList.remove('dpz-animate'), 190);
    }
  }

  function setScale(nextScale, anchorX, anchorY, animate = true) {
    const oldScale = state.scale;
    const next = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(next - oldScale) < 0.001) return;

    const stageRect = ui.stage.getBoundingClientRect();
    const stageCenterX = stageRect.left + stageRect.width / 2;
    const stageCenterY = stageRect.top + stageRect.height / 2;
    const pointX = Number.isFinite(anchorX) ? anchorX : stageCenterX;
    const pointY = Number.isFinite(anchorY) ? anchorY : stageCenterY;
    const ratio = next / oldScale;

    state.panX = pointX - stageCenterX - (pointX - stageCenterX - state.panX) * ratio;
    state.panY = pointY - stageCenterY - (pointY - stageCenterY - state.panY) * ratio;
    state.scale = next;
    clampPan();
    renderTransform(animate);
  }

  function resetTransform(animate = true) {
    state.scale = 1;
    state.panX = 0;
    state.panY = 0;
    if (ui) renderTransform(animate);
  }

  function stepImage(direction) {
    if (state.images.length < 2) return;
    showImage(state.index + direction);
  }

  function onControlClick(event) {
    const button = event.target.closest('button[data-action]');

    if (!button) {
      if (event.target === ui.stage) closeViewer();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    switch (button.dataset.action) {
      case 'close': closeViewer(); break;
      case 'prev': stepImage(-1); break;
      case 'next': stepImage(1); break;
      case 'zoom-in': setScale(state.scale + 0.5); break;
      case 'zoom-out': setScale(state.scale - 0.5); break;
      case 'reset': resetTransform(); break;
      case 'image': {
        const nextIndex = Number(button.dataset.index);
        if (nextIndex === state.index) resetTransform();
        else showImage(nextIndex);
        break;
      }
    }
  }

  function onWheel(event) {
    if (!state.open) return;
    event.preventDefault();

    const factor = Math.exp(-event.deltaY * 0.0015);
    setScale(state.scale * factor, event.clientX, event.clientY, false);
  }

  function pointerDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pointerMidpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function beginSinglePointer(point, alreadyMoved = false) {
    state.dragging = true;
    state.moved = alreadyMoved;
    state.dragStartX = point.x;
    state.dragStartY = point.y;
    state.startPanX = state.panX;
    state.startPanY = state.panY;
    ui.root.dataset.dragging = 'true';
  }

  function onPointerDown(event) {
    if (!state.open || event.button > 0) return;
    event.preventDefault();
    ui.image.setPointerCapture?.(event.pointerId);
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (state.pointers.size === 1) {
      beginSinglePointer({ x: event.clientX, y: event.clientY });
    } else if (state.pointers.size === 2) {
      const [a, b] = [...state.pointers.values()];
      state.dragging = false;
      state.pinch = {
        distance: pointerDistance(a, b),
        scale: state.scale,
        panX: state.panX,
        panY: state.panY,
        midpoint: pointerMidpoint(a, b),
      };
    }
  }

  function onPointerMove(event) {
    if (!state.pointers.has(event.pointerId)) return;
    event.preventDefault();
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (state.pinch && state.pointers.size >= 2) {
      const [a, b] = [...state.pointers.values()];
      const midpoint = pointerMidpoint(a, b);
      const distance = pointerDistance(a, b);
      const nextScale = clamp(
        state.pinch.scale * (distance / Math.max(1, state.pinch.distance)),
        MIN_ZOOM,
        MAX_ZOOM
      );

      const rect = ui.stage.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const localX = (state.pinch.midpoint.x - centerX - state.pinch.panX) / state.pinch.scale;
      const localY = (state.pinch.midpoint.y - centerY - state.pinch.panY) / state.pinch.scale;

      state.scale = nextScale;
      state.panX = midpoint.x - centerX - localX * nextScale;
      state.panY = midpoint.y - centerY - localY * nextScale;
      state.moved = true;
      clampPan();
      renderTransform(false);
      return;
    }

    if (!state.dragging) return;
    const dx = event.clientX - state.dragStartX;
    const dy = event.clientY - state.dragStartY;
    if (Math.hypot(dx, dy) > 5) state.moved = true;

    if (state.scale > 1) {
      state.panX = state.startPanX + dx;
      state.panY = state.startPanY + dy;
      clampPan();
      renderTransform(false);
    }
  }

  function onPointerEnd(event) {
    if (!state.pointers.has(event.pointerId)) return;
    const endingPoint = state.pointers.get(event.pointerId);
    state.pointers.delete(event.pointerId);

    if (event.type === 'pointercancel') {
      state.pinch = null;
      state.dragging = false;
      state.pointers.clear();
      ui.root.dataset.dragging = 'false';
      return;
    }

    if (state.pinch) {
      state.pinch = null;
      if (state.pointers.size === 1) beginSinglePointer([...state.pointers.values()][0], true);
      else ui.root.dataset.dragging = 'false';
      return;
    }

    if (!state.dragging) return;
    const dx = endingPoint.x - state.dragStartX;
    const dy = endingPoint.y - state.dragStartY;

    if (state.scale === 1 && state.moved && Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      stepImage(dx < 0 ? 1 : -1);
    } else if (!state.moved) {
      if (state.scale > 1.001) resetTransform();
      else setScale(CLICK_ZOOM, endingPoint.x, endingPoint.y);
    }

    state.dragging = false;
    ui.root.dataset.dragging = 'false';
  }

  function onResize() {
    if (!state.open) return;
    clampPan();
    renderTransform(false);
  }

  function showToast(message) {
    if (!ui) return;
    window.clearTimeout(state.toastTimer);
    ui.toast.textContent = message;
    ui.toast.dataset.show = 'true';
    state.toastTimer = window.setTimeout(() => {
      if (ui) ui.toast.dataset.show = 'false';
    }, 1800);
  }

  document.addEventListener('click', (event) => {
    if (state.open || event.defaultPrevented || event.button > 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const image = event.target.closest?.('img');
    if (!isGalleryImage(image)) return;

    event.preventDefault();
    event.stopPropagation();
    openViewer(image);
  }, true);

  document.addEventListener('mouseover', (event) => {
    const image = event.target.closest?.('img');
    if (isGalleryImage(image)) image.dataset.depopGalleryZoom = 'true';
  }, true);

  document.addEventListener('keydown', (event) => {
    if (!state.open) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        closeViewer();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        stepImage(-1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        stepImage(1);
        break;
      case '+':
      case '=':
        event.preventDefault();
        setScale(state.scale + 0.5);
        break;
      case '-':
      case '_':
        event.preventDefault();
        setScale(state.scale - 0.5);
        break;
      case '0':
        event.preventDefault();
        resetTransform();
        break;
    }
  }, true);

  markGalleryImages();

  let scanQueued = false;
  const observer = new MutationObserver(() => {
    if (scanQueued || !isProductPage()) return;
    scanQueued = true;

    requestAnimationFrame(() => {
      scanQueued = false;
      markGalleryImages(document);
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
