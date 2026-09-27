const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const listeners = {};
const tabs = [
  { id: 1, active: true, discarded: false, lastAccessed: 100 },
  { id: 2, active: false, discarded: false, pinned: true, lastAccessed: 10 },
  { id: 3, active: false, discarded: false, audible: true, lastAccessed: 20 },
  { id: 4, active: false, discarded: false, lastAccessed: 90 },
  { id: 5, active: false, discarded: false, lastAccessed: 80 },
  { id: 6, active: false, discarded: false, lastAccessed: 70 }
];
const storage = {};
const session = {};
const rules = new Set(['ads_basic']);
let alarmActive = false;
let torAlarmActive = false;
let panelOpensOnActionClick = false;
let proxyConfig = { mode: 'system' };
let proxyControls = false;
let torCheckValid = true;
let torConfigRequests = 0;
const event = () => ({ addListener(fn) { this.listener = fn; } });
const chrome = {
  sidePanel: { async setPanelBehavior(value) { panelOpensOnActionClick = value.openPanelOnActionClick; } },
  storage: { local: {
    async get(defaults) { return { ...defaults, ...storage }; },
    async set(values) { Object.assign(storage, values); }
  }, session: {
    async get(key) { return { [key]: session[key] }; },
    async set(values) { Object.assign(session, values); },
    async remove(key) { delete session[key]; }
  } },
  proxy: { settings: {
    async get() { return { value: proxyConfig, levelOfControl: proxyControls ? 'controlled_by_this_extension' : 'controllable_by_this_extension' }; },
    async set({ value }) { proxyConfig = value; proxyControls = true; },
    async clear() { proxyConfig = { mode: 'system' }; proxyControls = false; }
  } },
  webRequest: { onAuthRequired: event(), onCompleted: event(), onErrorOccurred: event() },
  declarativeNetRequest: {
    async getEnabledRulesets() { return [...rules]; },
    async updateEnabledRulesets({ enableRulesetIds, disableRulesetIds }) {
      enableRulesetIds.forEach(id => rules.add(id));
      disableRulesetIds.forEach(id => rules.delete(id));
    }
  },
  tabs: {
    async query() { return tabs; },
    async discard(id) { const tab = tabs.find(t => t.id === id); tab.discarded = true; return tab; },
    onActivated: { addListener(fn) { listeners.activated = fn; } },
    onUpdated: { addListener(fn) { listeners.updated = fn; } }
  },
  alarms: {
    async create(name) { if (name === 'filum-turbo') alarmActive = true; if (name === 'filum-tor-check') torAlarmActive = true; },
    async clear(name) { if (name === 'filum-turbo') alarmActive = false; if (name === 'filum-tor-check') torAlarmActive = false; },
    onAlarm: { addListener(fn) { listeners.alarm = fn; } }
  },
  runtime: {
    onMessage: { addListener(fn) { listeners.message = fn; } },
    onStartup: { addListener(fn) { listeners.startup = fn; } },
    onInstalled: { addListener(fn) { listeners.installed = fn; } }
  }
};
async function fetchMock(url) {
  if (url.startsWith('https://goodextensions.mooo.com/')) {
    torConfigRequests++;
    return { ok: true, async json() { return { url: 'relay.example.net', aun: 'user', aup: 'secret' }; } };
  }
  if (url === 'https://check.torproject.org/api/ip') {
    return { ok: true, async json() { return { IsTor: torCheckValid, IP: '203.0.113.1' }; } };
  }
  throw new Error('Unexpected request: ' + url);
}
vm.runInNewContext(fs.readFileSync(__dirname + '/worker.js', 'utf8'), {
  chrome, console, fetch: fetchMock, AbortController,
  setTimeout, clearTimeout, crypto: { randomUUID: () => 'filum-test-client-id' }, Math
});
function message(request) {
  return new Promise(resolve => listeners.message(request, {}, resolve));
}
(async () => {
  await Promise.resolve();
  assert.equal(panelOpensOnActionClick, true);
  assert.equal((await message({ type: 'status' })).data.mode, 'NORMAL');
  let result = await message({ type: 'mode', mode: 'TURBO' });
  assert.equal(result.ok, true);
  assert.equal(alarmActive, true);
  assert.equal(tabs.find(t => t.id === 6).discarded, true);
  assert.equal(tabs.find(t => t.id === 2).discarded, false);
  assert.equal(tabs.find(t => t.id === 3).discarded, false);
  result = await message({ type: 'ads', enabled: false });
  assert.equal(result.data.adsEnabled, false);
  result = await message({ type: 'mode', mode: 'GHOST' });
  assert.equal(result.ok, false);
  assert.equal(storage.mode, 'TURBO');
  result = await message({ type: 'mode', mode: 'NORMAL' });
  assert.equal(result.data.mode, 'NORMAL');
  assert.equal(alarmActive, false);
  assert.equal((await message({ type: 'status' })).data.tor.active, false);
  result = await message({ type: 'tor-connect' });
  assert.equal(result.ok, true);
  assert.equal(result.data.tor.verified, true);
  assert.equal(torAlarmActive, true);
  assert.equal(result.data.tor.ip, '203.0.113.1');
  assert.equal(torConfigRequests, 1);
  assert.equal(proxyConfig.mode, 'pac_script');
  assert.match(proxyConfig.pacScript.data, /HTTPS relay\.example\.net:443/);
  let credentials;
  chrome.webRequest.onAuthRequired.listener({ isProxy: true, requestId: 'one', challenger: { host: 'relay.example.net' } }, response => { credentials = response; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(credentials.authCredentials.username, 'user');
  chrome.webRequest.onAuthRequired.listener({ isProxy: true, requestId: 'one', challenger: { host: 'relay.example.net' } }, response => { credentials = response; });
  assert.equal(credentials.authCredentials, undefined);
  torCheckValid = false;
  listeners.alarm({ name: 'filum-tor-check' });
  result = await message({ type: 'status' });
  assert.equal(result.data.tor.active, true, 'temporary Tor verification failure must preserve proxy');
  assert.equal(result.data.tor.verified, false, 'temporary failure must clear confirmed status');
  assert.equal(proxyControls, true, 'automatic check must not disconnect the proxy');
  result = await message({ type: 'tor-refresh' });
  assert.equal(result.data.tor.active, true, 'panel refresh must preserve proxy on temporary failure');
  assert.match(result.data.torError, /non confermata/);
  torCheckValid = true;
  result = await message({ type: 'tor-connect' });
  assert.equal(result.data.tor.verified, true);
  torCheckValid = false;
  result = await message({ type: 'tor-refresh' });
  assert.equal(result.data.tor.active, true, 'opening panel must preserve proxy during a failed check');
  assert.equal(result.data.tor.verified, false, 'opening panel must not reuse stale ON');
  assert.match(result.data.torError, /non confermata/);
  assert.equal(proxyControls, true);
  torCheckValid = true;
  result = await message({ type: 'tor-connect' });
  assert.equal(result.data.tor.verified, true);
  result = await message({ type: 'tor-disconnect' });
  assert.equal(result.data.tor.active, false);
  assert.equal(proxyControls, false);
  assert.equal(torAlarmActive, false);
  assert.equal(session.filumTorSession, undefined);
  torCheckValid = false;
  result = await message({ type: 'tor-connect' });
  assert.equal(result.ok, false);
  assert.equal(proxyControls, false, 'failed verification must release proxy');
  assert.equal(session.filumTorSession, undefined);
  console.log('Chromium extension state and discard test passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });