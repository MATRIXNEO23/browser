// Focused state-transition checks for extension code without a Gecko runtime.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../extension/background.js'), 'utf8');
function section(start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

async function main() {
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
    proxy: { settings: { async get() { return { value: currentProxy }; }, async set(value) {
      calls.push({ proxy: value });
      if (value.value.proxyType === 'system' && failProxy) throw new Error('proxy locked');
      currentProxy = value.value;
    } } },
    browserControl: {
      async setSecureDns(level) { calls.push({ dns: level }); currentDns = level; },
      async getSettings() { return { secureDns: currentDns }; },
      async stopTor() { calls.push({ stopTor: true }); },
      async setHttpsOnly(enabled) { calls.push({ https: enabled }); }
    }
  };
  let failProxy = true;
  let currentProxy = { proxyType: 'manual', socks: '127.0.0.1:19050', socksVersion: 5, proxyDNS: true };
  let currentDns = 'off';
  const context = vm.createContext({ URL, browser, ghostRecordQueue: Promise.resolve(), console: { warn() {} } });
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

  vm.runInContext(section('function localUsageDay(', 'async function tavilyKeyStatus('), context);
  assert.equal(vm.runInContext("localUsageDay(new Date(2026, 8, 25, 0, 30))", context), '2026-09-25');

  vm.runInContext(section('async function applyHttpsOverride()', 'async function getAdsEnabled()'), context);
  data.httpsOnlyOverride = true;
  await vm.runInContext('applyHttpsOverride()', context);
  assert.ok(calls.some(call => call.https === true));

  const modeCode = section("  if (message?.type === 'set-mode'", "  if (message?.type === 'set-tor'");
  data.mode = 'NORMAL';
  let failMode = true;
  browser.browserControl.applyMode = async mode => {
    if (mode === 'PRIVATE' && failMode) throw new Error('mode pref failed');
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
  vm.runInContext(section('async function initialize()', 'async function scheduleEnforcement()'), context);
  await vm.runInContext('initialize()', context);
  assert.equal(webRtc, false, 'startup with Tor recovery pending must disable WebRTC');

  browser.privacy.network.peerConnectionEnabled.set = async () => { throw new Error('WebRTC locked'); };
  await assert.rejects(vm.runInContext("handleMode({type:'set-mode',mode:'PRIVATE'})", context), /WebRTC locked/);
  assert.equal(data.mode, 'NORMAL', 'Tor WebRTC failure must abort the mode change');
  data.torEnabled = false;

  browser.privacy.network.peerConnectionEnabled.set = async () => {};
  browser.browserControl.applyMode = async () => {};
  data.mode = 'GHOST';
  data.ghostSession = { startedAt: 101, hosts: ['example.org'] };
  const ghostExit = await vm.runInContext("handleMode({type:'set-mode',mode:'NORMAL'})", context);
  assert.equal(data.mode, 'NORMAL', 'GHOST exit must complete on Firefox');
  assert.equal(data.ghostSession, undefined, 'successful cleanup must close GHOST session');
  assert.equal(ghostExit.mode, 'NORMAL');

  data.mode = 'GHOST';
  data.ghostSession = { startedAt: 101, hosts: ['example.org'] };
  context.beginGhostSession = async () => { data.ghostSession = { startedAt: 200, hosts: [] }; };
  browser.browserControl.applyMode = async mode => {
    if (mode === 'NORMAL') throw new Error('mode failed after cleanup');
  };
  await assert.rejects(vm.runInContext("handleMode({type:'set-mode',mode:'NORMAL'})", context), /mode failed after cleanup/);
  assert.equal(data.mode, 'GHOST');
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
  const element = () => ({ hidden: false, disabled: false, textContent: '',
    classList: { toggle() {} }, setAttribute() {} });
  const ui = Object.fromEntries([
    'modeWarning', 'adsButton', 'torButton', 'dnsProvider', 'secureDns',
    'dnsEndpoint', 'applyDns', 'torStatus', 'dnsStatus'
  ].map(name => [name, element()]));
  const uiContext = vm.createContext({ ...ui,
    torEnabled: false, torStarting: false, adsEnabled: true,
    setModeVisual() {}, renderResources() {}, updateSocksVisibility() {}, setPanelStatus() {}
  });
  vm.runInContext(sidebar.slice(sidebar.indexOf('function render(data)'),
    sidebar.indexOf('async function getStatus()')), uiContext);
  vm.runInContext("render({mode:'NORMAL', adsEnabled:true, modeHealth:{ok:true}, torStarting:true, torProcess:{running:true,bootstrapped:false}})", uiContext);
  assert.equal(ui.torButton.textContent, 'TOR: AVVIO');
  assert.equal(ui.modeWarning.hidden, true);
  vm.runInContext("render({mode:'NORMAL', modeHealth:{ok:true}, torEnabled:true, torRouted:false, torProcess:{running:false,bootstrapped:false}})", uiContext);
  assert.equal(ui.torButton.textContent, 'TOR: ERRORE');
  assert.equal(ui.modeWarning.hidden, false);
  vm.runInContext("render({mode:'NORMAL', adsEnabled:null, modeHealth:{ok:true}, torProcess:{running:false,bootstrapped:false}})", uiContext);
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

  let rulesets = [];
  browser.declarativeNetRequest = {
    async getEnabledRulesets() { return rulesets; },
    async updateEnabledRulesets() {}
  };
  vm.runInContext("const ADS_RULESET_ID = 'ads_basic';", context);
  vm.runInContext(section('async function getAdsEnabled()', 'async function applyDarkTheme('), context);
  await assert.rejects(vm.runInContext('setAdsEnabled(true)', context), /ADS non confermato/);
  rulesets = ['ads_basic'];
  await vm.runInContext('setAdsEnabled(true)', context);
  assert.equal(data.adsEnabled, true);

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

  process.stdout.write('GHOST/Tor/modes/theme/site blocklist, search race, Tavily quota, transitions and sidebar states: PASS\n');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
