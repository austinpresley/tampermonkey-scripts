import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import nodeTest from 'node:test';
import { Window } from 'happy-dom';

const userscript = await readFile(
  new URL(
    '../scripts/facebook-marketplace-buyer-workspace/facebook-marketplace-buyer-workspace.user.js',
    import.meta.url,
  ),
  'utf8',
);

test('limits Saved-page injection to the products section', () => {
  assert.match(
    userscript,
    /^\/\/ @include\s+https:\/\/www\.facebook\.com\/saved\/\*dashboard_section=PRODUCTS\*/m,
  );
  assert.doesNotMatch(userscript, /^\/\/ @match\s+https:\/\/www\.facebook\.com\/saved\/\*/m);
});

const desktopRectangle = {
  left: 16,
  right: 344,
  top: 140,
  bottom: 180,
  width: 328,
  height: 40,
};

const testWindows = new AsyncLocalStorage();

function test(name, callback) {
  return nodeTest(name, (context) =>
    testWindows.run([], async () => {
      try {
        return await callback(context);
      } finally {
        for (const window of testWindows.getStore()) window.close();
      }
    }));
}

function copy(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function createStorage(initialValues = {}) {
  return new Map(Object.entries(initialValues).map(([key, value]) => [key, copy(value)]));
}

function facebookWindow(url, html, storage = createStorage()) {
  const window = new Window({ url });
  testWindows.getStore()?.push(window);
  window.document.body.innerHTML = html;

  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 0);
  window.cancelAnimationFrame = (timer) => window.clearTimeout(timer);
  window.confirm = () => true;
  window.prompt = () => null;
  window.alert = () => {};

  window.HTMLElement.prototype.getClientRects = function getClientRects() {
    if (this.hidden || this.style.display === 'none') return [];
    return [desktopRectangle];
  };
  window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return desktopRectangle;
  };

  window.GM_getValue = (key, fallback) =>
    storage.has(key) ? copy(storage.get(key)) : copy(fallback);
  window.GM_setValue = (key, value) => {
    storage.set(key, copy(value));
  };
  window.GM_deleteValue = (key) => {
    storage.delete(key);
  };

  return { window, storage };
}

async function settle(milliseconds = 60) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
  await Promise.resolve();
}

async function waitFor(assertion, { timeout = 3000, interval = 25 } = {}) {
  const deadline = Date.now() + timeout;
  let lastError;

  do {
    try {
      return assertion();
    } catch (error) {
      lastError = error;
      await settle(interval);
    }
  } while (Date.now() < deadline);

  throw lastError;
}

async function runUserscript(window) {
  window.eval(userscript);
  await settle();
}

function marketplaceSidebar() {
  return `
    <aside aria-label="Marketplace">
      <h1>Marketplace</h1>
      <nav aria-label="Marketplace shortcuts">
        <a href="/marketplace/">Browse all</a>
        <a href="/marketplace/notifications/">Notifications</a>
        <a href="/marketplace/create/item/">Create new listing</a>
      </nav>
      <h2>Filters</h2>
    </aside>
  `;
}

function liveMarketplaceSidebar() {
  return `
    <div role="navigation" aria-label="Marketplace sidebar">
      <h1>Marketplace</h1>
      <input role="combobox" aria-label="Search Marketplace">
      <div class="native-rows">
        <div><div><a href="/marketplace/">Browse all</a></div></div>
        <div><div><a href="/marketplace/you/">Buying</a></div></div>
        <div><div><a href="/marketplace/you/saved/">Saved</a></div></div>
        <div><div><a href="/marketplace/create/item/">Create new listing</a></div></div>
      </div>
    </div>
  `;
}

function savedSidebar() {
  return `
    <aside aria-label="Saved">
      <h1>Saved</h1>
      <nav aria-label="Saved categories">
        <a href="/saved/?dashboard_section=ALL">All</a>
        <a href="/saved/?dashboard_section=PRODUCTS" aria-current="page">Products</a>
      </nav>
    </aside>
  `;
}

function listing({ id, title, price = '$100', location = 'Boston, Massachusetts', labels = [] }) {
  const details = labels.map((label) => `<span>${label}</span>`).join('');
  return `
    <article data-fixture-listing-id="${id}" aria-label="Marketplace listing: ${title}">
      <a href="/marketplace/item/${id}/?ref=search&amp;tracking=feed">
        <img alt="${title} in ${location}" src="https://example.test/${id}.jpg">
        <span>${price}</span>
        <span>${title}</span>
        <span>${location}</span>
        ${details}
      </a>
    </article>
  `;
}

function liveDivListing({ id, title, label, labelMarkup = '', labelOutsideLink = false }) {
  const renderedLabel = labelMarkup || `<span>${label}</span>`;
  const labelInsideLink = labelOutsideLink ? '' : renderedLabel;
  const labelOutside = labelOutsideLink ? renderedLabel : '';
  return `
    <div data-live-listing-id="${id}">
      <div><span><div><div><div><div>
        <a
          role="link"
          aria-label="${title}, $100, , listing ${id}"
          href="/marketplace/item/${id}/?ref=browse_tab"
        >
          <div>
            <img alt="${title} in " src="https://example.test/${id}.jpg">
            <span>$100</span><span>${title}</span>${labelInsideLink}
          </div>
        </a>
      </div></div></div></div></span></div>${labelOutside}
    </div>
  `;
}

function resultsPage(listings) {
  return `
    ${marketplaceSidebar()}
    <main>
      <h1>Marketplace results</h1>
      <section aria-label="Marketplace results">${listings.join('')}</section>
    </main>
  `;
}

function card(window, id) {
  const element = window.document.querySelector(`[data-fixture-listing-id="${id}"]`);
  assert.ok(element, `expected listing ${id} in the fixture`);
  return element;
}

function accessibleName(element) {
  return (element.getAttribute('aria-label') || element.textContent || '').trim();
}

