// Focused state-transition checks for extension code without a Gecko runtime.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../extension/background.js'), 'utf8');
const sidebarSource = fs.readFileSync(path.join(__dirname, '../extension/sidebar.js'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(__dirname, '../extension/experiment-apis/browserControl.js'), 'utf8');
const bridgeSchema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../extension/experiment-apis/browserControl.json'), 'utf8'));
function section(start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

async function main() {
  const bridgeFunctions = bridgeSchema[0].functions.map(item => item.name);
  assert.ok(bridgeFunctions.includes('applyGhostHardening'), 'privileged bridge must expose GHOST hardening');
  assert.ok(bridgeFunctions.includes('setGhostJavascriptEnabled'), 'privileged bridge must expose the GHOST JavaScript toggle');
  const hardeningStart = bridgeSource.indexOf('const applyGhostHardening = isActive =>');
  const hardeningEnd = bridgeSource.indexOf('\n\n    return {\n      browserControl:', hardeningStart);
  const hardeningCode = bridgeSource.slice(hardeningStart, hardeningEnd);
  const activationOrder = [
    'setInt("network.cookie.cookieBehavior", 1)',
    'setBool("privacy.firstparty.isolate", true)',
    'setBool("javascript.enabled", false)',
    'setBool("javascript.options.wasm", false)',
    'setBool("network.http.http3.enable", false)',
    'setBool("network.http.altsvc.enabled", false)'
  ];
  let lastActivationIndex = -1;
  for (const expression of activationOrder) {
    const index = hardeningCode.indexOf(expression);
    assert.ok(index > lastActivationIndex, `GHOST hardening order must include ${expression}`);
    lastActivationIndex = index;
  }
  assert.match(bridgeSource, /restoreGhostHardeningSnapshot\(snapshot\)/,
    'GHOST hardening must rollback the complete preference snapshot after activation failure');
  assert.match(bridgeSource, /GHOST_HARDENING_SNAPSHOT_PREF/,
    'GHOST hardening snapshot must survive browser restarts');
  assert.match(bridgeSource, /"javascript\.enabled": \{ type: "bool", fallback: true \}/,
    'javascript.enabled must be included in the existing native preference snapshot');
  assert.match(bridgeSource, /javascriptEnabled: Services\.prefs\.getBoolPref\("javascript\.enabled", true\)/,
    'mode diagnostics must expose the effective global JavaScript preference');
  assert.match(source, /message\.mode === 'GHOST' && previousMode !== 'GHOST'[\s\S]{0,180}applyGhostHardening\(true\)/,
    'reselecting GHOST must not reapply hardening and reset the temporary JavaScript override');
  assert.match(source, /set-ghost-javascript[\s\S]{0,180}setGhostJavascript\(message\.enabled\)/,
    'the background must route the GHOST-only JavaScript toggle through its serialized transition queue');
  assert.match(sidebarSource, /ghost-javascript-toggle/,
    'the sidebar must expose the JavaScript toggle and state rendering');
  assert.ok(sidebarSource.includes('Attiva JavaScript') && sidebarSource.includes('Disattiva JavaScript'),
    'the sidebar must label both JavaScript toggle states');
  assert.match(fs.readFileSync(path.join(__dirname, '../extension/sidebar.html'), 'utf8'),
    /id="ghost-javascript-control"[\s\S]*id="ghost-javascript-toggle"/,
    'the GHOST JavaScript control must exist in the sidebar markup');
  for (const check of [
    'ghost-hardening-active', 'tor-bootstrap-with-ghost-fpi',
    'tor-normal-restores-ghost-hardening', 'ghost-exit-restores-native-prefs'
  ]) {
    assert.ok(sidebarSource.includes(`'${check}'`), `Windows runtime self-test must include ${check}`);
  }
  for (const check of [
    'ghost-javascript-toggle-visible-while-off', 'ghost-javascript-enable-from-sidebar',
    'ghost-javascript-override-survives-reselect', 'ghost-javascript-disable-from-sidebar'
  ]) {
    assert.ok(sidebarSource.includes(`'${check}'`), `Windows runtime self-test must include ${check}`);
  }
  assert.ok(sidebarSource.indexOf("await selectMode('GHOST');") <
    sidebarSource.indexOf('torButton.click();', sidebarSource.indexOf('async function runControlSelfTest')),
  'Windows runtime self-test must enter GHOST before bootstrapping Tor');

  const calls = [];
  const data = { ghostSession: { startedAt: 100, hosts: ['example.org'] } };
  let failCleanup = true;
  const browser = {
    storage: { local: {
      async get(keys) {
        if (typeof keys === 'string') return { [keys]: data[keys] };
        return Object.fromEntries(keys.map(key => [key, data[key]]));
      },
      async set(value) { Object.assign(data, value); },
      async remove(keys) { for (const key of [].concat(keys)) delete data[key]; }
    } },
    browsingData: { async remove(options, types) {
      calls.push({ options, types });
      if (failCleanup) throw new Error('cleanup failed');
      if (types.localStorage && 'since' in options) {
        throw new Error("Firefox does not support clearing localStorage with 'since'.");
      }
    } },
    proxy: {
      settings: { async get() { return { value: currentProxy }; }, async set({ value }) {
        calls.push({ proxy: { value } });
        if (value.proxyType === 'system' && failProxy) throw new Error('proxy locked');
        currentProxy = value;
      } },
      onRequest: {
        addListener(listener) { proxyListeners.add(listener); },
        removeListener(listener) { proxyListeners.delete(listener); }
      }
    },
    browserControl: {
      async setSecureDns(level) { calls.push({ dns: level }); currentDns = level; },
      async getSettings() { return { secureDns: currentDns }; },
      async stopTor() { calls.push({ stopTor: true }); },
      async setHttpsOnly(enabled) { calls.push({ https: enabled }); }
    }
  };
  let failProxy = true;
  const proxyListeners = new Set();
  let currentProxy = { proxyType: 'manual', socks: '127.0.0.1:19050', socksVersion: 5, proxyDNS: true };
  let currentDns = 'off';
  const context = vm.createContext({ URL, browser, ghostRecordQueue: Promise.resolve(), logSecurityEvent() {}, console: { warn() {} } });
  vm.runInContext(section('function matchesRestoredProxy(', 'function localUsageDay('), context);
  vm.runInContext(section('async function endGhostSession()', 'async function setTorEnabled('), context);
  await assert.rejects(vm.runInContext('endGhostSession()', context), /cleanup failed/);
  assert.ok(data.ghostSession, 'failed GHOST cleanup must be retryable');
  failCleanup = false;
  await vm.runInContext('endGhostSession()', context);
  assert.equal(data.ghostSession, undefined);
  assert.equal(calls[1].options.since, undefined);
  assert.equal(calls[1].options.hostnames[0], 'example.org');
  assert.equal(calls[1].types.localStorage, true);
  assert.equal(calls[2].options.since, 100);
  assert.equal(calls[2].types.cookies, true);
  assert.equal(calls[3].options.since, 100);
  assert.equal(calls[3].types.history, true);

  vm.runInContext(section('async function trackGhostHost(', 'async function endGhostSession()'), context);
  context.getMode = async () => 'GHOST';
  data.ghostSession = { startedAt: 101, hosts: [] };
  await Promise.all(Array.from({ length: 205 }, (_, i) =>
    vm.runInContext(`recordGhostHost('https://site${i}.example/')`, context)));
  assert.equal(data.ghostSession.hosts.length, 205, 'GHOST must not silently drop older hosts');
  const originalSet = browser.storage.local.set;
  browser.storage.local.set = async () => { throw new Error('storage unavailable'); };
  await assert.rejects(vm.runInContext("recordGhostHost('https://missing.example/')", context),
    /storage unavailable/);
  assert.match(context.ghostTrackingError, /storage unavailable/);
  browser.storage.local.set = originalSet;
  await vm.runInContext('endGhostSession()', context);

  data.torEnabled = true;
  data.torPreviousProxy = { proxyType: 'system' };
  data.torPreviousSecureDns = 'balanced';
  await vm.runInContext('restoreStaleTorState()', context);
  assert.equal(data.torEnabled, true, 'failed proxy restoration must preserve Tor warning');
  failProxy = false;
  await vm.runInContext('restoreStaleTorState()', context);
  assert.equal(data.torEnabled, false);
  assert.equal(data.torPreviousProxy, undefined);

  vm.runInContext(section('async function setTorEnabled(', 'async function initialize('), context);
  vm.runInContext(section('function hasTorProxy(', 'function localUsageDay('), context);
  context.torStarting = false;
  data.torEnabled = true;
  data.torPreviousProxy = { proxyType: 'system' };
  data.torPreviousSecureDns = 'balanced';
  browser.browserControl.setSecureDns = async () => { throw new Error('DNS locked'); };
  await assert.rejects(vm.runInContext('setTorEnabled(false)', context), /Ripristino proxy o DNS/);
  assert.equal(data.torEnabled, true, 'failed DNS restoration must keep recovery state');
  browser.browserControl.setSecureDns = async value => { currentDns = value; };
  context.applyRuntimePrivacy = async () => {};
  context.getMode = async () => 'NORMAL';
  await vm.runInContext('setTorEnabled(false)', context);
  assert.equal(data.torEnabled, false);

  currentProxy = { proxyType: 'system' };
  currentDns = 'balanced';
  let currentWebRtc = true;
  let rejectWebRtc = false;
  let rejectProxyRestore = false;
  browser.proxy.settings.get = async () => ({ value: currentProxy });
  browser.proxy.settings.set = async ({ value }) => {
    if (value.proxyType === 'system' && rejectProxyRestore) throw new Error('proxy restore failed');
    currentProxy = value;
  };
  browser.browserControl.getSettings = async () => ({ secureDns: currentDns });
  browser.browserControl.setSecureDns = async value => { currentDns = value; };
  browser.browserControl.startTor = async () => ({ bootstrapped: true, socksHost: '127.0.0.1', socksPort: 19050 });
  browser.browserControl.getTorStatus = async () => ({ bootstrapped: true });
  browser.privacy = { network: { peerConnectionEnabled: {} } };
  browser.privacy.network.peerConnectionEnabled.set = async ({ value }) => {
    if (rejectWebRtc) throw new Error('WebRTC write failed');
    currentWebRtc = value;
  };
  browser.privacy.network.peerConnectionEnabled.get = async () => ({ value: currentWebRtc });
  await vm.runInContext('setTorEnabled(true)', context);
  assert.equal(data.torEnabled, true);
  assert.equal(context.torStarting, false);
  assert.equal(currentWebRtc, false);
  assert.equal(currentDns, 'off');
  await vm.runInContext('setTorEnabled(false)', context);
  assert.equal(data.torEnabled, false);
  assert.equal(currentProxy.proxyType, 'system');

  await vm.runInContext('setTorEnabled(true)', context);
  currentDns = 'strict';
  await vm.runInContext('setTorEnabled(true)', context);
  assert.equal(currentDns, 'off', 'a previously active Tor session must repair a changed DNS setting');
  await vm.runInContext('setTorEnabled(false)', context);
  const workingProxySetter = browser.proxy.settings.set;
  browser.proxy.settings.set = async ({ value }) => {
    if (value.proxyType !== 'system') currentProxy = value;
  };
  await vm.runInContext('setTorEnabled(true)', context);
  await assert.rejects(vm.runInContext('setTorEnabled(false)', context), /Ripristino proxy o DNS/);
  assert.equal(data.torEnabled, true, 'a silently ignored proxy restore must keep Tor recovery state');
  browser.proxy.settings.set = workingProxySetter;
  await vm.runInContext('setTorEnabled(false)', context);
  const workingDnsSetter = browser.browserControl.setSecureDns;
  await vm.runInContext('setTorEnabled(true)', context);
  browser.browserControl.setSecureDns = async () => {};
  await assert.rejects(vm.runInContext('setTorEnabled(false)', context), /Ripristino proxy o DNS/);
  assert.equal(data.torEnabled, true, 'a silently ignored DNS restore must keep Tor recovery state');
  browser.browserControl.setSecureDns = workingDnsSetter;
  await vm.runInContext('setTorEnabled(false)', context);

  browser.privacy.network.peerConnectionEnabled.set = async () => {};
  currentWebRtc = true;
  await assert.rejects(vm.runInContext('setTorEnabled(true)', context), /TOR non confermato/);
  assert.equal(data.torEnabled, false, 'readback mismatch must not activate Tor');
  browser.privacy.network.peerConnectionEnabled.set = async ({ value }) => {
    if (rejectWebRtc) throw new Error('WebRTC write failed');
    currentWebRtc = value;
  };

  currentWebRtc = true;
  rejectWebRtc = true;
  rejectProxyRestore = true;
  await assert.rejects(vm.runInContext('setTorEnabled(true)', context), /WebRTC write failed/);
  assert.equal(data.torEnabled, true, 'incomplete rollback after failed start must retain recovery warning');
  rejectWebRtc = false;
  rejectProxyRestore = false;
  await vm.runInContext('setTorEnabled(false)', context);
  assert.equal(data.torEnabled, false);

  await assert.rejects(
    vm.runInContext("setSocksAuthProxy({host:'127.0.0.1',port:1080,user:'test',pass:''})", context),
    /inserisci username e password insieme/
  );
  await vm.runInContext("setSocksAuthProxy({host:'127.0.0.1',port:1080,user:'test',pass:'pass'})", context);
  assert.equal(data.socks_auth_profile.user, 'test', 'SOCKS credentials must persist for Tor restoration');
  assert.equal(proxyListeners.size, 1, 'authenticated SOCKS must register its proxy listener');
  const authProxy = await [...proxyListeners][0]({ url: 'https://example.org/' });
  assert.equal(authProxy.type, 'socks');
  assert.equal(authProxy.host, '127.0.0.1');
  assert.equal(authProxy.port, 1080);
  assert.equal(authProxy.username, 'test');
  assert.equal(authProxy.password, 'pass');

  await vm.runInContext('setTorEnabled(true)', context);
  assert.equal(proxyListeners.size, 0, 'Tor must deregister the SOCKS auth listener');
  assert.equal(data.socks_auth_profile.user, 'test', 'Tor must preserve the auth profile for restoration');
  currentDns = 'strict';
  await vm.runInContext('setTorEnabled(true)', context);
  assert.equal(proxyListeners.size, 0, 'Tor repair must keep the auth listener suspended');
  assert.equal(data.socks_auth_profile.user, 'test', 'Tor repair must preserve the auth profile');
  await vm.runInContext('setTorEnabled(false)', context);
  assert.equal(proxyListeners.size, 1, 'stopping Tor must restore the auth listener');
  const restoredAuthProxy = await [...proxyListeners][0]({ url: 'https://example.org/' });
  assert.equal(restoredAuthProxy.username, 'test');
  assert.equal(currentProxy.socks, '127.0.0.1:1080');

  await vm.runInContext("setNetworkProxy({mode:'system'})", context);
  assert.equal(proxyListeners.size, 0, 'non-SOCKS modes must remove the auth listener');
  assert.equal(data.socks_auth_profile, undefined, 'non-SOCKS modes must clear stale SOCKS credentials');

  vm.runInContext(section('function localUsageDay(', 'async function tavilyKeyStatus('), context);
  assert.equal(vm.runInContext("localUsageDay(new Date(2026, 8, 25, 0, 30))", context), '2026-09-25');

  vm.runInContext(section('async function applyHttpsOverride()', 'async function getAdsEnabled()'), context);
  data.httpsOnlyOverride = true;
  await vm.runInContext('applyHttpsOverride()', context);
  assert.ok(calls.some(call => call.https === true));

  const modePrivacySetting = { async set() {} };
  const modeFingerprintWrites = [];
  const modeWebRtcWrites = [];
  const ghostHardeningWrites = [];
  browser.privacy = {
    websites: {
      trackingProtectionMode: modePrivacySetting, cookieConfig: modePrivacySetting,
      resistFingerprinting: { async set({ value }) { modeFingerprintWrites.push(value); } },
      hyperlinkAuditingEnabled: modePrivacySetting,
      referrersEnabled: modePrivacySetting
    },
    network: {
      networkPredictionEnabled: modePrivacySetting,
      peerConnectionEnabled: { async set({ value }) { modeWebRtcWrites.push(value); } },
      webRTCIPHandlingPolicy: modePrivacySetting
    }
  };
  vm.runInContext(section('async function applyRuntimePrivacy(mode)', 'async function getModeHealth('), context);
  for (const mode of ['NORMAL', 'TURBO', 'PRIVATE', 'GHOST']) {
    const previousWrites = modeWebRtcWrites.length;
    const previousFingerprintWrites = modeFingerprintWrites.length;
    await vm.runInContext(`applyRuntimePrivacy('${mode}')`, context);
    assert.equal(modeWebRtcWrites.length, previousWrites + 1, `${mode} must write the WebRTC setting`);
    assert.equal(modeWebRtcWrites[modeWebRtcWrites.length - 1], false, `${mode} must disable WebRTC`);
    assert.equal(modeFingerprintWrites.length, previousFingerprintWrites + 1, `${mode} must write the fingerprint resistance setting`);
    const expectedRfp = mode === 'PRIVATE' || mode === 'GHOST';
    assert.equal(modeFingerprintWrites[modeFingerprintWrites.length - 1], expectedRfp,
      `${mode} RFP should be ${expectedRfp}`);
  }

  const launcher = fs.readFileSync(path.join(__dirname, 'launch.ps1'), 'utf8');
  const privateLauncherMode = launcher.match(/'PRIVATE'\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  assert.match(privateLauncherMode, /user_pref\("privacy\.resistFingerprinting", true\);/,
    'PRIVATE launcher profile must enable fingerprint resistance');

    const modeCode = section("  if (message?.type === 'set-mode'", "  if (message?.type === 'set-tor'");
  data.mode = 'NORMAL';
  let failMode = true;
  let mockGhostJavascriptEnabled = true;
  browser.browserControl.applyMode = async mode => {
    if (mode === 'PRIVATE' && failMode) throw new Error('mode pref failed');
  };
  browser.browserControl.getModeDiagnostics = async () => ({
    javascriptEnabled: mockGhostJavascriptEnabled
  });
  browser.browserControl.setGhostJavascriptEnabled = async enabled => {
    mockGhostJavascriptEnabled = enabled;
    return { enabled };
  };
  browser.browserControl.applyGhostHardening = async active => {
    ghostHardeningWrites.push(active);
    return { active };
  };
  context.MODE_LIMITS = { NORMAL: 3, PRIVATE: 3 };
  context.queueControlTransition = action => action();
  context.getMode = async () => data.mode;
  context.applyRuntimePrivacy = async () => {};
  context.enforceBackgroundLimit = async () => {};
  context.getModeHealth = async () => ({ ok: false, issues: ['readback mismatch'] });
  browser.privacy = { network: { peerConnectionEnabled: { async set() {} } } };
  vm.runInContext(`async function handleMode(message) { ${modeCode} }`, context);
  await assert.rejects(vm.runInContext("handleMode({type:'set-mode',mode:'PRIVATE'})", context), /mode pref failed/);
  assert.equal(data.mode, 'NORMAL', 'failed mode transition must keep previous selection');
  failMode = false;
  const partial = await vm.runInContext("handleMode({type:'set-mode',mode:'PRIVATE'})", context);
  assert.equal(data.mode, 'PRIVATE');
  assert.equal(partial.ok, false, 'failed readback must not claim mode success');
  context.enforceBackgroundLimit = async () => { throw new Error('tab enforcement failed'); };
  await assert.rejects(vm.runInContext("handleMode({type:'set-mode',mode:'NORMAL'})", context), /tab enforcement failed/);
  assert.equal(data.mode, 'PRIVATE', 'failure after mode persistence must restore previous selection');

  const enforceNowCode = section("  if (message?.type === 'enforce-now')", "  if (message?.type === 'open-addons-installed'");
  const removeCacheCalls = [];
  const cleanupOrder = [];
  const originalRemoveCache = browser.browsingData.removeCache;
  const originalEnforceBackgroundLimit = context.enforceBackgroundLimit;
  browser.browsingData.removeCache = async options => {
    removeCacheCalls.push(options);
    cleanupOrder.push('removeCache');
  };
  context.enforceBackgroundLimit = async () => {
    cleanupOrder.push('enforceBackgroundLimit');
    data.status = { discardedNow: 2 };
  };
  context.MODE_LIMITS = { NORMAL: 3, PRIVATE: 3, TURBO: 3 };
  vm.runInContext(`async function handleEnforce(message) { ${enforceNowCode} }`, context);
  try {
    const enforceResult = await vm.runInContext("handleEnforce({type:'enforce-now'})", context);
    assert.equal(enforceResult.ok, true, 'enforce-now must report success after cache and tab cleanup');
    assert.equal(enforceResult.discarded, 2, 'enforce-now must return the discarded tab count');
    assert.equal(removeCacheCalls.length, 1, 'enforce-now must clear cache once');
    assert.equal(removeCacheCalls[0].since, 0, 'enforce-now must clear the full cache');
    assert.deepEqual(cleanupOrder, ['removeCache', 'enforceBackgroundLimit'],
      'enforce-now must clear cache before enforcing the tab limit');

    removeCacheCalls.length = 0;
    cleanupOrder.length = 0;
    data.mode = 'NORMAL';
    await vm.runInContext("handleMode({type:'set-mode',mode:'TURBO'})", context);
    assert.equal(removeCacheCalls.length, 1, 'entering TURBO must clear cache once');
    assert.equal(removeCacheCalls[0].since, 0, 'TURBO entry must clear the full cache');
    assert.deepEqual(cleanupOrder, ['removeCache', 'enforceBackgroundLimit'],
      'TURBO entry must clear cache before enforcing the tab limit');

    removeCacheCalls.length = 0;
    cleanupOrder.length = 0;
    await vm.runInContext("handleMode({type:'set-mode',mode:'TURBO'})", context);
    assert.equal(removeCacheCalls.length, 0, 'reapplying TURBO must not clear cache');

    await vm.runInContext("handleMode({type:'set-mode',mode:'PRIVATE'})", context);
    assert.equal(removeCacheCalls.length, 0, 'non-TURBO transitions must not clear cache');
  } finally {
    if (originalRemoveCache === undefined) delete browser.browsingData.removeCache;
    else browser.browsingData.removeCache = originalRemoveCache;
    context.enforceBackgroundLimit = originalEnforceBackgroundLimit;
  }

  data.torEnabled = true;
  data.mode = 'NORMAL';
  let webRtc = null;
  browser.privacy.network.peerConnectionEnabled.set = async ({ value }) => { webRtc = value; };
  browser.alarms = { create() {} };
  context.restoreStaleTorState = async () => {};
  context.applyDarkTheme = async () => {};
  context.applyRuntimePrivacy = async () => { webRtc = true; };
  context.enforceBackgroundLimit = async () => {};
  context.getMode = async () => data.mode;
  context.initializeBlockCounter = async () => {};
  vm.runInContext(section('async function initialize()', 'async function scheduleEnforcement()'), context);
  await vm.runInContext('initialize()', context);
  assert.equal(webRtc, false, 'startup with Tor recovery pending must disable WebRTC');

  browser.privacy.network.peerConnectionEnabled.set = async () => { throw new Error('WebRTC locked'); };
  await assert.rejects(vm.runInContext("handleMode({type:'set-mode',mode:'PRIVATE'})", context), /WebRTC locked/);
  assert.equal(data.mode, 'NORMAL', 'Tor WebRTC failure must abort the mode change');
  data.torEnabled = false;

  browser.privacy.network.peerConnectionEnabled.set = async () => {};
  browser.browserControl.applyMode = async () => {};
  ghostHardeningWrites.length = 0;
  data.mode = 'GHOST';
  data.ghostSession = { startedAt: 101, hosts: ['example.org'] };
  const ghostExit = await vm.runInContext("handleMode({type:'set-mode',mode:'NORMAL'})", context);
  assert.equal(data.mode, 'NORMAL', 'GHOST exit must complete on Firefox');
  assert.equal(data.ghostSession, undefined, 'successful cleanup must close GHOST session');
  assert.equal(ghostExit.mode, 'NORMAL');
  assert.deepEqual(ghostHardeningWrites, [false], 'GHOST exit must restore hardening before cleanup');

  ghostHardeningWrites.length = 0;
  data.mode = 'TURBO';
  data.torEnabled = true;
  await vm.runInContext("handleMode({type:'set-mode',mode:'TURBO'})", context);
  assert.deepEqual(ghostHardeningWrites, [false],
    'Tor in NORMAL/TURBO must not enable GHOST-only hardening');
  data.torEnabled = false;

  ghostHardeningWrites.length = 0;
  context.MODE_LIMITS.GHOST = 3;
  context.beginGhostSession = async () => { data.ghostSession = { startedAt: 300, hosts: [] }; };
  await vm.runInContext("handleMode({type:'set-mode',mode:'GHOST'})", context);
  assert.deepEqual(ghostHardeningWrites, [true], 'entering GHOST must activate hardening');

  ghostHardeningWrites.length = 0;
  mockGhostJavascriptEnabled = true;
  await vm.runInContext("handleMode({type:'set-mode',mode:'GHOST'})", context);
  assert.deepEqual(ghostHardeningWrites, [], 'reselecting GHOST must preserve the temporary JavaScript override');
  assert.equal(mockGhostJavascriptEnabled, true, 'same-mode GHOST selection changed the JavaScript override');

  data.mode = 'GHOST';
  data.ghostSession = { startedAt: 101, hosts: ['example.org'] };
  context.beginGhostSession = async () => { data.ghostSession = { startedAt: 200, hosts: [] }; };
  browser.browserControl.applyMode = async mode => {
    if (mode === 'NORMAL') throw new Error('mode failed after cleanup');
  };
  await assert.rejects(vm.runInContext("handleMode({type:'set-mode',mode:'NORMAL'})", context), /mode failed after cleanup/);
  assert.equal(data.mode, 'GHOST');
  assert.equal(mockGhostJavascriptEnabled, true,
    'failed exit from GHOST must restore the pre-transition JavaScript override');
  assert.equal(data.ghostSession.hosts.length, 0);
  assert.ok(data.ghostSessionRestartedAt, 'new GHOST session must show persistent warning');

  vm.runInContext(section('async function applyDarkTheme(', 'function isDiscarded('), context);
  context.BLACK_THEME = {};
  context.DARK_THEME = {};
  browser.theme = { async update() { throw new Error('theme rejected'); }, async reset() {} };
  await assert.rejects(vm.runInContext("setBrowserTheme('black')", context), /theme rejected/);
  assert.equal(data.browserTheme, undefined, 'failed theme application must not claim saved selection');

  const search = fs.readFileSync(path.join(__dirname, '../extension/smart-search.js'), 'utf8');
  const siteData = { smartSearchBlockedDomains: [] };
  const rows = [];
  const searchContext = vm.createContext({
    URL,
    browser: { storage: { local: {
      async get() { return siteData; },
      async set(update) { Object.assign(siteData, update); }
    } } },
    blockedSitesEl: {
      replaceChildren() { rows.length = 0; },
      append(node) { rows.push(node); },
      set textContent(value) { this.message = value; }
    },
    summaryEl: { textContent: '' },
    document: { createElement(tag) { return {
      tag, children: [], append(...children) { this.children.push(...children); },
      addEventListener(_event, handler) { this.click = handler; }
    }; } },
    render(results, query, meta) { searchContext.shown = { results, meta }; }
  });
  vm.runInContext(search.slice(search.indexOf('let activeController = null;'),
    search.indexOf('const STOP_WORDS')), searchContext);
  await vm.runInContext('loadBlockedSites()', searchContext);
  vm.runInContext("lastRendered = {results:[{url:'https://fake.example/a'}, {url:'https://www.fake.example/b'}, {url:'https://good.example/'}], query:{}, meta:{blockedCount:0}}", searchContext);
  await vm.runInContext("blockResultSite('https://fake.example/a')", searchContext);
  assert.equal(searchContext.shown.results.length, 1);
  assert.equal(searchContext.shown.meta.blockedCount, 2);
  assert.equal(vm.runInContext("isBlockedSite('https://sub.fake.example')", searchContext), true);
  assert.equal(vm.runInContext("isBlockedSite('https://notfake.example')", searchContext), false);
  await rows[0].children[1].click();
  assert.equal(siteData.smartSearchBlockedDomains.length, 0);

  vm.runInContext(search.slice(search.indexOf('function decodeResultUrl('),
    search.indexOf('function getDomain(')), searchContext);
  assert.equal(vm.runInContext("decodeResultUrl('/l/?uddg=https%3A%2F%2Fexample.org%2Fa%252Fb')", searchContext),
    'https://example.org/a%2Fb', 'redirect must be decoded exactly once');

  let unblockFirst;
  let loads = 0;
  let paidMessages = 0;
  const raceContext = vm.createContext({
    AbortController, DOMException,
    activeController: null,
    stopButton: { disabled: true }, resultsEl: { textContent: '' }, summaryEl: { textContent: '' },
    document: { getElementById() { return { checked: false }; } },
    parseQuery(raw) { return { raw, engineQuery: raw }; },
    async loadBlockedSites() {
      if (++loads === 1) await new Promise(resolve => { unblockFirst = resolve; });
    },
    async searchCandidates() { return { candidates: [], excludedAds: 0 }; },
    browser: { runtime: { async sendMessage() { paidMessages += 1; return { results: [] }; } } },
    mergeCandidates() { return []; },
    render() {},
    async updateTavilyStatus() {}
  });
  vm.runInContext(search.slice(search.indexOf('async function executeSearch('),
    search.indexOf('form.addEventListener(')), raceContext);
  const first = vm.runInContext("executeSearch('first', true)", raceContext);
  const second = vm.runInContext("executeSearch('second', false)", raceContext);
  await second;
  unblockFirst();
  await first;
  assert.equal(paidMessages, 0, 'superseded search must not start a paid request');
  assert.notEqual(raceContext.summaryEl.textContent, 'Ricerca interrotta.',
    'old aborted search must not overwrite newer result');

  const quotaDay = new Date();
  const dayKey = `${quotaDay.getFullYear()}-${String(quotaDay.getMonth() + 1).padStart(2, '0')}-${String(quotaDay.getDate()).padStart(2, '0')}`;
  const quotaData = {
    tavilyApiKey: 'tvly-test-key-not-real', tavilyDailyLimit: 33,
    tavilyUsage: { day: dayKey, count: 32, at: 0 },
    tavilyMonthlyUsage: { month: dayKey.slice(0, 7), count: 998 }
  };
  let fetchCount = 0;
  const quotaContext = vm.createContext({
    Date, AbortController, setTimeout, clearTimeout,
    tavilyRequestInFlight: false, TAVILY_DEFAULT_DAILY_LIMIT: 33, TAVILY_MONTHLY_LIMIT: 1000,
    browser: { storage: { local: {
      async get(keys) { return Object.fromEntries(keys.map(key => [key, quotaData[key]])); },
      async set(update) { Object.assign(quotaData, update); }
    } } },
    async fetch(_url, options) {
      fetchCount += 1;
      assert.equal(options.method, 'POST');
      assert.equal(JSON.parse(options.body).search_depth, 'basic');
      return { ok: true, async json() { return { results: [] }; } };
    }
  });
  vm.runInContext(section('function localUsageDay(', 'const DARK_THEME ='), quotaContext);
  await vm.runInContext("searchTavilyExplicit('example query')", quotaContext);
  assert.equal(fetchCount, 1);
  assert.equal(quotaData.tavilyUsage.count, 33);
  await assert.rejects(vm.runInContext("searchTavilyExplicit('again')", quotaContext), /33 ricerche/);
  assert.equal(fetchCount, 1, 'daily limit must reject before network request');
  quotaData.tavilyDailyLimit = 1000;
  quotaData.tavilyUsage.at = 0;
  quotaData.tavilyMonthlyUsage.count = 999;
  await vm.runInContext("searchTavilyExplicit('monthly last')", quotaContext);
  quotaData.tavilyUsage.at = 0;
  await assert.rejects(vm.runInContext("searchTavilyExplicit('monthly exceeded')", quotaContext), /1.000/);
  assert.equal(fetchCount, 2, 'monthly limit must reject before network request');

  const torHandler = section("  if (message?.type === 'set-tor'", "  if (message?.type === 'set-ads'");
  let activeTorOperations = 0;
  let maxTorOperations = 0;
  const queueContext = vm.createContext({
    controlTransition: Promise.resolve(),
    logSecurityEvent() {},
    async setTorEnabled(enabled) {
      activeTorOperations += 1;
      maxTorOperations = Math.max(maxTorOperations, activeTorOperations);
      await new Promise(resolve => setTimeout(resolve, 5));
      activeTorOperations -= 1;
      return enabled;
    }
  });
  vm.runInContext(section('function queueControlTransition(', 'function hasTorProxy('), queueContext);
  vm.runInContext(`async function handleTor(message) { ${torHandler} }`, queueContext);
  const transitions = await Promise.all([
    vm.runInContext("handleTor({type:'set-tor',enabled:true})", queueContext),
    vm.runInContext("handleTor({type:'set-tor',enabled:false})", queueContext)
  ]);
  assert.deepEqual(transitions, [true, false]);
  assert.equal(maxTorOperations, 1, 'Tor start and stop must not overlap');
  const order = [];
  await Promise.all([
    queueContext.queueControlTransition(async () => { order.push('mode'); }),
    queueContext.queueControlTransition(async () => { order.push('dns'); }),
    vm.runInContext("handleTor({type:'set-tor',enabled:true})", queueContext).then(() => order.push('tor'))
  ]);
  assert.deepEqual(order, ['mode', 'dns', 'tor'], 'mode, DNS and Tor must share one transition queue');
  await assert.rejects(queueContext.queueControlTransition(async () => { throw new Error('failed transition'); }),
    /failed transition/);
  assert.equal(await queueContext.queueControlTransition(async () => 'recovered'), 'recovered');

  const sidebar = fs.readFileSync(path.join(__dirname, '../extension/sidebar.js'), 'utf8');
  const element = () => ({ hidden: false, disabled: false, textContent: '', dataset: {}, attributes: {},
    classList: { toggle() {} }, setAttribute(name, value) { this.attributes[name] = value; } });
  const ui = Object.fromEntries([
    'modeWarning', 'blockCounterEl', 'siteBlockDomainEl', 'siteBlockButton', 'adsButton',
    'urlhausMalwareButton', 'torButton', 'dnsProvider', 'secureDns',
    'dnsEndpoint', 'applyDns', 'torStatus', 'dnsStatus'
  ].map(name => [name, element()]));
  const uiContext = vm.createContext({ ...ui,
    torEnabled: false, torStarting: false, adsEnabled: true, urlhausMalwareEnabled: false,
    setModeVisual() {}, renderResources() {}, updateSocksVisibility() {}, setPanelStatus() {}
  });
  vm.runInContext(sidebar.slice(sidebar.indexOf('function renderBlockCounter('),
    sidebar.indexOf('function errorText(')), uiContext);
  vm.runInContext(sidebar.slice(sidebar.indexOf('function render(data)'),
    sidebar.indexOf('async function getStatus()')), uiContext);
  vm.runInContext("render({mode:'NORMAL', adsEnabled:true, urlhausMalwareEnabled:true, modeHealth:{ok:true}, torStarting:true, torProcess:{running:true,bootstrapped:false}})", uiContext);
  assert.equal(ui.torButton.textContent, 'TOR: AVVIO');
  assert.equal(ui.urlhausMalwareButton.textContent, 'URLHAUS: ON');
  assert.equal(ui.siteBlockDomainEl.textContent, 'Sito corrente: non disponibile');
  assert.equal(ui.siteBlockButton.disabled, true);
  assert.match(ui.blockCounterEl.textContent, /non disponibile/);
  assert.equal(ui.modeWarning.hidden, true);
  vm.runInContext('renderBlockCounter(1234567, true)', uiContext);
  assert.match(ui.blockCounterEl.textContent, /1\.234\.567/);
  vm.runInContext("renderSiteBlockStatus({available:true,tabId:9,domain:'shop.example.com',unblocked:true})", uiContext);
  assert.equal(ui.siteBlockDomainEl.textContent, 'Sito corrente: shop.example.com');
  assert.equal(ui.siteBlockButton.textContent, '🛡️ Riattiva blocco');
  assert.equal(ui.siteBlockButton.dataset.unblocked, 'true');
  assert.equal(ui.siteBlockButton.attributes['aria-pressed'], 'true');
  vm.runInContext("render({mode:'NORMAL', urlhausMalwareEnabled:false, modeHealth:{ok:true}, torEnabled:true, torRouted:false, torProcess:{running:false,bootstrapped:false}})", uiContext);
  assert.equal(ui.torButton.textContent, 'TOR: ERRORE');
  assert.equal(ui.modeWarning.hidden, false);
  vm.runInContext("render({mode:'NORMAL', adsEnabled:null, urlhausMalwareEnabled:false, modeHealth:{ok:true}, torProcess:{running:false,bootstrapped:false}})", uiContext);
  assert.equal(ui.adsButton.textContent, 'ADS: ERRORE');
  assert.equal(ui.modeWarning.hidden, false);

  // A delayed settings refresh must not change the value an event submits.
  const settingsEvents = {};
  const changedSettings = [];
  const settingElement = () => ({ value: '', addEventListener(type, listener) {
    settingsEvents[this.kind + ':' + type] = listener;
  } });
  const themeSelect = settingElement(); themeSelect.kind = 'theme';
  const appearanceSelect = settingElement(); appearanceSelect.kind = 'appearance';
  const settingsContext = vm.createContext({
    browserTheme: themeSelect, websiteAppearance: appearanceSelect,
    browser: { runtime: { async sendMessage(message) {
      changedSettings.push(message);
      await Promise.resolve();
    } } },
    async loadAdvancedSettings() {}, setPanelStatus() {}, errorText: String
  });
  vm.runInContext(sidebar.slice(sidebar.indexOf("browserTheme.addEventListener('change'"),
    sidebar.indexOf("httpsOnly.addEventListener('change'")), settingsContext);
  themeSelect.value = 'black';
  const themeChange = settingsEvents['theme:change']();
  themeSelect.value = 'dark';
  await themeChange;
  appearanceSelect.value = 'light';
  const appearanceChange = settingsEvents['appearance:change']();
  appearanceSelect.value = 'auto';
  await appearanceChange;
  assert.equal(changedSettings[0].mode, 'black');
  assert.equal(changedSettings[1].mode, 'light');
  assert.match(sidebar, /value\.browserTheme === requestedTheme/);
  assert.match(sidebar, /value\.websiteAppearance === requestedAppearance/);

  let rulesets = ['ads_basic', 'urlhaus_malware_basic'];
  let allowRulesetUpdates = false;
  browser.declarativeNetRequest = {
    async getEnabledRulesets() { return rulesets; },
    async updateEnabledRulesets({ enableRulesetIds = [], disableRulesetIds = [] }) {
      if (!allowRulesetUpdates) return;
      rulesets = rulesets.filter(id => !disableRulesetIds.includes(id));
      rulesets.push(...enableRulesetIds.filter(id => !rulesets.includes(id)));
    }
  };
  vm.runInContext(
    "const ADS_RULESET_ID = 'ads_basic'; const URLHAUS_MALWARE_RULESET_ID = 'urlhaus_malware_basic';",
    context
  );
  vm.runInContext(section('async function getAdsEnabled()', 'async function applyDarkTheme('), context);
  await assert.rejects(vm.runInContext('setAdsEnabled(false)', context), /ADS non confermato/);
  await assert.rejects(
    vm.runInContext('setUrlhausMalwareEnabled(false)', context),
    /URLhaus non confermato/
  );
  allowRulesetUpdates = true;
  await vm.runInContext('setUrlhausMalwareEnabled(false)', context);
  assert.deepEqual(rulesets, ['ads_basic']);
  await vm.runInContext('setUrlhausMalwareEnabled(true)', context);
  assert.deepEqual(new Set(rulesets), new Set(['urlhaus_malware_basic', 'ads_basic']));
  await vm.runInContext('setAdsEnabled(false)', context);
  assert.deepEqual(rulesets, ['urlhaus_malware_basic']);
  await vm.runInContext('setAdsEnabled(true)', context);
  assert.deepEqual(new Set(rulesets), new Set(['urlhaus_malware_basic', 'ads_basic']));
  assert.equal(data.adsEnabled, true);
  assert.equal(data.urlhausMalwareEnabled, true);

  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../extension/manifest.json'), 'utf8'));
  const malwareRuleset = manifest.declarative_net_request.rule_resources.find(
    ruleset => ruleset.id === 'urlhaus_malware_basic'
  );
  assert.deepEqual(malwareRuleset, {
    id: 'urlhaus_malware_basic',
    enabled: true,
    path: 'rules/urlhaus-malware.json'
  });
  const malwareRules = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../extension/rules/urlhaus-malware.json'),
    'utf8'
  ));
  assert.equal(malwareRules.length, 5);
  assert.equal(new Set(malwareRules.map(rule => rule.id)).size, 5);
  for (const rule of malwareRules) {
    assert.equal(rule.action.type, 'block');
    assert.match(rule.condition.urlFilter, /^\|http:\/\/\d+\.\d+\.\d+\.\d+:\d+\/[^*]+\^$/);
    assert.doesNotMatch(rule.condition.urlFilter, /example|placeholder/i);
  }

  assert.ok(manifest.permissions.includes('declarativeNetRequestFeedback'),
    'DNR feedback permission must be requested for the optional session counter');
  const adsRuleset = manifest.declarative_net_request.rule_resources.find(
    ruleset => ruleset.id === 'ads_basic'
  );
  assert.equal(adsRuleset.path, 'rules/ads-basic.json');
  assert.ok(fs.existsSync(path.join(__dirname, '../extension', adsRuleset.path)));
  const adsRules = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../extension', adsRuleset.path),
    'utf8'
  ));
  assert.ok(adsRules.length > 0 && adsRules.every(rule => rule.action.type === 'block'),
    'the session counter counts matches only while the Ads ruleset contains block actions');

  const siteBlockSource = source.slice(source.indexOf('const SITE_BLOCK_RULE_PRIORITY'),
    source.indexOf('function recordDnrBlock('));
  const siteBlockRules = [
    { id: 1500001, action: { type: 'allow' }, condition: {} },
    { id: 42, action: { type: 'allow' }, condition: {} }
  ];
  const tabs = new Map([
    [9, { id: 9, url: 'https://shop.example.com/cart' }],
    [10, { id: 10, url: 'https://shop.example.com/cart' }]
  ]);
  let rejectSessionUpdate = false;
  const siteBlockContext = vm.createContext({
    URL,
    browser: {
      tabs: {
        async get(tabId) {
          const tab = tabs.get(tabId);
          if (!tab) throw new Error('tab missing');
          return tab;
        }
      },
      declarativeNetRequest: {
        async getSessionRules() { return [...siteBlockRules]; },
        async updateSessionRules({ addRules = [], removeRuleIds = [] }) {
          if (rejectSessionUpdate) throw new Error('session update failed');
          for (const id of removeRuleIds) {
            const index = siteBlockRules.findIndex(rule => rule.id === id);
            if (index >= 0) siteBlockRules.splice(index, 1);
          }
          siteBlockRules.push(...addRules);
        }
      }
    }
  });
  vm.runInContext(
    "const ADS_RULESET_ID = 'ads_basic'; const URLHAUS_MALWARE_RULESET_ID = 'urlhaus_malware_basic';\n" +
      siteBlockSource,
    siteBlockContext
  );
  await vm.runInContext('initializeSiteBlockRules()', siteBlockContext);
  assert.deepEqual(siteBlockRules.map(rule => rule.id), [42],
    'startup must clear stale reserved exceptions and leave other session rules untouched');
  await Promise.all([
    vm.runInContext('toggleSiteBlock(9, "shop.example.com", true)', siteBlockContext),
    vm.runInContext('toggleSiteBlock(9, "shop.example.com", true)', siteBlockContext)
  ]);
  const allowRule = siteBlockRules.find(rule => rule.id >= 1500000);
  assert.equal(siteBlockRules.length, 2, 'concurrent requests must not create duplicate exceptions');
  assert.equal(allowRule.priority, 1000);
  assert.equal(allowRule.action.type, 'allow');
  assert.deepEqual(Array.from(allowRule.condition.tabIds), [9]);
  assert.deepEqual(Array.from(allowRule.condition.initiatorDomains), ['shop.example.com']);
  assert.ok(allowRule.condition.resourceTypes.includes('main_frame'));
  assert.equal((await vm.runInContext('getSiteBlockStatus(9)', siteBlockContext)).unblocked, true);
  assert.equal((await vm.runInContext('getSiteBlockStatus(10)', siteBlockContext)).unblocked, false,
    'the exception must not apply to another tab on the same domain');
  await assert.rejects(
    vm.runInContext('toggleSiteBlock(9, "other.example", true)', siteBlockContext),
    /dominio della scheda è cambiato/
  );
  rejectSessionUpdate = true;
  await assert.rejects(
    vm.runInContext('toggleSiteBlock(9, "shop.example.com", false)', siteBlockContext),
    /session update failed/
  );
  assert.equal(siteBlockRules.length, 2,
    'a failed atomic update must leave the existing session rule and in-memory state intact');
  assert.equal((await vm.runInContext('getSiteBlockStatus(9)', siteBlockContext)).unblocked, true);
  rejectSessionUpdate = false;
  await vm.runInContext('toggleSiteBlock(9, "shop.example.com", false)', siteBlockContext);
  assert.equal(siteBlockRules.length, 1);
  assert.equal((await vm.runInContext('getSiteBlockStatus(9)', siteBlockContext)).unblocked, false);
  await vm.runInContext('toggleSiteBlock(9, "shop.example.com", true)', siteBlockContext);
  await vm.runInContext('toggleSiteBlock(10, "shop.example.com", true)', siteBlockContext);
  assert.equal(siteBlockRules.length, 3);
  await vm.runInContext('removeSiteBlockRulesForTab(9)', siteBlockContext);
  assert.equal(siteBlockRules.length, 2,
    'closing a tab must remove only that tab’s temporary exceptions');
  assert.equal(siteBlockRules.find(rule => rule.condition.tabIds)?.condition.tabIds[0], 10);
  assert.match(source, /browser\.tabs\.onRemoved\.addListener\(\(tabId\) => \{\s*removeSiteBlockRulesForTab\(tabId\)/);
  assert.match(source, /message\?\.type === 'toggle-site-block'/);
  assert.match(sidebarSource, /browser\.tabs\.reload\(previous\.tabId\)/);

  let matchedRuleListener;
  let feedbackEnabled = true;
  const counterContext = vm.createContext({
    browser: {
      declarativeNetRequest: {
        onRuleMatchedDebug: {
          addListener(listener) { matchedRuleListener = listener; }
        },
        async getMatchedRules() {
          if (!feedbackEnabled) throw new Error('DNR feedback is disabled');
          return {};
        }
      }
    },
    Date,
    console: { warn() {} }
  });
  vm.runInContext(section('const ADS_RULESET_ID', 'const SECURITY_LOG_KEY'), counterContext);
  await vm.runInContext('initializeBlockCounter()', counterContext);
  assert.equal(counterContext.getBlockCount().available, true);
  matchedRuleListener({ rule: { rulesetId: 'ads_basic', ruleId: 1 } });
  matchedRuleListener({ rule: { rulesetId: 'urlhaus_malware_basic', ruleId: 1001 } });
  matchedRuleListener({ rule: { rulesetId: 'unrelated_ruleset', ruleId: 5 } });
  assert.equal(counterContext.getBlockCount().count, 2,
    'counter should include only matches from the existing Ads and URLhaus rulesets');
  feedbackEnabled = false;
  await vm.runInContext('initializeBlockCounter()', counterContext);
  assert.equal(counterContext.getBlockCount().count, 0,
    'counter must reset when a new browser session initializes');
  assert.equal(counterContext.getBlockCount().available, false,
    'unsupported DNR feedback must be reported as unavailable, not as zero blocks');
  assert.match(sidebarSource, /conteggio non disponibile/);
  assert.match(sidebarSource, /new Intl\.NumberFormat\('it-IT'\)/);
  assert.match(fs.readFileSync(path.join(__dirname, '../extension/sidebar.html'), 'utf8'), /id="urlhaus-malware" class="pill-toggle"/);
  assert.match(sidebar, /type: 'set-urlhaus-malware'/);

  const diagnostics = fs.readFileSync(path.join(__dirname, '../extension/diagnostics.js'), 'utf8');
  const copied = [];
  const rowItem = (name, value) => ({ querySelector(selector) {
    return { textContent: selector === 'span' ? name : value };
  } });
  const diagnosticContext = vm.createContext({
    Date, navigator: { clipboard: { async writeText(value) { copied.push(value); } } },
    modeEl: { querySelectorAll: () => [rowItem('Modalità selezionata', 'PRIVATE')] },
    featuresEl: { querySelectorAll: () => [rowItem('ADS', 'Attivo')] },
    torEl: { querySelectorAll: () => [rowItem('Bootstrap', '100%')] },
    checkedEl: { textContent: 'Verifica completata' },
    copyButton: { textContent: '' }
  });
  vm.runInContext(diagnostics.slice(diagnostics.indexOf('let report ='),
    diagnostics.indexOf('function row(')), diagnosticContext);
  vm.runInContext("report = formatReport()", diagnosticContext);
  await vm.runInContext('copyReport()', diagnosticContext);
  assert.match(copied[0], /Modalità selezionata: PRIVATE/);
  assert.match(copied[0], /ADS: Attivo/);
  assert.match(copied[0], /Bootstrap: 100%/);
  assert.equal(diagnosticContext.copyButton.textContent, 'Diagnostica copiata');

  assert.match(fs.readFileSync(path.join(__dirname, '../extension/sidebar.html'), 'utf8'), /id="socks-user"/);
  assert.match(fs.readFileSync(path.join(__dirname, '../extension/sidebar.html'), 'utf8'), /id="socks-pass"/);
  assert.match(sidebar, /type: 'set-proxy-auth'/);
  assert.match(sidebar, /type: 'set-network-proxy'/);

  const loggerSource = section('const SECURITY_LOG_KEY', 'let tavilyRequestInFlight');
  const loggerLogs = [];
  const loggerWarnings = [];
  const queuedWrites = [];
  const writeWaiters = [];
  let failNextLoggerWrite = false;
  let activeLoggerWrites = 0;
  let maxActiveLoggerWrites = 0;
  const loggerContext = vm.createContext({
    Date,
    console: { warn(...args) { loggerWarnings.push(args); } },
    browser: { storage: { local: {
      async get(key) { return { [key]: loggerLogs }; },
      set(update) {
        const gate = { update: JSON.parse(JSON.stringify(update)), fail: failNextLoggerWrite };
        failNextLoggerWrite = false;
        activeLoggerWrites += 1;
        maxActiveLoggerWrites = Math.max(maxActiveLoggerWrites, activeLoggerWrites);
        let resolveWrite;
        let rejectWrite;
        const controlled = new Promise((resolve, reject) => {
          resolveWrite = resolve;
          rejectWrite = reject;
        });
        gate.resolve = resolveWrite;
        gate.reject = rejectWrite;
        gate.completion = controlled.then(() => {
          if (gate.fail) throw new Error('storage unavailable');
          const [key, value] = Object.entries(gate.update)[0];
          loggerLogs.splice(0, loggerLogs.length, ...JSON.parse(JSON.stringify(value)));
        }).finally(() => { activeLoggerWrites -= 1; });
        gate.completion.catch(() => {});
        const waiter = writeWaiters.shift();
        if (waiter) waiter(gate);
        else queuedWrites.push(gate);
        return gate.completion;
      }
    } } }
  });
  vm.runInContext(loggerSource, loggerContext);
  const nextLoggerWrite = () => queuedWrites.length
    ? Promise.resolve(queuedWrites.shift())
    : new Promise(resolve => writeWaiters.push(resolve));
  const finishLoggerWrite = async (gate, shouldSucceed = true) => {
    if (shouldSucceed) gate.resolve();
    else gate.reject(new Error('storage unavailable'));
    if (shouldSucceed) await gate.completion;
    else await assert.rejects(gate.completion, /storage unavailable/);
  };
  const waitForLoggerIdle = async () => {
    for (let attempt = 0; attempt < 20 && vm.runInContext('securityLogWriting', loggerContext); attempt += 1) {
      await Promise.resolve();
    }
    assert.equal(vm.runInContext('securityLogWriting', loggerContext), false,
      'logger queue must become idle after controlled writes finish');
  };

  vm.runInContext("logSecurityEvent('CACHE_CLEAR', 'NORMAL', 'INVALID')", loggerContext);
  vm.runInContext("logSecurityEvent('UNKNOWN_EVENT', 'NORMAL', 'SUCCESS')", loggerContext);
  assert.equal(queuedWrites.length, 0, 'invalid result and event type must be discarded');
  vm.runInContext("logSecurityEvent('CACHE_CLEAR', 'UNKNOWN', 'SUCCESS', {discarded: 1})", loggerContext);
  vm.runInContext("logSecurityEvent('CACHE_CLEAR', 'NORMAL', 'SUCCESS', {discarded: -1})", loggerContext);
  const invalidModeWrite = await nextLoggerWrite();
  await finishLoggerWrite(invalidModeWrite);
  const invalidMetadataWrite = await nextLoggerWrite();
  await finishLoggerWrite(invalidMetadataWrite);
  await waitForLoggerIdle();
  assert.equal(loggerLogs.length, 2, 'invalid optional fields must not discard otherwise valid events');
  assert.equal('mode' in loggerLogs[0], false, 'invalid mode must be omitted');
  assert.deepEqual(loggerLogs[0].metadata, { discarded: 1 });
  assert.equal(loggerLogs[1].mode, 'NORMAL');
  assert.equal('metadata' in loggerLogs[1], false, 'invalid metadata must be omitted');
  assert.ok(loggerLogs.every(event => Object.keys(event)
    .every(key => ['timestamp', 'event_type', 'result', 'mode', 'metadata'].includes(key))),
  'logger events must contain only approved fields');

  loggerLogs.length = 0;
  maxActiveLoggerWrites = 0;
  for (let i = 0; i < 205; i += 1) {
    vm.runInContext(`logSecurityEvent('CACHE_CLEAR', 'NORMAL', 'SUCCESS', {discarded: ${i}})`, loggerContext);
  }
  for (let i = 0; i < 205; i += 1) {
    const gate = await nextLoggerWrite();
    assert.equal(activeLoggerWrites, 1, 'logger storage writes must be serialized');
    await finishLoggerWrite(gate);
  }
  await waitForLoggerIdle();
  assert.equal(loggerLogs.length, 200, 'logger must retain only the newest 200 entries');
  assert.equal(loggerLogs[0].metadata.discarded, 5, 'FIFO rotation must remove the oldest five entries');
  assert.equal(loggerLogs[199].metadata.discarded, 204, 'FIFO rotation must preserve the newest entry');
  assert.equal(maxActiveLoggerWrites, 1, 'logger must never overlap storage writes');

  loggerLogs.length = 0;
  loggerWarnings.length = 0;
  vm.runInContext("logSecurityEvent('TOR_ENABLE', 'NORMAL', 'SUCCESS')", loggerContext);
  const eventA = await nextLoggerWrite();
  await finishLoggerWrite(eventA);
  await waitForLoggerIdle();

  failNextLoggerWrite = true;
  vm.runInContext("logSecurityEvent('TOR_DISABLE', 'NORMAL', 'SUCCESS')", loggerContext);
  const eventB = await nextLoggerWrite();
  assert.equal(eventB.fail, true, 'configured storage failure must affect event B');
  await finishLoggerWrite(eventB, false);
  await waitForLoggerIdle();

  vm.runInContext("logSecurityEvent('MODE_CHANGE', 'PRIVATE', 'SUCCESS')", loggerContext);
  const eventC = await nextLoggerWrite();
  await finishLoggerWrite(eventC);
  await waitForLoggerIdle();
  assert.deepEqual(loggerLogs.map(event => event.event_type), ['TOR_ENABLE', 'MODE_CHANGE'],
    'failed event B must be absent while following event C is stored');
  assert.equal(loggerWarnings.length, 1, 'storage failure must be caught and warned once');
  assert.match(String(loggerWarnings[0][0]), /Security log write failed/);

  assert.doesNotMatch(source, /\bawait\s+logSecurityEvent\s*\(/,
    'security logger trigger calls must remain fire-and-forget');
  assert.equal(vm.runInContext('securityLogQueue.length', loggerContext), 0);
  assert.equal(vm.runInContext('securityLogWriting', loggerContext), false);

  process.stdout.write('GHOST/Tor/SOCKS5 auth coordination/modes/theme/URLhaus ruleset independence, search race, Tavily quota, transitions and sidebar states: PASS\n');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
