'use strict';
// Exercises the background's site override transactions with Gecko permission/storage mocks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const policy = require('../extension/policy-engine.js');
const background = fs.readFileSync(path.join(__dirname, '../extension/background.js'), 'utf8');
const start = background.indexOf('function normalizeSiteStore(');
const end = background.indexOf('async function getModeHealth(', start);
assert.ok(start >= 0 && end > start, 'site privacy transaction functions must exist');

const localData = { torEnabled: false };
let sessionData = {};
let failLocalWrite = false;
const tabs = new Map([
  [1, { id: 1, windowId: 7, url: 'https://a.example/path', active: true }],
  [2, { id: 2, windowId: 7, url: 'https://b.example/', active: false }],
  [3, { id: 3, windowId: 7, url: 'https://container.example/', cookieStoreId: 'firefox-container-1', active: false }]
]);
const permissions = new Map();
const permissionKey = (origin, feature) => `${origin}|${feature}`;
function readPermission(origin, feature) {
  return permissions.get(permissionKey(origin, feature)) || { action: 'none', scope: null, expireType: null };
}
function nativeRead(origin) {
  return { origin, permissions: { canvas: readPermission(origin, 'canvas'), tracking: readPermission(origin, 'tracking') } };
}
const browser = {
  storage: {
    local: {
      async get(key) { return typeof key === 'string' ? { [key]: localData[key] } : Object.fromEntries(key.map(k => [k, localData[k]])); },
      async set(value) { if (failLocalWrite) throw new Error('storage write failed'); Object.assign(localData, value); },
      async remove(key) { for (const k of [].concat(key)) delete localData[k]; }
    },
    session: {
      async get(key) { return { [key]: sessionData[key] }; },
      async set(value) { Object.assign(sessionData, value); },
      async remove(key) { for (const k of [].concat(key)) delete sessionData[k]; }
    }
  },
  tabs: {
    async get(id) { if (!tabs.has(id)) throw new Error('missing tab'); return tabs.get(id); },
    async query(query) { return [...tabs.values()].filter(tab => tab.active && tab.windowId === query.windowId); },
    async reload() {}
  },
  browserControl: {
    async getSitePrivacyPermissions(origin) { return nativeRead(origin); },
    async getCanvasAllowPermissionOrigins() { return [...permissions.entries()].filter(([key, v]) => key.endsWith('|canvas') && v.action === 'allow').map(([key, v]) => ({ origin: key.slice(0, -7), expireType: v.expireType })); },
    async setSitePrivacyPermissions(serialized) {
      const req = JSON.parse(serialized);
      for (const change of req.changes) {
        const key = permissionKey(req.origin, change.feature);
        if (change.action === 'remove') permissions.delete(key);
        else permissions.set(key, { action: change.action, scope: change.scope,
          expireType: change.scope === 'session' ? 1 : 2 });
      }
      return nativeRead(req.origin);
    }
  }
};
const maximum = policy.resolve({ level: 'maximum' }, 'GHOST');
const actual = { javascript:'blocked', canvas:'protected', webgl:'blocked', webrtc:'blocked', tracking:'strict', cookies:'third-party-blocked' };
const context = vm.createContext({ browser, FilumPolicyEngine: policy, torStarting: false,
  SITE_OVERRIDES_KEY: 'filumSitePrivacyOverrides', SITE_SESSION_KEY: 'filumSitePrivacySessionOverrides',
  queueControlTransition: async action => action(), URL, Date,
  async getMode() { return 'GHOST'; },
  async getPrivacyPolicyStatus() { return { ...maximum, manualLevel: true, features: Object.fromEntries(Object.entries(maximum.features).map(([k,v]) => [k,{...v,actual:actual[k]}])) }; }
});
vm.runInContext(background.slice(start, end), context);

(async () => {
  let a = await context.siteStatus(undefined, 1, 7);
  assert.equal(a.overrideScope, null);
  failLocalWrite = true;
  await assert.rejects(context.setSiteOverride(1, 'https://a.example', 7,
    { level: 'normal', scope: 'persistent' }), /storage write failed/);
  failLocalWrite = false;
  assert.equal(readPermission('https://a.example', 'canvas').action, 'none',
    'failed profile persistence must roll back newly applied Gecko permissions');
  await context.setSiteOverride(1, 'https://a.example', 7, { level: 'normal', scope: 'persistent' });
  a = await context.siteStatus(undefined, 1, 7);
  const b = await context.siteStatus(undefined, 2, 7);
  assert.equal(a.overrideScope, 'persistent');
  assert.equal(a.features.canvas.effective, 'standard');
  assert.equal(a.features.tracking.effective, 'baseline');
  assert.equal(b.overrideScope, null, 'an origin override must not affect another site');
  assert.equal(b.features.canvas.effective, 'protected');
  assert.ok(localData.filumSitePrivacyOverrides.sites['https://a.example']);

  await context.removeSiteOverride('https://a.example', 'all');
  a = await context.siteStatus(undefined, 1, 7);
  assert.equal(a.overrideScope, null, 'removal must immediately restore global policy');
  assert.equal(readPermission('https://a.example', 'canvas').action, 'none');

  await context.setSiteOverride(1, 'https://a.example', 7, { level: 'normal', scope: 'session' });
  assert.equal((await context.siteStatus(undefined, 1, 7)).overrideScope, 'session');
  sessionData = {}; // browser restart clears storage.session
  for (const [key, value] of permissions) if (value.scope === 'session') permissions.delete(key);
  a = await context.siteStatus(undefined, 1, 7);
  assert.equal(a.overrideScope, null, 'temporary override must end with its browser session');

  await assert.rejects(context.setSiteOverride(2, 'https://b.example', 7,
    { level: 'normal', scope: 'persistent' }), /scheda o origine è cambiata/,
  'a stale/non-active tab must not receive a site override');
  assert.equal((await context.siteStatus(undefined, 3, 7)).available, false,
    'container tabs must be excluded until Gecko origin attributes can be represented safely');

  localData.torEnabled = true;
  await context.setSiteOverride(1, 'https://a.example', 7, { level: 'normal', scope: 'persistent' });
  assert.equal(readPermission('https://a.example', 'canvas').action, 'none',
    'site preset must not install Canvas allow permission while Tor is active');
  assert.equal(readPermission('https://a.example', 'tracking').action, 'allow');
  await context.removeSiteOverride('https://a.example', 'all');
  await assert.rejects(context.setSiteOverride(1, 'https://a.example', 7,
    { operation: 'canvas-exception', scope: 'session' }), /Tor mantiene Canvas RFP/);
  permissions.set(permissionKey('https://foreign.example', 'canvas'),
    { action:'allow', scope:'persistent', expireType:2 });
  await assert.rejects(context.syncSiteOverridesForTor(true), /permesso Canvas Gecko esterno/,
    'Tor startup must fail closed on unmanaged Canvas allow permissions');
  assert.equal(policy.normalizeOrigin('https://a.example/path'), 'https://a.example');
  console.log('Per-origin isolation, persistence, session expiry, restore, and Tor constraints: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