function elementNamed(root, selector, name) {
  const match = [...root.querySelectorAll(selector)].find((element) => name.test(accessibleName(element)));
  assert.ok(match, `expected ${selector} named ${name}`);
  return match;
}

function buttonNamed(root, name) {
  return elementNamed(root, 'button, [role="button"]', name);
}

function controlNamed(root, name) {
  const ariaControl = [...root.querySelectorAll('input, select, textarea')].find((element) =>
    name.test(element.getAttribute('aria-label') || ''),
  );
  if (ariaControl) return ariaControl;

  const label = [...root.querySelectorAll('label')].find((element) => name.test(element.textContent || ''));
  const control = label?.control || (label?.htmlFor ? root.querySelector(`#${label.htmlFor}`) : null);
  assert.ok(control, `expected a control labelled ${name}`);
  return control;
}

async function setControl(window, control, value) {
  control.value = value;
  control.dispatchEvent(new window.Event('input', { bubbles: true }));
  control.dispatchEvent(new window.Event('change', { bubbles: true }));
  await settle(260);
}

async function setCheckbox(window, control, checked) {
  control.checked = checked;
  control.dispatchEvent(new window.Event('change', { bubbles: true }));
  await settle(260);
}

function reasonText(listingCard) {
  return [...listingCard.querySelectorAll('[data-fbmw-reason]')]
    .map((element) => element.textContent.trim())
    .filter(Boolean)
    .join(' ');
}

function isDimmed(listingCard) {
  const ownOpacity = Number.parseFloat(listingCard.style.opacity);
  const linkOpacity = Number.parseFloat(listingCard.querySelector('a')?.style.opacity || '');
  return (
    listingCard.getAttribute('data-fbmw-dimmed') === 'true' ||
    (Number.isFinite(ownOpacity) && ownOpacity > 0 && ownOpacity < 1) ||
    (Number.isFinite(linkOpacity) && linkOpacity > 0 && linkOpacity < 1)
  );
}

function assertDimmed(listingCard, reason) {
  assert.equal(listingCard.hidden, false, 'dimmed listings stay in the result list');
  assert.notEqual(listingCard.style.display, 'none', 'dimmed listings stay available for review');
  assert.ok(isDimmed(listingCard), 'listing has a visible dimmed state');
  assert.match(reasonText(listingCard), reason);
}

function assertNotDimmed(listingCard) {
  assert.equal(isDimmed(listingCard), false, 'listing is not dimmed');
  assert.equal(reasonText(listingCard), '', 'listing has no filter reason');
}

function listingAction(listingCard, name) {
  return buttonNamed(listingCard, name);
}

async function setDisposition(window, listingCard, value) {
  await setControl(window, controlNamed(listingCard, /buyer status/i), value);
}

function assertDisposition(listingCard, expected) {
  assert.equal(controlNamed(listingCard, /buyer status/i).value, expected);
}

function assertPressed(button, expected = true) {
  assert.equal(button.getAttribute('aria-pressed'), String(expected));
}

function isHidden(listingCard) {
  return (
    listingCard.hidden ||
    listingCard.style.display === 'none' ||
    listingCard.getAttribute('data-fbmw-hidden') === 'true'
  );
}

test('adds the buyer workspace and Saved shortcut to the Marketplace sidebar', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    resultsPage([listing({ id: '1001', title: 'Canon camera' })]),
  );

  await runUserscript(window);

  const sidebar = window.document.querySelector('aside[aria-label="Marketplace"]');
  const workspace = sidebar.querySelector('[data-fbmw-workspace]');
  assert.ok(workspace, 'the workspace belongs to the native Marketplace sidebar');
  assert.match(workspace.textContent, /Buyer workspace/i);
  assert.ok(controlNamed(workspace, /filter.*listings/i));

  const savedLink = elementNamed(sidebar, 'a', /^Saved items$/i);
  assert.equal(savedLink.pathname, '/saved/');
  assert.equal(new URL(savedLink.href).searchParams.get('dashboard_section'), 'PRODUCTS');
  assert.equal(sidebar.querySelectorAll('[data-fbmw-workspace]').length, 1);
});

test('starts compact and persists the expanded workspace state', async () => {
  const storage = createStorage();
  const fixture = resultsPage([listing({ id: '1003', title: 'Canon camera' })]);
  const firstRun = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    fixture,
    storage,
  );
  await runUserscript(firstRun.window);

  const firstBody = firstRun.window.document.querySelector('[data-fbmw-panel-body]');
  assert.equal(firstBody.hidden, true);
  buttonNamed(firstRun.window.document, /expand buyer workspace/i).click();
  await settle();
  assert.equal(firstBody.hidden, false);

  const secondRun = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    fixture,
    storage,
  );
  await runUserscript(secondRun.window);
  assert.equal(secondRun.window.document.querySelector('[data-fbmw-panel-body]').hidden, false);
});

test('mounts in the current Marketplace navigation region without relying on an aside', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    `${liveMarketplaceSidebar()}<main><section aria-label="Marketplace results">${listing({ id: '1002', title: 'Canon camera' })}</section></main>`,
  );

  await runUserscript(window);

  const sidebar = window.document.querySelector('[role="navigation"][aria-label="Marketplace sidebar"]');
  assert.ok(sidebar.querySelector('[data-fbmw-workspace]'));
  assert.equal(window.document.querySelectorAll('[data-fbmw-launcher]').length, 0);
  assert.equal(
    sidebar.querySelectorAll('a[href*="/marketplace/you/saved/"]').length,
    1,
    'the native Marketplace Saved row is reused instead of duplicated',
  );
  assert.equal(sidebar.querySelectorAll('a[href^="/saved/"]').length, 0);
});

test('dims sponsored and shipped listings by default and labels the reasons', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    resultsPage([
      listing({ id: '1101', title: 'Promoted camera', labels: ['Sponsored'] }),
      listing({ id: '1102', title: 'Shipped camera', labels: ['Ships to you'] }),
      listing({ id: '1103', title: 'Local camera' }),
      listing({ id: '1104', title: 'Dealer camera', labels: ['Ad'] }),
    ]),
  );

  await runUserscript(window);

  assertDimmed(card(window, '1101'), /Sponsored/i);
  assertDimmed(card(window, '1102'), /Ship(?:s|ping)/i);
  assertNotDimmed(card(window, '1103'));
  assertDimmed(card(window, '1104'), /Sponsored|Ad/i);
});

