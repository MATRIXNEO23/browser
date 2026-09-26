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
const rules = new Set(['ads_basic']);
let alarmActive = false;
let panelOpensOnActionClick = false;
const chrome = {
  sidePanel: { async setPanelBehavior(value) { panelOpensOnActionClick = value.openPanelOnActionClick; } },
  storage: { local: {
    async get(defaults) { return { ...defaults, ...storage }; },
    async set(values) { Object.assign(storage, values); }
  } },
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
    async create() { alarmActive = true; },
    async clear() { alarmActive = false; },
    onAlarm: { addListener(fn) { listeners.alarm = fn; } }
  },
  runtime: {
    onMessage: { addListener(fn) { listeners.message = fn; } },
    onStartup: { addListener(fn) { listeners.startup = fn; } }
  }
};
vm.runInNewContext(fs.readFileSync(__dirname + '/worker.js', 'utf8'), { chrome, console });
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
  console.log('Chromium extension state and discard test passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
