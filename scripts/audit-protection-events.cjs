'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('extension/protection-events.js', 'utf8');
const backgroundSource = fs.readFileSync('extension/background.js', 'utf8');
const sitePageSource = fs.readFileSync('extension/site-protection.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'));
const context = vm.createContext({ URL, Date, Map, Object, Number, String });
vm.runInContext(source, context);
assert.ok(manifest.permissions.includes('webRequest'));
assert.ok(manifest.permissions.includes('notifications'));
assert.match(backgroundSource, /searchParams\.set\('eventClass', eventClass\)/,
  'known event class is passed to the existing site protection page');
assert.match(backgroundSource, /site-protection\.html/,
  'notification click uses the existing site protection surface');
assert.match(sitePageSource, /document\.getElementById\('event-context'\)/,
  'the existing panel renders the observed event context');

const currentTabs = new Map([
  [1, { id: 1, windowId: 7, url: 'https://a.example/page', active: true }],
  [2, { id: 2, windowId: 7, url: 'https://b.example/', active: true }],
  [3, { id: 3, windowId: 7, url: 'https://private.example/', incognito: true }],
  [4, { id: 4, windowId: 7, url: 'https://container.example/', cookieStoreId: 'firefox-container-1' }]
]);
const created = [];
const cleared = [];
const opened = [];
const listeners = { webRequest: null, clicked: null, closed: null };
const browser = {
  tabs: { async get(id) { if (!currentTabs.has(id)) throw new Error('tab missing'); return currentTabs.get(id); } },
  runtime: { getURL(path) { return 'moz-extension://filum/' + path; } },
  webRequest: { onErrorOccurred: { addListener(listener, filter) {
    listeners.webRequest = listener;
    assert.deepEqual(JSON.parse(JSON.stringify(filter)), { urls: ['<all_urls>'] });
  } } },
  notifications: {
    async create(id, options) { created.push({ id, options }); return id; },
    async clear(id) { cleared.push(id); return true; },
    onClicked: { addListener(listener) { listeners.clicked = listener; } },
    onClosed: { addListener(listener) { listeners.closed = listener; } }
  }
};
let clock = 1000;
const controller = context.FilumProtectionEvents.create({
  browser,
  now: () => clock,
  openSiteProtection: async details => opened.push(details)
});
for (const [error, expected] of [
  ['NS_ERROR_TRACKING_URI', 'tracking'],
  ['NS_ERROR_SOCIALTRACKING_URI', 'social-tracking'],
  ['NS_ERROR_EMAILTRACKING_URI', 'email-tracking'],
  ['NS_ERROR_FINGERPRINTING', 'fingerprinting'],
  ['NS_ERROR_CRYPTOMINING_URI', 'cryptomining'],
  ['NS_ERROR_MALWARE_URI', 'malware'],
  ['NS_ERROR_PHISHING_URI', 'phishing'],
  ['NS_ERROR_BLOCKED_URI', 'content-blocking'],
  ['NS_ERROR_UNWANTED_URI', 'unwanted-software'],
  ['NS_ERROR_HARMFUL_URI', 'harmful-content']
]) {
  assert.equal(context.FilumProtectionEvents.classifyError(error), expected, 'known Gecko classifier error: ' + error);
}
assert.equal(context.FilumProtectionEvents.classifyError('NS_ERROR_NET_TIMEOUT'), null,
  'ordinary network failures have no protection class');

const blockedA = {
  requestId: 'a1', tabId: 1, frameId: 0, type: 'xmlhttprequest',
  documentUrl: 'https://a.example/page', originUrl: 'https://a.example/page',
  url: 'https://tracker.example/collect', error: 'NS_ERROR_TRACKING_URI'
};

(async () => {
  assert.equal(typeof listeners.webRequest, 'function', 'Gecko WebRequest event listener is wired');
  assert.equal(await controller.handle(blockedA), true, 'known classifier block signals site A');
  assert.equal(created.length, 1);
  assert.equal(created[0].options.title, 'FILUM · protezione tracciamento');
  assert.doesNotMatch(created[0].options.message, /a\.example|tracker\.example/,
    'system notification does not expose page or request host');

  assert.equal(await controller.handle({ ...blockedA, requestId: 'a2' }), false,
    'duplicate block within cooldown does not spam');
  assert.equal(created.length, 1);

  assert.equal(await controller.handle({ ...blockedA, tabId: 2 }), false,
    'site A document context cannot notify site B tab');
  assert.equal(await controller.handle({ ...blockedA, tabId: 3 }), false,
    'private/incognito tabs are excluded');
  assert.equal(await controller.handle({ ...blockedA, tabId: 4 }), false,
    'unsupported container tabs are excluded');
  assert.equal(await controller.handle({ ...blockedA, error: 'NS_ERROR_NET_TIMEOUT' }), false,
    'ordinary network failure is not presented as a protection block');
  assert.equal(await controller.handle({ ...blockedA, frameId: 2 }), false,
    'third-party frame event is not attributed to the top-level site');
  assert.equal(await controller.handle({ ...blockedA, type: 'main_frame' }), false,
    'blocked navigation is not attributed as a loaded page');
  assert.equal(created.length, 1, 'no reliable event means no notification');

  await listeners.clicked(created[0].id);
  assert.deepEqual(JSON.parse(JSON.stringify(opened[0])), {
    tabId: 1, windowId: 7, origin: 'https://a.example', eventClass: 'tracking'
  }, 'notification click opens the existing site panel for the exact origin and class');

  clock += 91_000;
  assert.equal(await controller.handle(blockedA), true, 'cooldown expires');
  assert.equal(created.length, 2);
  currentTabs.set(1, { ...currentTabs.get(1), url: 'https://b.example/changed' });
  await listeners.clicked(created[1].id);
  assert.equal(opened.length, 1, 'stale tab origin cannot open the previous site panel');

  currentTabs.set(1, { ...currentTabs.get(1), url: 'https://a.example/page' });
  clock += 91_000;
  assert.equal(await controller.handle({ ...blockedA, requestId: 'a3', url: 'https://tracker2.example/x' }), true);
  const pendingId = created[2].id;
  controller.clearTab(1);
  assert.ok(cleared.includes(pendingId), 'closing or leaving a site clears its transient notification');
  console.log('Classifier event mapping, origin isolation, cooldown, no-false-signal, click routing, stale tab, and cleanup: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