test('dims signals inside Facebook div-based listing cards', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/',
    `${marketplaceSidebar()}<main><section aria-label="Marketplace results">
      ${liveDivListing({ id: '1104', title: 'Delivered camera', label: 'Ships to you' })}
      ${liveDivListing({
        id: '1105',
        title: 'Promoted camera',
        label: 'Sponsored',
        labelOutsideLink: true,
      })}
      ${liveDivListing({ id: '1106', title: 'Sponsored camera stand', label: 'Atlanta, GA' })}
      ${liveDivListing({
        id: '1108',
        title: 'Nested delivery label',
        label: 'Ships to you',
        labelMarkup: '<span>Ships <span>to you</span></span>',
      })}
    </section></main>`,
  );

  await runUserscript(window);

  const delivered = window.document
    .querySelector('[data-live-listing-id="1104"] a')
    .closest('[data-fbmw-card]');
  const promoted = window.document
    .querySelector('[data-live-listing-id="1105"] a')
    .closest('[data-fbmw-card]');
  const ordinary = window.document
    .querySelector('[data-live-listing-id="1106"] a')
    .closest('[data-fbmw-card]');
  const nestedDelivery = window.document
    .querySelector('[data-live-listing-id="1108"] a')
    .closest('[data-fbmw-card]');
  assert.ok(delivered, 'current Facebook div card is recognized');
  assert.ok(promoted, 'current Facebook div card is recognized');
  assert.ok(ordinary, 'ordinary Facebook div card is recognized');
  assert.ok(nestedDelivery, 'a nested native badge stays recognizable');
  assert.equal(delivered, window.document.querySelector('[data-live-listing-id="1104"]'));
  assert.equal(promoted, window.document.querySelector('[data-live-listing-id="1105"]'));
  assert.equal(
    window.document.querySelector('section[aria-label="Marketplace results"]').hasAttribute('data-fbmw-card'),
    false,
    'the results collection is never treated as one listing card',
  );
  assertDimmed(delivered, /Ship(?:s|ping)/i);
  assertDimmed(promoted, /Sponsored|Ad/i);
  assertDimmed(nestedDelivery, /Ship(?:s|ping)/i);
  assertNotDimmed(ordinary);

  const workspace = window.document.querySelector('[data-fbmw-workspace]');
  await setCheckbox(window, controlNamed(workspace, /dim ships to you/i), false);
  await setCheckbox(window, controlNamed(workspace, /dim sponsored/i), false);
  assertNotDimmed(delivered);
  assertNotDimmed(promoted);
  assertNotDimmed(nestedDelivery);
});

test('does not claim a neutral one-result collection as the listing card', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/',
    `${marketplaceSidebar()}<main>
      <div data-neutral-results>
        ${liveDivListing({ id: '1107', title: 'Local camera', label: 'Atlanta, GA' })}
      </div>
    </main>`,
  );

  await runUserscript(window);

  const anchor = window.document.querySelector('[data-live-listing-id="1107"] a');
  assert.equal(anchor.closest('[data-fbmw-card]'), window.document.querySelector('[data-live-listing-id="1107"]'));
  assert.equal(window.document.querySelector('[data-neutral-results]').hasAttribute('data-fbmw-card'), false);
});

test('uses plain-language filter and hidden-listing controls', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/',
    resultsPage([listing({ id: '1150', title: 'Local camera' })]),
  );
  await runUserscript(window);

  const workspace = window.document.querySelector('[data-fbmw-workspace]');
  elementNamed(workspace, 'summary', /text matching: contains this text/i);
  const matching = controlNamed(workspace, /text matching/i);
  assert.deepEqual(
    [...matching.options].map((option) => option.textContent.trim()),
    ['Contains this text', 'Use AND / OR', 'Regular expression (advanced)'],
  );
  const query = controlNamed(workspace, /filter.*listings|search.*results/i);
  const help = workspace.querySelector(`#${query.getAttribute('aria-describedby')}`);
  assert.match(help?.textContent || '', /same order|matches.*text/i);

  const showHidden = controlNamed(workspace, /include listings hidden by me/i);
  assert.equal(showHidden.type, 'checkbox');
  assert.match(workspace.textContent, /hide from results removes a card until this is turned on/i);

  await setControl(window, matching, 'boolean');
  elementNamed(workspace, 'summary', /text matching: use and \/ or/i);
  assert.match(help.textContent, /use and to require both/i);
});

test('uses an always-visible fixed listing toolbar instead of hover-revealed controls', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/',
    resultsPage([listing({ id: '1151', title: 'Local camera' })]),
  );
  await runUserscript(window);

  const listingCard = card(window, '1151');
  const toolbar = listingCard.querySelector('[data-fbmw-listing-toolbar]');
  assert.ok(toolbar, 'listing toolbar is always present');
  controlNamed(toolbar, /buyer status/i);
  buttonNamed(toolbar, /favorite/i);
  const more = elementNamed(toolbar, 'details', /private note|hide from results/i);
  elementNamed(more, 'summary', /more buyer actions/i);
  controlNamed(toolbar, /private note|note for listing/i);
  buttonNamed(toolbar, /hide from results/i);

  const menuPanel = more.querySelector('.fbmw-listing-menu-panel');
  assert.equal(more.open, false);
  assert.equal(window.getComputedStyle(menuPanel).display, 'none');
  more.open = true;
  assert.equal(window.getComputedStyle(menuPanel).display, 'grid');

  const styles = window.document.querySelector('[data-fbmw-style]').textContent;
  assert.doesNotMatch(styles, /fbmw-listing-actions[^{}]*:hover|data-fbmw-active/);
  assert.match(styles, /fbmw-listing-menu-panel[^{}]*\{[^}]*position:\s*absolute/s);
  assert.match(styles, /\.fbmw-open\s*\{[^}]*background:\s*var\(--fbmw-button\)/s);
});

