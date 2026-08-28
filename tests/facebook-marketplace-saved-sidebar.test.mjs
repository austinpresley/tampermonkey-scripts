import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const userscript = await readFile(
  new URL('../scripts/facebook-marketplace-saved-sidebar/facebook-marketplace-saved-sidebar.user.js', import.meta.url),
  'utf8',
);

const desktopRectangle = {
  left: 16,
  right: 344,
  top: 190,
  bottom: 228,
  width: 328,
  height: 38,
};

function marketplaceWindow(html) {
  const window = new Window({
    url: 'https://www.facebook.com/marketplace/search/?query=weird',
  });
  window.document.body.innerHTML = html;

  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  window.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  window.getComputedStyle = () => ({
    display: 'flex',
    visibility: 'visible',
    opacity: '1',
  });

  for (const link of window.document.querySelectorAll('a')) {
    link.getClientRects = () => [desktopRectangle];
    link.getBoundingClientRect = () => desktopRectangle;
  }

  return window;
}

async function runUserscript(window) {
  window.eval(userscript);
  await window.happyDOM.waitUntilComplete();
  await Promise.resolve();
}

test('adds Saved items below Create new listing on Marketplace search results', async () => {
  const window = marketplaceWindow(`
    <aside aria-label="Marketplace">
      <h1>Search results</h1>
      <input aria-label="Search Marketplace" value="weird">
      <div class="action"><button type="button">Notify Me</button></div>
      <div class="action">
        <a href="/marketplace/create/item/">
          <span class="icon"><i aria-hidden="true" data-visualcompletion="css-img"></i></span>
          <span>Create new listing</span>
        </a>
      </div>
      <hr>
      <h2>Filters</h2>
    </aside>
  `);

  await runUserscript(window);

  const savedRow = window.document.querySelector('[data-facebook-marketplace-saved-sidebar]');
  assert.ok(savedRow, 'Saved items should appear on search-results pages');
  assert.equal(savedRow.previousElementSibling?.textContent.trim(), 'Create new listing');
  const savedLink = savedRow.matches('a') ? savedRow : savedRow.querySelector('a');
  assert.equal(savedLink?.pathname, '/saved/');
});