test('overrides Facebook dark-mode heading and field-label colors', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/',
    resultsPage([listing({ id: '1152', title: 'Local camera' })]),
  );
  window.document.documentElement.style.setProperty('--primary-text', '#e2e5e9');
  window.document.documentElement.style.setProperty('--secondary-text', '#b0b3b8');
  const facebookStyles = window.document.createElement('style');
  facebookStyles.textContent = 'h2 { color: #1c1e21; } label > span { color: #606770; }';
  window.document.head.append(facebookStyles);

  await runUserscript(window);

  const workspace = window.document.querySelector('[data-fbmw-workspace]');
  assert.equal(window.getComputedStyle(workspace.querySelector('h2')).color, '#e2e5e9');
  assert.equal(window.getComputedStyle(workspace.querySelector('label > span')).color, '#e2e5e9');
});

test('filters loaded listings with simple case-insensitive text', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=used',
    resultsPage([
      listing({ id: '1201', title: 'Canon EOS camera' }),
      listing({ id: '1202', title: 'Trek road bicycle' }),
    ]),
  );
  await runUserscript(window);

  const workspace = window.document.querySelector('[data-fbmw-workspace]');
  await setControl(window, controlNamed(workspace, /filter.*listings/i), 'CANON');

  assertNotDimmed(card(window, '1201'));
  assertDimmed(card(window, '1202'), /text|match|filter/i);
});

test('supports plain-language and legacy AND/OR Boolean filters', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=used',
    resultsPage([
      listing({ id: '1301', title: 'Canon mirrorless camera' }),
      listing({ id: '1302', title: 'Trek road bicycle' }),
      listing({ id: '1303', title: 'Oak writing desk' }),
    ]),
  );
  await runUserscript(window);

  const workspace = window.document.querySelector('[data-fbmw-workspace]');
  await setControl(window, controlNamed(workspace, /text matching|filter.*syntax|filter.*mode/i), 'boolean');
  await setControl(
    window,
    controlNamed(workspace, /filter.*listings/i),
    '(canon AND camera) OR bicycle',
  );

  assertNotDimmed(card(window, '1301'));
  assertNotDimmed(card(window, '1302'));
  assertDimmed(card(window, '1303'), /text|match|filter/i);

  await setControl(window, controlNamed(workspace, /filter.*listings/i), '(canon + camera) | bicycle');
  assertNotDimmed(card(window, '1301'));
  assertNotDimmed(card(window, '1302'));
  assertDimmed(card(window, '1303'), /text|match|filter/i);
});

test('supports regular expressions and fails open when the expression is invalid', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    resultsPage([
      listing({ id: '1401', title: 'Canon EOS camera' }),
      listing({ id: '1402', title: 'Nikon Z camera' }),
      listing({ id: '1403', title: 'Trek road bicycle' }),
    ]),
  );
  await runUserscript(window);

  const workspace = window.document.querySelector('[data-fbmw-workspace]');
  const filterInput = controlNamed(workspace, /filter.*listings/i);
  await setControl(window, controlNamed(workspace, /text matching|filter.*syntax|filter.*mode/i), 'regex');
  await setControl(window, filterInput, 'Canon|Nikon');

  assertNotDimmed(card(window, '1401'));
  assertNotDimmed(card(window, '1402'));
  assertDimmed(card(window, '1403'), /text|match|filter/i);

  await setControl(window, filterInput, '[');

  const alert = elementNamed(workspace, '[role="alert"]', /invalid.*regular expression|invalid.*regex/i);
  assert.ok(alert);
  assertNotDimmed(card(window, '1401'));
  assertNotDimmed(card(window, '1402'));
  assertNotDimmed(card(window, '1403'));
});

test('applies allowed and blocked location lists with the block list taking priority', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=furniture',
    resultsPage([
      listing({ id: '1501', title: 'Boston chair', location: 'Boston, Massachusetts' }),
      listing({ id: '1502', title: 'Cambridge table', location: 'Cambridge, Massachusetts' }),
      listing({ id: '1503', title: 'Brooklyn desk', location: 'Brooklyn, New York' }),
      listing({ id: '1504', title: 'Boston table', location: 'Brooklyn, New York' }),
    ]),
  );
  await runUserscript(window);

  const workspace = window.document.querySelector('[data-fbmw-workspace]');
  await setControl(window, controlNamed(workspace, /allowed locations?/i), 'Boston\nCambridge');
  await setControl(window, controlNamed(workspace, /blocked locations?/i), 'Cambridge');

  assertNotDimmed(card(window, '1501'));
  assertDimmed(card(window, '1502'), /blocked location|Cambridge/i);
  assertDimmed(card(window, '1503'), /outside.*location|location.*allow|not allowed/i);
  assertDimmed(card(window, '1504'), /outside.*location|location.*allow|not allowed/i);
});

test('applies excluded terms and local price bounds while leaving unknown prices visible', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    resultsPage([
      listing({ id: '1551', title: 'Canon camera', price: '$75' }),
      listing({ id: '1552', title: 'Broken Nikon camera', price: '$150' }),
      listing({ id: '1553', title: 'Sony camera', price: '$425' }),
      listing({ id: '1554', title: 'Trade-only camera', price: 'Free' }),
    ]),
  );
  await runUserscript(window);

  const workspace = window.document.querySelector('[data-fbmw-workspace]');
  await setControl(window, controlNamed(workspace, /excluded terms?|exclude.*text/i), 'broken');
  await setControl(window, controlNamed(workspace, /minimum price|min price/i), '100');
  await setControl(window, controlNamed(workspace, /maximum price|max price/i), '300');

  assertDimmed(card(window, '1551'), /minimum price|below.*price/i);
  assertDimmed(card(window, '1552'), /excluded.*broken|excluded text/i);
  assertDimmed(card(window, '1553'), /maximum price|above.*price/i);
  assertNotDimmed(card(window, '1554'));
  assert.match(workspace.textContent, /loaded prices.*75.*425|price range.*75.*425/i);
});

test('filters loaded cards by saved buyer state without deleting other records', async () => {
  const storage = createStorage();
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    resultsPage([
      listing({ id: '1571', title: 'Canon camera' }),
      listing({ id: '1572', title: 'Nikon camera' }),
    ]),
    storage,
  );
  await runUserscript(window);

  await setDisposition(window, card(window, '1571'), 'interested');
  const workspace = window.document.querySelector('[data-fbmw-workspace]');
  await setControl(window, controlNamed(workspace, /buyer state|listing state/i), 'interested');

  assertNotDimmed(card(window, '1571'));
  assertDimmed(card(window, '1572'), /buyer state|state filter/i);
  assertDisposition(card(window, '1571'), 'interested');
});

test('distinguishes listings first seen this session from previously seen listings', async () => {
  const storage = createStorage();
  const fixture = resultsPage([
    listing({ id: '1575', title: 'Canon camera' }),
    listing({ id: '1576', title: 'Nikon camera' }),
  ]);
  const firstRun = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    fixture,
    storage,
  );
  await runUserscript(firstRun.window);
  await setControl(
    firstRun.window,
    controlNamed(firstRun.window.document, /buyer state|listing state/i),
    'new',
  );
  assertNotDimmed(card(firstRun.window, '1575'));
  assertNotDimmed(card(firstRun.window, '1576'));

  const secondRun = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    fixture,
    storage,
  );
  await runUserscript(secondRun.window);
  const secondState = controlNamed(secondRun.window.document, /buyer state|listing state/i);
  await setControl(secondRun.window, secondState, 'seen');
  assertNotDimmed(card(secondRun.window, '1575'));
  assertNotDimmed(card(secondRun.window, '1576'));

  const results = secondRun.window.document.querySelector('section[aria-label="Marketplace results"]');
  results.insertAdjacentHTML('beforeend', listing({ id: '1577', title: 'Sony camera' }));
  await waitFor(() => assertDimmed(card(secondRun.window, '1577'), /buyer state|state filter/i));

  await setControl(secondRun.window, secondState, 'new');
  assertDimmed(card(secondRun.window, '1575'), /buyer state|state filter/i);
  assertNotDimmed(card(secondRun.window, '1577'));
});

test('saves, restores, and deletes named buyer views', async () => {
  const storage = createStorage();
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera&minPrice=25',
    resultsPage([
      listing({ id: '1581', title: 'Canon camera' }),
      listing({ id: '1582', title: 'Nikon camera' }),
    ]),
    storage,
  );
  await runUserscript(window);

  const workspace = window.document.querySelector('[data-fbmw-workspace]');
  const query = controlNamed(workspace, /filter.*listings/i);
  await setControl(window, query, 'Canon');
  await setControl(window, controlNamed(workspace, /saved view name|view name/i), 'Camera shortlist');
  buttonNamed(workspace, /save current view/i).click();
  await settle();

  const storedWorkspace = [...storage.values()][0];
  assert.equal(storedWorkspace.savedViews.length, 1);

  const savedViews = controlNamed(workspace, /^saved buyer views$/i);
  const savedOption = [...savedViews.querySelectorAll('option')]
    .find((option) => option.textContent === 'Camera shortlist');
  assert.ok(
    savedOption,
    `saved view control: ${savedViews.outerHTML}`,
  );

  await setControl(window, query, 'Nikon');
  await setControl(window, savedViews, savedOption.value);
  buttonNamed(workspace, /load saved view/i).click();
  await settle();

  assert.equal(query.value, 'Canon');
  assertNotDimmed(card(window, '1581'));
  assertDimmed(card(window, '1582'), /text|match|filter/i);

  buttonNamed(workspace, /delete saved view/i).click();
  await settle();
  assert.equal(
    [...savedViews.querySelectorAll('option')]
      .some((option) => option.textContent === 'Camera shortlist'),
    false,
  );
});

test('processes cards loaded after startup without adding duplicate controls', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    resultsPage([listing({ id: '1601', title: 'Local camera' })]),
  );
  await runUserscript(window);

  const resultSection = window.document.querySelector('section[aria-label="Marketplace results"]');
  resultSection.insertAdjacentHTML(
    'beforeend',
    listing({ id: '1602', title: 'Delivered camera', labels: ['Ships to you'] }),
  );
  const dynamicCard = card(window, '1602');
  await waitFor(() => {
    assertDimmed(dynamicCard, /Ship(?:s|ping)/i);
    assert.equal(dynamicCard.querySelectorAll('[data-fbmw-listing-actions]').length, 1);
  });

  dynamicCard.append(window.document.createTextNode(' '));
  await waitFor(() => {
    assert.equal(dynamicCard.querySelectorAll('[data-fbmw-listing-actions]').length, 1);
    assert.equal(dynamicCard.querySelectorAll('[data-fbmw-reason]').length, 1);
  });
});

test('fails open for uncertain wrappers and prefers a visible duplicate listing card', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    `${marketplaceSidebar()}<main><section aria-label="Marketplace results">
      <div><a href="/marketplace/item/1650/">Uncertain text-only link</a></div>
      <article hidden><a href="/marketplace/item/1651/"><img alt="Hidden duplicate"></a></article>
      ${listing({ id: '1651', title: 'Visible camera' })}
    </section></main>`,
  );

  await runUserscript(window);

  const uncertain = window.document.querySelector('a[href*="/marketplace/item/1650/"]').parentElement;
  assert.equal(uncertain.hasAttribute('data-fbmw-card'), false);
  assert.equal(uncertain.querySelectorAll('[data-fbmw-listing-actions]').length, 0);

  const duplicates = window.document.querySelectorAll('a[href*="/marketplace/item/1651/"]');
  const hiddenDuplicate = duplicates[0].closest('article');
  const visibleDuplicate = duplicates[1].closest('article');
  assert.equal(hiddenDuplicate.hidden, true, 'native hidden state is preserved');
  assert.equal(hiddenDuplicate.hasAttribute('data-fbmw-card'), false);
  assert.equal(hiddenDuplicate.querySelectorAll('[data-fbmw-listing-actions]').length, 0);
  assert.equal(visibleDuplicate.querySelectorAll('[data-fbmw-listing-actions]').length, 1);
});

test('ignores a hidden card until its visible duplicate arrives and then stabilizes', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    `${marketplaceSidebar()}<main><section aria-label="Marketplace results">
      <article hidden><a href="/marketplace/item/1652/"><img alt="Hidden camera"></a></article>
    </section></main>`,
  );
  await runUserscript(window);

  const results = window.document.querySelector('section[aria-label="Marketplace results"]');
  const hiddenCard = results.querySelector('article');
  assert.equal(hiddenCard.querySelectorAll('[data-fbmw-listing-actions]').length, 0);

  results.insertAdjacentHTML('beforeend', listing({ id: '1652', title: 'Visible camera' }));
  await settle(900);
  const visibleCard = results.querySelector('[data-fixture-listing-id="1652"]');
  assert.equal(hiddenCard.querySelectorAll('[data-fbmw-listing-actions]').length, 0);
  assert.equal(visibleCard.querySelectorAll('[data-fbmw-listing-actions]').length, 1);

  visibleCard.append(window.document.createTextNode(' '));
  await settle(900);
  assert.equal(hiddenCard.querySelectorAll('[data-fbmw-listing-actions]').length, 0);
  assert.equal(visibleCard.querySelectorAll('[data-fbmw-listing-actions]').length, 1);
});

test('persists dispositions, favorite, hidden state, and notes by listing ID', async () => {
  const storage = createStorage();
  const fixture = resultsPage([
    listing({ id: '1701', title: 'Canon camera' }),
    listing({ id: '1702', title: 'Nikon camera' }),
    listing({ id: '1703', title: 'Trek bicycle' }),
    listing({ id: '1704', title: 'Oak desk' }),
    listing({ id: '1705', title: 'Floor lamp' }),
  ]);
  const firstRun = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=used',
    fixture,
    storage,
  );
  await runUserscript(firstRun.window);

  await setDisposition(firstRun.window, card(firstRun.window, '1701'), 'interested');
  await setDisposition(firstRun.window, card(firstRun.window, '1702'), 'later');
  await setDisposition(firstRun.window, card(firstRun.window, '1703'), 'pass');
  listingAction(card(firstRun.window, '1704'), /favorite/i).click();
  const note = controlNamed(card(firstRun.window, '1705'), /note/i);
  await setControl(firstRun.window, note, 'Ask whether the shade is included');
  listingAction(card(firstRun.window, '1705'), /hide from results/i).click();
  await settle();

  const secondRun = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=used',
    fixture,
    storage,
  );
  await runUserscript(secondRun.window);

  assertDisposition(card(secondRun.window, '1701'), 'interested');
  assertDisposition(card(secondRun.window, '1702'), 'later');
  assertDisposition(card(secondRun.window, '1703'), 'pass');
  assertPressed(listingAction(card(secondRun.window, '1704'), /favorite/i));
  assert.equal(
    controlNamed(card(secondRun.window, '1705'), /note/i).value,
    'Ask whether the shade is included',
  );
  const noteMenu = card(secondRun.window, '1705').querySelector('.fbmw-listing-menu');
  assert.equal(noteMenu.getAttribute('data-has-note'), 'true');
  assert.match(noteMenu.querySelector('summary').getAttribute('aria-label'), /private note saved/i);
  assert.ok(isHidden(card(secondRun.window, '1705')), 'hidden listings remain hidden after a reload');

  await setCheckbox(
    secondRun.window,
    controlNamed(secondRun.window.document, /include listings hidden by me/i),
    true,
  );
  assert.equal(isHidden(card(secondRun.window, '1705')), false, 'the user can review hidden listings');
  assert.ok(listingAction(card(secondRun.window, '1705'), /unhide/i));
});

test('adds canonical Open links and captures the ordered result snapshot for item navigation', async () => {
  const storage = createStorage();
  const results = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera&minPrice=50',
    resultsPage([
      listing({ id: '1801', title: 'Canon camera' }),
      listing({ id: '1802', title: 'Nikon camera' }),
      listing({ id: '1803', title: 'Sony camera' }),
    ]),
    storage,
  );
  await runUserscript(results.window);

  for (const id of ['1801', '1802', '1803']) {
    const listingCard = card(results.window, id);
    const openLink = listingCard.querySelector('[data-fbmw-open]');
    const originalLink = listingCard.querySelector('a:not([data-fbmw-open])');
    assert.equal(openLink.href, `https://www.facebook.com/marketplace/item/${id}/`);
    assert.equal(new URL(originalLink.href).searchParams.get('ref'), 'search');
    assert.equal(new URL(originalLink.href).searchParams.get('tracking'), 'feed');
  }

  const item = facebookWindow(
    'https://www.facebook.com/marketplace/item/1802/?ref=share_attachment',
    '<main><h1>Nikon camera</h1><input aria-label="Message seller"></main>',
    storage,
  );
  await runUserscript(item.window);

  const navigation = item.window.document.querySelector('[data-fbmw-item-navigation]');
  assert.ok(navigation, 'an item page can use the result order captured before navigation');
  const previous = elementNamed(navigation, 'a', /previous.*listing/i);
  const next = elementNamed(navigation, 'a', /next.*listing/i);
  assert.equal(previous.href, 'https://www.facebook.com/marketplace/item/1801/');
  assert.equal(next.href, 'https://www.facebook.com/marketplace/item/1803/');
  assert.match(navigation.textContent, /2\s*(?:of|\/)\s*3/i);
});

test('item navigation handles arrow keys but leaves typing controls alone', async () => {
  const storage = createStorage();
  const results = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    resultsPage([
      listing({ id: '1901', title: 'Canon camera' }),
      listing({ id: '1902', title: 'Nikon camera' }),
      listing({ id: '1903', title: 'Sony camera' }),
    ]),
    storage,
  );
  await runUserscript(results.window);

  const item = facebookWindow(
    'https://www.facebook.com/marketplace/item/1902/',
    '<main><h1>Nikon camera</h1><input aria-label="Message seller"><div contenteditable="true">Draft</div></main>',
    storage,
  );
  await runUserscript(item.window);

  const input = item.window.document.querySelector('input[aria-label="Message seller"]');
  const inputKey = new item.window.KeyboardEvent('keydown', {
    key: 'ArrowRight',
    bubbles: true,
    cancelable: true,
  });
  input.dispatchEvent(inputKey);
  assert.equal(inputKey.defaultPrevented, false, 'arrow keys keep working while messaging a seller');
  assert.equal(item.window.location.pathname, '/marketplace/item/1902/');

  const bodyKey = new item.window.KeyboardEvent('keydown', {
    key: 'ArrowRight',
    bubbles: true,
    cancelable: true,
  });
  const historyLength = item.window.history.length;
  item.window.document.body.dispatchEvent(bodyKey);
  assert.equal(bodyKey.defaultPrevented, true, 'the item-navigation hotkey handles ArrowRight');
  await settle();
  assert.equal(item.window.location.pathname, '/marketplace/item/1903/');
  assert.equal(item.window.history.length, historyLength, 'adjacent navigation replaces the item entry');
});

test('updates managed Facebook search parameters without dropping unrelated filters', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera&minPrice=25&deliveryMethod=local_pick_up',
    resultsPage([listing({ id: '2001', title: 'Canon camera' })]),
  );
  await runUserscript(window);

  const workspace = window.document.querySelector('[data-fbmw-workspace]');
  await setControl(window, controlNamed(workspace, /marketplace sort|sort by/i), 'creation_time_descend');
  await setControl(window, controlNamed(workspace, /listed within|recency/i), '7');
  await setControl(window, controlNamed(workspace, /delivery method/i), 'shipping');
  await setControl(window, controlNamed(workspace, /item condition|condition/i), 'used_good');
  buttonNamed(workspace, /apply.*search|apply.*filters/i).click();
  await settle();

  assert.equal(window.location.pathname, '/marketplace/search/');
  const currentUrl = new URL(window.location.href);
  assert.equal(currentUrl.searchParams.get('query'), 'camera');
  assert.equal(currentUrl.searchParams.get('minPrice'), '25');
  assert.equal(currentUrl.searchParams.get('sortBy'), 'creation_time_descend');
  assert.equal(currentUrl.searchParams.get('daysSinceListed'), '7');
  assert.equal(currentUrl.searchParams.get('deliveryMethod'), 'shipping');
  assert.equal(currentUrl.searchParams.get('itemCondition'), 'used_good');

  buttonNamed(workspace, /clear URL controls/i).click();
  await settle();
  const clearedUrl = new URL(window.location.href);
  assert.equal(clearedUrl.searchParams.get('sortBy'), null);
  assert.equal(clearedUrl.searchParams.get('daysSinceListed'), null);
  assert.equal(clearedUrl.searchParams.get('deliveryMethod'), null);
  assert.equal(clearedUrl.searchParams.get('itemCondition'), null);
  assert.equal(clearedUrl.searchParams.get('query'), 'camera');
  assert.equal(clearedUrl.searchParams.get('minPrice'), '25');
});

test('does not duplicate the workspace, Saved shortcut, listing actions, or reasons', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    resultsPage([
      listing({ id: '2101', title: 'Promoted camera', labels: ['Sponsored'] }),
    ]),
  );

  await runUserscript(window);
  await runUserscript(window);

  assert.equal(window.document.querySelectorAll('[data-fbmw-workspace]').length, 1);
  assert.equal(window.document.querySelectorAll('[data-fbmw-saved-link]').length, 1);
  assert.equal(card(window, '2101').querySelectorAll('[data-fbmw-listing-actions]').length, 1);
  assert.equal(card(window, '2101').querySelectorAll('[data-fbmw-reason]').length, 1);
});

test('provides a usable launcher when the Marketplace sidebar is missing', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    `<main>
      <h1>Marketplace results</h1>
      <section aria-label="Marketplace results">${listing({ id: '2201', title: 'Canon camera' })}</section>
    </main>`,
  );
  await runUserscript(window);

  const launcher = buttonNamed(window.document, /buyer workspace/i);
  assert.ok(launcher.hasAttribute('data-fbmw-launcher'));
  launcher.click();
  await settle();

  const workspace = window.document.querySelector('[data-fbmw-workspace]');
  assert.ok(workspace, 'the launcher opens the same workspace controls');
  assert.equal(workspace.hidden, false);
  assert.notEqual(workspace.style.display, 'none');
  assert.ok(controlNamed(workspace, /filter.*listings/i));
});

test('adds Back to Marketplace to the Saved products sidebar', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/saved/?dashboard_section=PRODUCTS',
    `${savedSidebar()}<main><h1>Saved items</h1></main>`,
  );
  await runUserscript(window);

  const sidebar = window.document.querySelector('aside[aria-label="Saved"]');
  const backLink = elementNamed(sidebar, 'a', /back to marketplace/i);
  assert.equal(backLink.pathname, '/marketplace/');
  assert.equal(sidebar.querySelectorAll('[data-fbmw-back-link]').length, 1);
});

test('does not modify other Facebook Saved sections', async () => {
  const { window } = facebookWindow(
    'https://www.facebook.com/saved/?dashboard_section=POSTS',
    `${savedSidebar()}<main><h1>Saved posts</h1></main>`,
  );
  await runUserscript(window);

  assert.equal(window.document.querySelectorAll('[data-fbmw-back-link]').length, 0);
  assert.equal(window.document.querySelectorAll('[data-fbmw-workspace]').length, 0);
});

test('reset clears saved buyer decisions after confirmation', async () => {
  const storage = createStorage();
  const fixture = resultsPage([listing({ id: '2301', title: 'Canon camera' })]);
  const firstRun = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    fixture,
    storage,
  );
  await runUserscript(firstRun.window);

  await setDisposition(firstRun.window, card(firstRun.window, '2301'), 'interested');
  await setControl(firstRun.window, controlNamed(card(firstRun.window, '2301'), /note/i), 'Check shutter count');
  firstRun.window.confirm = () => true;
  buttonNamed(firstRun.window.document, /reset.*(?:buyer|workspace).*data/i).click();
  await settle();

  const secondRun = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    fixture,
    storage,
  );
  await runUserscript(secondRun.window);

  assertDisposition(card(secondRun.window, '2301'), '');
  assert.equal(controlNamed(card(secondRun.window, '2301'), /note/i).value, '');
});

test('selectively clears listing decisions without resetting filters or saved views', async () => {
  const storage = createStorage();
  const fixture = resultsPage([listing({ id: '2325', title: 'Canon camera' })]);
  const firstRun = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    fixture,
    storage,
  );
  await runUserscript(firstRun.window);
  const workspace = firstRun.window.document.querySelector('[data-fbmw-workspace]');
  await setControl(firstRun.window, controlNamed(workspace, /filter.*listings/i), 'Canon');
  await setDisposition(firstRun.window, card(firstRun.window, '2325'), 'interested');
  await setControl(firstRun.window, controlNamed(card(firstRun.window, '2325'), /note/i), 'Ask about lens');
  await setControl(firstRun.window, controlNamed(workspace, /saved view name|view name/i), 'Cameras');
  buttonNamed(workspace, /save current view/i).click();
  await settle();

  buttonNamed(workspace, /clear listing (?:decisions|data)/i).click();
  await settle();

  const secondRun = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    fixture,
    storage,
  );
  await runUserscript(secondRun.window);
  const secondWorkspace = secondRun.window.document.querySelector('[data-fbmw-workspace]');
  assertDisposition(card(secondRun.window, '2325'), '');
  assert.equal(controlNamed(card(secondRun.window, '2325'), /note/i).value, '');
  assert.equal(controlNamed(secondWorkspace, /filter.*listings/i).value, 'Canon');
  assert.ok(
    [...controlNamed(secondWorkspace, /^saved buyer views$/i).querySelectorAll('option')]
      .some((option) => option.textContent === 'Cameras'),
  );
});

test('exports and imports settings, buyer records, navigation, and saved views', async () => {
  const sourceStorage = createStorage();
  const fixture = resultsPage([
    listing({ id: '2351', title: 'Canon camera' }),
    listing({ id: '2352', title: 'Nikon camera' }),
  ]);
  const source = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera&minPrice=25',
    fixture,
    sourceStorage,
  );
  await runUserscript(source.window);

  const sourceWorkspace = source.window.document.querySelector('[data-fbmw-workspace]');
  await setControl(source.window, controlNamed(sourceWorkspace, /filter.*listings/i), 'Canon');
  await setDisposition(source.window, card(source.window, '2351'), 'later');
  await setControl(
    source.window,
    controlNamed(sourceWorkspace, /saved view name|view name/i),
    'Camera shortlist',
  );
  buttonNamed(sourceWorkspace, /save current view/i).click();
  await settle();

  let exportedText = '';
  Object.defineProperty(source.window.URL, 'createObjectURL', {
    value: undefined,
    configurable: true,
  });
  source.window.prompt = (_message, value) => {
    exportedText = value;
    return null;
  };
  buttonNamed(sourceWorkspace, /export buyer data/i).click();
  assert.ok(exportedText);
  const payload = JSON.parse(exportedText);
  assert.equal(payload.format, 'facebook-marketplace-buyer-workspace');
  assert.equal(payload.version, 1);
  assert.equal(payload.settings.query, 'Canon');
  assert.equal(payload.listings['2351'].disposition, 'later');
  assert.equal(payload.savedViews[0].name, 'Camera shortlist');
  assert.doesNotMatch(exportedText, /cookie|access[_-]?token|c_user/i);

  const targetStorage = createStorage();
  const target = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera&minPrice=25',
    fixture,
    targetStorage,
  );
  await runUserscript(target.window);
  target.window.prompt = () => exportedText;
  buttonNamed(target.window.document, /import buyer data/i).click();
  await settle();

  const targetWorkspace = target.window.document.querySelector('[data-fbmw-workspace]');
  assert.equal(controlNamed(targetWorkspace, /filter.*listings/i).value, 'Canon');
  assertDisposition(card(target.window, '2351'), 'later');
  assert.ok(
    [...controlNamed(targetWorkspace, /^saved buyer views$/i).querySelectorAll('option')]
      .some((option) => option.textContent === 'Camera shortlist'),
  );
});

test('a rejected import leaves the current buyer data intact', async () => {
  const storage = createStorage();
  const fixture = resultsPage([listing({ id: '2401', title: 'Canon camera' })]);
  const firstRun = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    fixture,
    storage,
  );
  await runUserscript(firstRun.window);

  await setDisposition(firstRun.window, card(firstRun.window, '2401'), 'later');
  await setControl(firstRun.window, controlNamed(card(firstRun.window, '2401'), /note/i), 'Meet on Saturday');
  firstRun.window.prompt = () => '{not valid json';
  buttonNamed(firstRun.window.document, /import.*data/i).click();
  await settle();

  elementNamed(
    firstRun.window.document,
    '[role="alert"]',
    /could not import|invalid.*import|invalid.*json/i,
  );

  const secondRun = facebookWindow(
    'https://www.facebook.com/marketplace/search/?query=camera',
    fixture,
    storage,
  );
  await runUserscript(secondRun.window);

  assertDisposition(card(secondRun.window, '2401'), 'later');
  assert.equal(controlNamed(card(secondRun.window, '2401'), /note/i).value, 'Meet on Saturday');
});
