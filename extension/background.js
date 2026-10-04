const MODE_LIMITS = { NORMAL: 3, TURBO: 3, PRIVATE: 3, GHOST: 3 };
const DEFAULT_MODE = 'NORMAL';
const PRIVACY_POLICY_STORAGE_KEY = 'filumPrivacyPolicy';
const SITE_OVERRIDES_KEY = 'filumSitePrivacyOverrides';
const SITE_SESSION_KEY = 'filumSitePrivacySessionOverrides';
const ADS_RULESET_ID = 'ads_basic';
const URLHAUS_MALWARE_RULESET_ID = 'urlhaus_malware_basic';
const SITE_BLOCK_RULE_PRIORITY = 1000;
const SITE_BLOCK_RULE_ID_START = 1500000;
const SITE_BLOCK_RULE_ID_LIMIT = SITE_BLOCK_RULE_ID_START + 5000;
const SITE_BLOCK_RESOURCE_TYPES = Object.freeze([
  'main_frame', 'sub_frame', 'script', 'image', 'xmlhttprequest', 'media', 'font', 'other'
]);
const BLOCK_COUNTER_RULESET_IDS = new Set([
  ADS_RULESET_ID,
  URLHAUS_MALWARE_RULESET_ID
]);
const TAVILY_DEFAULT_DAILY_LIMIT = 33;
const TAVILY_MONTHLY_LIMIT = 1000;

let sessionBlockCount = 0;
let sessionBlockCounterAvailable = false;
let latestPrivacySettingsRuntime = null;
const siteBlockRulesByKey = new Map();
let siteBlockUpdateQueue = Promise.resolve();

function queueSiteBlockUpdate(action) {
  const next = siteBlockUpdateQueue.then(action);
  siteBlockUpdateQueue = next.catch(() => {});
  return next;
}

function siteBlockKey(tabId, domain) {
  return JSON.stringify([tabId, domain]);
}

function getSiteBlockDomain(url) {
  try {
    const parsed = new URL(String(url || ''));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname.toLowerCase().replace(/\.$/, '') || null;
  } catch (_) {
    return null;
  }
}

async function getActiveSiteBlockTab() {
  try {
    const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    return tabs.find(tab => Number.isSafeInteger(tab.id) && tab.id >= 0) || null;
  } catch (_) {
    return null;
  }
}

async function initializeSiteBlockRules() {
  const dnr = browser.declarativeNetRequest;
  if (!dnr?.getSessionRules || !dnr?.updateSessionRules) return;

  const staleRuleIds = (await dnr.getSessionRules())
    .filter(rule => rule.id >= SITE_BLOCK_RULE_ID_START && rule.id < SITE_BLOCK_RULE_ID_LIMIT)
    .map(rule => rule.id);
  if (staleRuleIds.length) {
    await dnr.updateSessionRules({ removeRuleIds: staleRuleIds });
  }
  siteBlockRulesByKey.clear();
}

async function getSiteBlockStatus(tabId) {
  if (!Number.isSafeInteger(tabId) || tabId < 0) {
    return { available: false, tabId: null, domain: null, unblocked: false };
  }

  let tab;
  try { tab = await browser.tabs.get(tabId); }
  catch (_) { tab = null; }

  const domain = getSiteBlockDomain(tab?.url);
  if (!domain) return { available: false, tabId, domain: null, unblocked: false };
  return {
    available: true,
    tabId,
    domain,
    unblocked: siteBlockRulesByKey.has(siteBlockKey(tabId, domain))
  };
}

async function allocateSiteBlockRuleId() {
  const dnr = browser.declarativeNetRequest;
  const rules = await dnr.getSessionRules();
  const usedIds = new Set(rules.map(rule => rule.id));
  for (let id = SITE_BLOCK_RULE_ID_START; id < SITE_BLOCK_RULE_ID_LIMIT; id++) {
    if (!usedIds.has(id)) return id;
  }
  throw new Error('Limite delle eccezioni temporanee raggiunto.');
}

function toggleSiteBlock(tabId, domain, enable) {
  return queueSiteBlockUpdate(() => applySiteBlockToggle(tabId, domain, enable));
}

async function applySiteBlockToggle(tabId, domain, enable) {
  if (!Number.isSafeInteger(tabId) || tabId < 0 || typeof enable !== 'boolean') {
    throw new Error('Scheda o stato Smart Toggle non valido.');
  }
  const dnr = browser.declarativeNetRequest;
  if (!dnr?.getSessionRules || !dnr?.updateSessionRules) {
    throw new Error('Le regole DNR di sessione non sono disponibili.');
  }

  let tab;
  try { tab = await browser.tabs.get(tabId); }
  catch (_) { throw new Error('La scheda non è più disponibile.'); }
  const actualDomain = getSiteBlockDomain(tab?.url);
  const requestedDomain = String(domain || '').toLowerCase().replace(/\.$/, '');
  if (!actualDomain || requestedDomain !== actualDomain) {
    throw new Error('Il dominio della scheda è cambiato; aggiorna il controllo.');
  }

  const key = siteBlockKey(tabId, actualDomain);
  const current = siteBlockRulesByKey.get(key);
  if (enable && current) return getSiteBlockStatus(tabId);
  if (!enable && !current) return getSiteBlockStatus(tabId);

  if (enable) {
    const id = await allocateSiteBlockRuleId();
    await dnr.updateSessionRules({ addRules: [{
      id,
      priority: SITE_BLOCK_RULE_PRIORITY,
      action: { type: 'allow' },
      condition: {
        urlFilter: '*',
        initiatorDomains: [actualDomain],
        tabIds: [tabId],
        resourceTypes: SITE_BLOCK_RESOURCE_TYPES
      }
    }] });
    siteBlockRulesByKey.set(key, { id, tabId, domain: actualDomain });
  } else {
    await dnr.updateSessionRules({ removeRuleIds: [current.id] });
    siteBlockRulesByKey.delete(key);
  }

  return getSiteBlockStatus(tabId);
}

function removeSiteBlockRulesForTab(tabId) {
  return queueSiteBlockUpdate(() => applyRemoveSiteBlockRulesForTab(tabId));
}

async function applyRemoveSiteBlockRulesForTab(tabId) {
  const entries = [...siteBlockRulesByKey.entries()]
    .filter(([, rule]) => rule.tabId === tabId);
  if (!entries.length) return;
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: entries.map(([, rule]) => rule.id)
  });
  for (const [key] of entries) siteBlockRulesByKey.delete(key);
}

function recordDnrBlock(details) {
  const rule = details?.rule;
  if (!BLOCK_COUNTER_RULESET_IDS.has(rule?.rulesetId) ||
      !Number.isSafeInteger(rule?.ruleId)) return;

  sessionBlockCount = Math.min(Number.MAX_SAFE_INTEGER, sessionBlockCount + 1);
}

if (browser.declarativeNetRequest?.onRuleMatchedDebug) {
  browser.declarativeNetRequest.onRuleMatchedDebug.addListener(recordDnrBlock);
}

async function initializeBlockCounter() {
  sessionBlockCount = 0;
  sessionBlockCounterAvailable = false;
  const dnr = browser.declarativeNetRequest;
  if (!dnr?.getMatchedRules || !dnr?.onRuleMatchedDebug) return;

  try {
    await dnr.getMatchedRules({ minTimeStamp: Date.now() });
    sessionBlockCounterAvailable = true;
  } catch (_) {
    // Firefox exposes DNR feedback only when its debugging preference is enabled.
  }
}

function getBlockCount() {
  return {
    count: sessionBlockCount,
    available: sessionBlockCounterAvailable
  };
}

const SECURITY_LOG_KEY = 'security_audit_log';
const MAX_LOG_ENTRIES = 200;
const SECURITY_LOG_MODES = ['NORMAL', 'TURBO', 'PRIVATE', 'GHOST'];
const SECURITY_LOG_RESULTS = ['SUCCESS', 'ERROR'];
const SECURITY_LOG_EVENTS = ['TOR_ENABLE', 'TOR_DISABLE', 'CACHE_CLEAR', 'MODE_CHANGE'];

let securityLogQueue = [];
let securityLogWriting = false;

function logSecurityEvent(eventType, modeValue, result, metadata) {
  if (!SECURITY_LOG_EVENTS.includes(eventType) ||
      !SECURITY_LOG_RESULTS.includes(result)) return;

  const event = {
    timestamp: new Date().toISOString(),
    event_type: eventType,
    result
  };
  if (SECURITY_LOG_MODES.includes(modeValue)) event.mode = modeValue;

  if (metadata && Number.isSafeInteger(metadata.discarded) && metadata.discarded >= 0) {
    event.metadata = { discarded: metadata.discarded };
  }

  securityLogQueue.push(event);
  if (!securityLogWriting) void processSecurityLogQueue();
}

async function processSecurityLogQueue() {
  if (securityLogWriting) return;
  securityLogWriting = true;
  try {
    while (securityLogQueue.length) {
      const event = securityLogQueue.shift();
      try {
        const stored = await browser.storage.local.get(SECURITY_LOG_KEY);
        const previous = Array.isArray(stored[SECURITY_LOG_KEY])
          ? stored[SECURITY_LOG_KEY] : [];
        await browser.storage.local.set({
          [SECURITY_LOG_KEY]: [...previous, event].slice(-MAX_LOG_ENTRIES)
        });
      } catch (error) {
        console.warn('Security log write failed:', error?.message || error);
      }
    }
  } finally {
    securityLogWriting = false;
    if (securityLogQueue.length) void processSecurityLogQueue();
  }
}

let tavilyRequestInFlight = false;
let torStarting = false;
let controlTransition = Promise.resolve();
let ghostRecordQueue = Promise.resolve();
let ghostTrackingError = '';

function queueControlTransition(action) {
  const next = controlTransition.then(action);
  controlTransition = next.catch(() => {});
  return next;
}

function hasTorProxy(proxy) {
  return proxy?.proxyType === 'manual' && proxy.socks === '127.0.0.1:19050' &&
    proxy.socksVersion === 5 && proxy.proxyDNS === true;
}

function matchesRestoredProxy(actual, expected) {
  if (actual?.proxyType !== expected?.proxyType) return false;
  if (expected.proxyType !== 'manual') return true;
  const requiredKeys = ['socks', 'socksVersion', 'proxyDNS'];
  const optionalKeys = ['http', 'httpPort', 'ssl', 'sslPort', 'ftp', 'ftpPort', 'passthrough'];
  const normalizeOptional = value => value === undefined || value === null || value === '' ? null : value;
  // Gecko may omit unused proxy fields or return them as ""; treat those forms as equivalent.
  return requiredKeys.every(key => actual[key] === expected[key]) &&
    optionalKeys.every(key => normalizeOptional(actual[key]) === normalizeOptional(expected[key]));
}

async function restoreTorNetwork(proxy, level, uri) {
  let restored = true;
  try {
    await browser.proxy.settings.set({ value: proxy });
    const actual = (await browser.proxy.settings.get({})).value;
    if (!matchesRestoredProxy(actual, proxy)) throw new Error('Proxy restoration not confirmed');
  } catch (error) {
    restored = false;
    console.warn('Unable to restore proxy after TOR session', error);
  }
  try {
    await browser.browserControl.setSecureDns(level, uri);
    const actual = await browser.browserControl.getSettings();
    if (actual.secureDns !== level || (level !== 'off' && (actual.secureDnsUri || '') !== uri)) {
      throw new Error('DNS restoration not confirmed');
    }
  } catch (error) {
    restored = false;
    console.warn('Unable to restore DNS after TOR session', error);
  }
  return restored;
}

function localUsageDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function tavilyKeyStatus() {
  const saved = await browser.storage.local.get([
    'tavilyApiKey', 'tavilyUsage', 'tavilyMonthlyUsage', 'tavilyDailyLimit'
  ]);
  const day = localUsageDay();
  const month = day.slice(0, 7);
  return {
    configured: !!saved.tavilyApiKey,
    used: saved.tavilyUsage?.day === day ? saved.tavilyUsage.count : 0,
    limit: saved.tavilyDailyLimit || TAVILY_DEFAULT_DAILY_LIMIT,
    monthUsed: saved.tavilyMonthlyUsage?.month === month ? saved.tavilyMonthlyUsage.count : 0,
    monthLimit: TAVILY_MONTHLY_LIMIT
  };
}

async function searchTavilyExplicit(query) {
  if (tavilyRequestInFlight) throw new Error('Una ricerca Tavily è già in corso.');
  const q = String(query || '').trim();
  if (!q || q.length > 300) throw new Error('Query Tavily non valida.');
  tavilyRequestInFlight = true;
  try {
    const saved = await browser.storage.local.get([
      'tavilyApiKey', 'tavilyUsage', 'tavilyMonthlyUsage', 'tavilyDailyLimit'
    ]);
    if (!saved.tavilyApiKey) throw new Error('Inserisci prima la chiave Tavily.');
    const day = localUsageDay();
    const month = day.slice(0, 7);
    const usage = saved.tavilyUsage?.day === day ? saved.tavilyUsage : { day, count: 0, at: 0 };
    const monthly = saved.tavilyMonthlyUsage?.month === month
      ? saved.tavilyMonthlyUsage : { month, count: 0 };
    const dailyLimit = saved.tavilyDailyLimit || TAVILY_DEFAULT_DAILY_LIMIT;
    if (usage.count >= dailyLimit) throw new Error(`Limite locale Tavily di ${dailyLimit} ricerche oggi raggiunto.`);
    if (monthly.count >= TAVILY_MONTHLY_LIMIT) {
      throw new Error('Limite locale Tavily di 1.000 ricerche nel mese raggiunto.');
    }
    if (Date.now() - usage.at < 3000) throw new Error('Attendi tre secondi prima di usare Tavily.');

    // Count before sending so an uncertain network outcome cannot trigger an automatic duplicate.
    await browser.storage.local.set({
      tavilyUsage: { day, count: usage.count + 1, at: Date.now() },
      tavilyMonthlyUsage: { month, count: monthly.count + 1 }
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${saved.tavilyApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: q, topic: 'general', search_depth: 'basic',
          auto_parameters: false, max_results: 10,
          include_answer: false, include_raw_content: false
        }),
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit'
      });
      if (!response.ok) throw new Error(`Tavily API: HTTP ${response.status}. Nessun retry automatico.`);
      const data = await response.json();
      return {
        results: (data.results || []).slice(0, 10).map(item => ({
          title: String(item.title || ''), url: String(item.url || ''),
          snippet: String(item.content || '').slice(0, 500)
        })),
        usage: await tavilyKeyStatus()
      };
    } finally {
      clearTimeout(timer);
    }
  } finally {
    tavilyRequestInFlight = false;
  }
}

const DARK_THEME = {
  colors: {
    frame: '#111111',
    toolbar: '#171717',
    tab_background_text: '#f2f2f2',
    toolbar_text: '#f2f2f2',
    toolbar_field: '#202020',
    toolbar_field_text: '#f2f2f2',
    popup: '#171717',
    popup_text: '#f2f2f2',
    sidebar: '#111111',
    sidebar_text: '#f2f2f2'
  }
};

const BLACK_THEME = {
  colors: {
    frame: '#000000',
    toolbar: '#050505',
    tab_background_text: '#ffffff',
    toolbar_text: '#ffffff',
    toolbar_field: '#0b0b0b',
    toolbar_field_text: '#ffffff',
    popup: '#050505',
    popup_text: '#ffffff',
    sidebar: '#000000',
    sidebar_text: '#ffffff'
  }
};

async function getMode() {
  const saved = await browser.storage.local.get('mode');
  return MODE_LIMITS[saved.mode] ? saved.mode : DEFAULT_MODE;
}

async function applyHttpsOverride() {
  const saved = await browser.storage.local.get('httpsOnlyOverride');
  if (typeof saved.httpsOnlyOverride === 'boolean') {
    await browser.browserControl.setHttpsOnly(saved.httpsOnlyOverride);
  }
}

async function getAdsEnabled() {
  const enabled = await browser.declarativeNetRequest.getEnabledRulesets();
  return enabled.includes(ADS_RULESET_ID);
}

async function setAdsEnabled(enabled) {
  await browser.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? [ADS_RULESET_ID] : [],
    disableRulesetIds: enabled ? [] : [ADS_RULESET_ID]
  });
  if (await getAdsEnabled() !== enabled) throw new Error('ADS non confermato dal browser.');
  await browser.storage.local.set({ adsEnabled: enabled });
}

async function getUrlhausMalwareEnabled() {
  const enabled = await browser.declarativeNetRequest.getEnabledRulesets();
  return enabled.includes(URLHAUS_MALWARE_RULESET_ID);
}

async function setUrlhausMalwareEnabled(enabled) {
  await browser.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? [URLHAUS_MALWARE_RULESET_ID] : [],
    disableRulesetIds: enabled ? [] : [URLHAUS_MALWARE_RULESET_ID]
  });
  if (await getUrlhausMalwareEnabled() !== enabled) {
    throw new Error('URLhaus non confermato dal browser.');
  }
  await browser.storage.local.set({ urlhausMalwareEnabled: enabled });
}

async function applyDarkTheme(mode) {
  const selected = mode || (await browser.storage.local.get('browserTheme')).browserTheme || 'dark';
  if (selected === 'system') {
    await browser.theme.reset();
  } else {
    await browser.theme.update(selected === 'black' ? BLACK_THEME : DARK_THEME);
  }
}

async function setBrowserTheme(mode) {
  await applyDarkTheme(mode);
  await browser.storage.local.set({ browserTheme: mode });
  return { mode };
}

function isDiscarded(tab) {
  return !!tab.discarded;
}

function isHardProtected(tab, foregroundTabId) {
  return tab.id === foregroundTabId || tab.active || tab.pinned || tab.audible;
}

async function enforceBackgroundLimit() {
  const mode = await getMode();
  const limit = MODE_LIMITS[mode];
  const windows = await browser.windows.getAll({ populate: true });
  const focused = windows.find((w) => w.focused);
  const foreground = focused?.tabs?.find((t) => t.active);
  const foregroundTabId = foreground?.id;

  const tabs = windows.flatMap((w) =>
    (w.tabs || []).map((tab) => ({ ...tab, windowFocused: !!w.focused }))
  );

  const backgroundTabs = tabs.filter((tab) =>
    tab.id !== foregroundTabId && !isDiscarded(tab)
  );

  const protectedBackground = backgroundTabs.filter((tab) =>
    tab.active || tab.pinned || tab.audible
  );

  const candidates = backgroundTabs
    .filter((tab) => !isHardProtected(tab, foregroundTabId))
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

  const candidateSlots = Math.max(0, limit - protectedBackground.length);
  const initiallyKept = candidates.slice(0, candidateSlots);
  const overflow = candidates.slice(candidateSlots);

  const turboIdleMs = 90 * 1000;
  const now = Date.now();
  const turboExpired = mode === 'TURBO'
    ? initiallyKept.filter((tab) => now - (tab.lastAccessed || now) >= turboIdleMs)
    : [];

  const expiredIds = new Set(turboExpired.map((tab) => tab.id));
  const keptCandidates = initiallyKept.filter((tab) => !expiredIds.has(tab.id));

  const discardById = new Map();
  for (const tab of [...overflow, ...turboExpired]) discardById.set(tab.id, tab);
  const toDiscard = [...discardById.values()];

  let discardedNow = 0;
  let failedDiscards = 0;
  for (const tab of toDiscard) {
    try {
      await browser.tabs.discard(tab.id);
      discardedNow += 1;
    } catch (error) {
      failedDiscards += 1;
      console.warn('Unable to discard tab', tab.id, error);
    }
  }

  const activeBackground = protectedBackground.length + keptCandidates.length + failedDiscards;
  const degraded = activeBackground > limit;

  await browser.storage.local.set({
    status: {
      mode,
      limit,
      activeBackground,
      protectedBackground: protectedBackground.length,
      keptCandidates: keptCandidates.length,
      discardedNow,
      failedDiscards,
      degradedByProtectedTabs: degraded,
      turboIdleDiscardMs: mode === 'TURBO' ? turboIdleMs : null,
      updatedAt: Date.now()
    }
  });
}

async function applyRuntimePrivacy(mode) {
  const torEnabled = !!(await browser.storage.local.get('torEnabled')).torEnabled;
  const resolved = await resolvePrivacyPolicy(mode, torEnabled || torStarting);
  const { features } = resolved;
  const webgl = features.webgl.effective;
  const nativeResult = await browser.browserControl.applyPrivacyPreferences(JSON.stringify({
    javascriptEnabled: features.javascript.effective === 'full',
    fingerprintingResistance: features.canvas.effective === 'protected',
    webglDisabled: webgl === 'blocked',
    webgl2Enabled: webgl === 'normal'
  }));
  if (nativeResult.javascriptEnabled !== (features.javascript.effective === 'full') ||
      nativeResult.fingerprintingResistance !== (features.canvas.effective === 'protected') ||
      nativeResult.webglDisabled !== (webgl === 'blocked') ||
      nativeResult.webgl2Enabled !== (webgl === 'normal')) {
    throw new Error('Readback mismatch applying native privacy policy');
  }

  await browser.privacy.websites.trackingProtectionMode.set({ value:
    features.tracking.effective === 'strict' ? 'always' : 'private_browsing' });
  await browser.privacy.websites.cookieConfig.set({ value: {
    behavior: features.cookies.effective === 'third-party-blocked'
      ? 'reject_third_party' : 'reject_trackers_and_partition_foreign'
  } });
  await browser.privacy.websites.hyperlinkAuditingEnabled.set({ value: false });
  await browser.privacy.websites.referrersEnabled.set({ value: mode !== 'GHOST' });
  await browser.privacy.network.networkPredictionEnabled.set({ value: false });
  const webrtc = features.webrtc.effective;
  await browser.privacy.network.peerConnectionEnabled.set({ value: webrtc !== 'blocked' });
  await browser.privacy.network.webRTCIPHandlingPolicy.set({
    value: webrtc === 'allow' ? 'default_public_interface_only' : 'disable_non_proxied_udp'
  });
  // RFP reflects the resolved Canvas/fingerprinting control, while Tor can only strengthen it.
  await browser.privacy.websites.resistFingerprinting.set({
    value: features.canvas.effective === 'protected' || torEnabled
  });
  return resolved;
}

async function resolvePrivacyPolicy(mode, torEnabled = false) {
  const stored = (await browser.storage.local.get(PRIVACY_POLICY_STORAGE_KEY))[PRIVACY_POLICY_STORAGE_KEY];
  return FilumPolicyEngine.resolve(stored, mode, { torEnabled });
}

async function getPrivacyPolicyStatus(mode = undefined) {
  const currentMode = mode || await getMode();
  const torEnabled = !!(await browser.storage.local.get('torEnabled')).torEnabled;
  const state = (await browser.storage.local.get(PRIVACY_POLICY_STORAGE_KEY))[PRIVACY_POLICY_STORAGE_KEY];
  const resolved = FilumPolicyEngine.resolve(state, currentMode, { torEnabled: torEnabled || torStarting });
  const prefs = await browser.browserControl.getModeDiagnostics();
  const actual = {
    javascript: prefs.javascriptEnabled ? 'full' : 'blocked',
    canvas: prefs.fingerprintResistance ? 'protected' : 'standard',
    webgl: prefs.webglDisabled ? 'blocked' : prefs.webgl2Enabled ? 'normal' : 'limited'
  };
  const fields = { ...resolved.features };
  for (const feature of Object.keys(actual)) {
    fields[feature] = { ...fields[feature],
      verified: actual[feature] === fields[feature].effective ? 'PASS' : 'FAIL',
      actual: actual[feature] };
  }
  const [peerConnection, webRtcPolicy, tracking, cookies] = await Promise.all([
    browser.privacy.network.peerConnectionEnabled.get({}),
    browser.privacy.network.webRTCIPHandlingPolicy.get({}),
    browser.privacy.websites.trackingProtectionMode.get({}),
    browser.privacy.websites.cookieConfig.get({})
  ]);
  actual.webrtc = !peerConnection.value ? 'blocked'
    : webRtcPolicy.value === 'disable_non_proxied_udp' ? 'protect'
      : webRtcPolicy.value === 'default_public_interface_only' ? 'allow' : null;
  actual.tracking = tracking.value === 'always' ? 'strict'
    : tracking.value === 'private_browsing' ? 'baseline' : null;
  actual.cookies = cookies.value?.behavior === 'reject_third_party' ? 'third-party-blocked'
    : cookies.value?.behavior === 'reject_trackers_and_partition_foreign' ? 'partitioned' : null;
  for (const feature of ['webrtc', 'tracking', 'cookies']) {
    fields[feature] = { ...fields[feature], actual: actual[feature] || null,
      verified: actual[feature] === null ? 'NOT VERIFIED'
        : actual[feature] === fields[feature].effective ? 'PASS' : 'FAIL' };
  }
  return {
    ...resolved,
    manualLevel: typeof state?.level === 'string',
    torEnabled: torEnabled || torStarting,
    configuration: FilumPolicyEngine.normalizeState(state, currentMode),
    features: fields,
    siteOverrides: 'EXACT_ORIGIN · Canvas e tracking solo con permesso Gecko readback'
  };
}

function normalizeSiteStore(value) {
  const sites = {};
  for (const [origin, item] of Object.entries(value?.sites || {})) {
    if (FilumPolicyEngine.normalizeOrigin(origin) !== origin || !item || typeof item !== 'object') continue;
    const override = FilumPolicyEngine.normalizeSiteOverride(item);
    if (override) sites[origin] = { ...override, permissions: item.permissions || {}, updatedAt: item.updatedAt || 0 };
  }
  return { version: 1, sites };
}

async function readSiteStores() {
  const [local, session] = await Promise.all([
    browser.storage.local.get(SITE_OVERRIDES_KEY),
    browser.storage.session ? browser.storage.session.get(SITE_SESSION_KEY) : Promise.resolve({})
  ]);
  return { persistent: normalizeSiteStore(local[SITE_OVERRIDES_KEY]),
    session: normalizeSiteStore(session[SITE_SESSION_KEY]), sessionAvailable: !!browser.storage.session };
}

async function writeSiteStore(scope, store) {
  const storage = scope === 'session' ? browser.storage.session : browser.storage.local;
  const key = scope === 'session' ? SITE_SESSION_KEY : SITE_OVERRIDES_KEY;
  if (!storage) throw new Error('Le eccezioni temporanee non sono disponibili.');
  if (Object.keys(store.sites).length) await storage.set({ [key]: store });
  else await storage.remove(key);
}

async function siteStatus(origin = undefined, tabId = undefined, windowId = undefined) {
  const tab = Number.isSafeInteger(tabId) ? await browser.tabs.get(tabId).catch(() => null)
    : (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  const actualOrigin = FilumPolicyEngine.normalizeOrigin(tab?.url || tab?.pendingUrl || '');
  if (!tab || !actualOrigin || (origin && origin !== actualOrigin) ||
      (Number.isInteger(windowId) && tab.windowId !== windowId)) {
    return { available: false, reason: 'Scheda corrente non HTTP(S) o origine cambiata.' };
  }
  if (tab.incognito) return { available: false, reason: 'Eccezioni sito disabilitate nelle finestre private Firefox.', origin: actualOrigin };
  if (tab.cookieStoreId && tab.cookieStoreId !== 'firefox-default') {
    return { available: false, reason: 'Override sito non disponibile nei contenitori Firefox.', origin: actualOrigin };
  }
  const stores = await readSiteStores();
  const override = stores.session.sites[actualOrigin] || stores.persistent.sites[actualOrigin] || null;
  const scope = stores.session.sites[actualOrigin] ? 'session'
    : stores.persistent.sites[actualOrigin] ? 'persistent' : null;
  const mode = await getMode();
  const [global, native] = await Promise.all([
    getPrivacyPolicyStatus(mode), browser.browserControl.getSitePrivacyPermissions(actualOrigin)
  ]);
  const torEnabled = !!(await browser.storage.local.get('torEnabled')).torEnabled || torStarting;
  const actual = Object.fromEntries(Object.entries(global.features)
    .map(([key, value]) => [key, value.actual ?? value.effective]));
  if (native.permissions.canvas.action === 'allow') actual.canvas = 'standard';
  if (native.permissions.tracking.action === 'allow') actual.tracking = 'baseline';
  const owned = override?.permissions || {};
  const resolved = FilumPolicyEngine.resolveSite(global.configuration, mode, override, {
    torEnabled, actual,
    sitePermissions: { canvas: native.permissions.canvas.action, tracking: native.permissions.tracking.action },
    ownedSitePermissions: {
      canvas: owned.canvas?.action === native.permissions.canvas.action,
      tracking: owned.tracking?.action === native.permissions.tracking.action
    }
  });
  return { ...resolved, available: true, origin: actualOrigin, host: new URL(actualOrigin).host,
    tabId: tab.id, windowId: tab.windowId, mode, globalLevel: global.level,
    manualGlobalLevel: global.manualLevel, overrideScope: scope, persistentOverride: stores.persistent.sites[actualOrigin] || null,
    sessionOverride: stores.session.sites[actualOrigin] || null, sessionAvailable: stores.sessionAvailable,
    nativePermissionOverride: Object.values(native.permissions).some(permission => permission.action !== 'none'),
    torCanvasConflict: torEnabled && native.permissions.canvas.action === 'allow',
    nativePermissions: native.permissions };
}

function sitePermissionRequests(level, global) {
  const preset = FilumPolicyEngine.PRESETS[level];
  const result = {};
  if (preset?.canvas === 'standard' && global.features.canvas.effective === 'protected') result.canvas = 'allow';
  if (preset?.tracking === 'baseline' && global.features.tracking.effective === 'strict') result.tracking = 'allow';
  return result;
}

async function applySitePermissions(origin, oldRecord, desired, scope, torEnabled) {
  const current = await browser.browserControl.getSitePrivacyPermissions(origin);
  const changes = [];
  const owned = {};
  for (const feature of ['canvas', 'tracking']) {
    const actual = current.permissions[feature];
    const previous = oldRecord?.permissions?.[feature];
    const requested = desired[feature];
    if (actual.action !== 'none' && !previous) {
      if (actual.action === requested && requested === 'allow') continue;
      if (requested) throw new Error(`Gecko ha già un permesso ${feature} per questo sito; non verrà sovrascritto.`);
      continue;
    }
    if (previous && actual.action !== previous.action && !(previous.suspendedByTor && actual.action === 'none')) {
      throw new Error(`Il permesso ${feature} è stato modificato fuori da FILUM.`);
    }
    if (requested === 'allow' && torEnabled && feature === 'canvas') {
      owned[feature] = { action: 'allow', scope, suspendedByTor: true };
      if (actual.action === 'allow') changes.push({ feature, action: 'remove', scope, expected: actual });
    } else if (requested === 'allow') {
      owned[feature] = { action: 'allow', scope, suspendedByTor: false };
      if (actual.action !== 'allow' || actual.scope !== scope) changes.push({ feature, action: 'allow', scope, expected: actual });
    } else if (previous && actual.action !== 'none') {
      changes.push({ feature, action: 'remove', scope, expected: actual });
    }
  }
  const readback = changes.length
    ? await browser.browserControl.setSitePrivacyPermissions(JSON.stringify({ origin, changes })) : current;
  for (const feature of Object.keys(owned)) owned[feature].expireType = readback.permissions[feature].expireType;
  return owned;
}

async function setSiteOverride(tabId, origin, windowId, request) {
  return queueControlTransition(async () => {
    const tab = await browser.tabs.get(tabId);
    const active = (await browser.tabs.query({ active: true, windowId }))[0];
    if (!tab || tab.incognito || (tab.cookieStoreId && tab.cookieStoreId !== 'firefox-default') ||
        active?.id !== tabId || tab.windowId !== windowId ||
        FilumPolicyEngine.normalizeOrigin(tab.url || tab.pendingUrl || '') !== origin) throw new Error('La scheda o origine è cambiata.');
    if (request.operation && request.operation !== 'canvas-exception') throw new Error('Operazione per-sito non supportata.');
    const exceptionOnly = request.operation === 'canvas-exception';
    if ((!exceptionOnly && !FilumPolicyEngine.LEVELS.includes(request.level)) || !['session', 'persistent'].includes(request.scope)) throw new Error('Livello o durata non validi.');
    if (exceptionOnly && request.scope !== 'session') throw new Error('L’eccezione Canvas è solo temporanea.');
    const stores = await readSiteStores();
    const oldScope = stores.session.sites[origin] ? 'session' : stores.persistent.sites[origin] ? 'persistent' : null;
    if (oldScope && oldScope !== request.scope) throw new Error('Rimuovi prima l’override esistente per cambiare durata.');
    if (request.scope === 'session' && !stores.sessionAvailable) throw new Error('storage.session non disponibile.');
    const tor = !!(await browser.storage.local.get('torEnabled')).torEnabled || torStarting;
    const global = await getPrivacyPolicyStatus(await getMode());
    const before = stores[request.scope].sites[origin] || null;
    if (tor && exceptionOnly) throw new Error('Tor mantiene Canvas RFP attiva; l’eccezione è disabilitata.');
    const level = exceptionOnly ? before?.level || null : request.level;
    const canvasException = exceptionOnly ? 'allow-extract' : before?.canvasException || null;
    const wanted = sitePermissionRequests(level, global);
    if (canvasException) wanted.canvas = 'allow';
    const native = await applySitePermissions(origin, before, wanted, request.scope, tor);
    const record = { level, canvasException, permissions: native, updatedAt: Date.now() };
    const next = { ...stores[request.scope], sites: { ...stores[request.scope].sites, [origin]: record } };
    try { await writeSiteStore(request.scope, next); }
    catch (error) {
      await applySitePermissions(origin, record,
        Object.fromEntries(Object.entries(before?.permissions || {}).map(([key, p]) => [key, p.action])),
        request.scope, tor).catch(rollback => { throw new Error(`${error.message}; rollback failed: ${rollback.message}`); });
      throw error;
    }
    await browser.tabs.reload(tabId).catch(() => {});
    return siteStatus(origin, tabId, windowId);
  });
}

async function removeSiteOverride(origin, scope = 'all') {
  return queueControlTransition(async () => {
    if (FilumPolicyEngine.normalizeOrigin(origin) !== origin || !['session', 'persistent', 'all'].includes(scope)) throw new Error('Origine/durata non valida.');
    const stores = await readSiteStores();
    const scopes = scope === 'all' ? ['session', 'persistent'] : [scope];
    const oldScope = stores.session.sites[origin] ? 'session' : stores.persistent.sites[origin] ? 'persistent' : null;
    for (const item of scopes) {
      const record = stores[item].sites[origin];
      if (!record) continue;
      const next = { ...stores[item], sites: { ...stores[item].sites } };
      delete next.sites[origin];
      await writeSiteStore(item, next);
      try {
        await applySitePermissions(origin, record, {}, item,
          !!(await browser.storage.local.get('torEnabled')).torEnabled || torStarting);
      } catch (error) {
        await writeSiteStore(item, stores[item]).catch(rollback => {
          throw new Error(`${error.message}; storage rollback failed: ${rollback.message}`);
        });
        throw error;
      }
    }
    return { removed: !!oldScope };
  });
}

async function listSiteOverrides() {
  const stores = await readSiteStores();
  const origins = new Set([...Object.keys(stores.persistent.sites), ...Object.keys(stores.session.sites)]);
  return [...origins].sort().map(origin => ({ origin,
    persistent: stores.persistent.sites[origin] || null, session: stores.session.sites[origin] || null }));
}

async function syncSiteOverridesForTor(enabled) {
  const stores = await readSiteStores();
  if (enabled) {
    const owned = new Set(['persistent', 'session'].flatMap(scope => Object.entries(stores[scope].sites)
      .filter(([, record]) => record.permissions?.canvas?.action === 'allow').map(([origin]) => origin)));
    const allows = await browser.browserControl.getCanvasAllowPermissionOrigins();
    const unmanaged = allows.find(item => !owned.has(item.origin));
    if (unmanaged) throw new Error(`Tor bloccato: permesso Canvas Gecko esterno su ${unmanaged.origin}.`);
  }
  const global = await getPrivacyPolicyStatus(await getMode());
  for (const scope of ['persistent', 'session']) {
    const nextSites = { ...stores[scope].sites };
    let changed = false;
    for (const [origin, record] of Object.entries(stores[scope].sites)) {
      const desired = sitePermissionRequests(record.level, global);
      if (record.canvasException) desired.canvas = 'allow';
      const permissions = await applySitePermissions(origin, record, desired, scope, enabled);
      nextSites[origin] = { ...record, permissions };
      changed = true;
    }
    if (changed) await writeSiteStore(scope, { ...stores[scope], sites: nextSites });
  }
}

function trustedFilumPage(sender, filename) {
  try {
    const url = new URL(sender?.url || '');
    return url.origin === new URL(browser.runtime.getURL('/')).origin && url.pathname.endsWith(`/${filename}`);
  } catch (_) { return false; }
}

async function getModeHealth(mode, torEnabled) {
  const issues = [];
  const expect = (label, actual, expected) => {
    if (actual !== expected) issues.push(`${label}: ${String(actual)} (atteso ${String(expected)})`);
  };
  const read = async (label, setting) => {
    try { return (await setting.get({})).value; }
    catch (error) {
      issues.push(`${label}: lettura fallita (${error?.message || error})`);
      return undefined;
    }
  };

  try {
    const prefs = await browser.browserControl.getModeDiagnostics();
    const policy = await resolvePrivacyPolicy(mode, torEnabled);
    const expectedRFP = policy.features.canvas.effective === 'protected' || torEnabled;
    const expectedWebRtc = policy.features.webrtc.effective !== 'blocked' && !torEnabled;
    expect('Autoplay', prefs.autoplay, mode === 'TURBO' || mode === 'GHOST' ? 5 : 1);
    expect('Fingerprint (preferenza)', prefs.fingerprintResistance, expectedRFP);
    expect('JavaScript (preferenza)', prefs.javascriptEnabled,
      policy.features.javascript.effective === 'full');
    expect('WebGL disabilitato', prefs.webglDisabled,
      policy.features.webgl.effective === 'blocked');
    expect('WebGL 2 abilitato', prefs.webgl2Enabled,
      policy.features.webgl.effective === 'normal');
    expect('Prefetch', prefs.prefetch, false);
    expect('DNS prefetch', prefs.dnsPrefetch, true);
    expect('Cookie senza archiviazione persistente', prefs.cookieNoPersistentStorage, mode === 'GHOST');

    const [fingerprint, tracking, cookies, webRtc, referrers, webRtcPolicy, prediction, auditing] = await Promise.all([
      read('Fingerprint', browser.privacy.websites.resistFingerprinting),
      read('Protezione tracciamento', browser.privacy.websites.trackingProtectionMode),
      read('Cookie', browser.privacy.websites.cookieConfig),
      read('WebRTC', browser.privacy.network.peerConnectionEnabled),
      read('Referrer', browser.privacy.websites.referrersEnabled),
      read('Policy WebRTC', browser.privacy.network.webRTCIPHandlingPolicy),
      read('Predizione rete', browser.privacy.network.networkPredictionEnabled),
      read('Hyperlink auditing', browser.privacy.websites.hyperlinkAuditingEnabled)
    ]);
    if (fingerprint !== undefined) expect('Fingerprint', fingerprint, expectedRFP);
    if (tracking !== undefined) expect('Protezione tracciamento', tracking,
      policy.features.tracking.effective === 'strict' ? 'always' : 'private_browsing');
    if (cookies !== undefined) {
      expect('Protezione cookie', cookies?.behavior,
        policy.features.cookies.effective === 'third-party-blocked'
          ? 'reject_third_party' : 'reject_trackers_and_partition_foreign');
    }
    if (mode === 'GHOST') {
      expect('Cookie behavior hardening', prefs.ghostCookieBehavior, 1);
      expect('FPI', prefs.ghostFpi, true);
      expect('WASM', prefs.ghostWasm, false);
      expect('HTTP/3', prefs.ghostHttp3, false);
      expect('Alt-Svc', prefs.ghostAltSvc, false);
    }
    if (webRtc !== undefined) expect('WebRTC', webRtc, expectedWebRtc);
    if (referrers !== undefined) expect('Referrer', referrers, mode !== 'GHOST');
    if (webRtcPolicy !== undefined) expect('Policy WebRTC', webRtcPolicy,
      policy.features.webrtc.effective !== 'allow' || torEnabled
        ? 'disable_non_proxied_udp' : 'default_public_interface_only');
    if (prediction !== undefined) expect('Predizione rete', prediction, false);
    if (auditing !== undefined) expect('Hyperlink auditing', auditing, false);
    if (mode === 'GHOST' && !(await browser.storage.local.get('ghostSession')).ghostSession) {
      issues.push('Sessione GHOST assente');
    }
    if (ghostTrackingError) {
      issues.push('Tracciamento GHOST incompleto: ' + ghostTrackingError);
    }
  } catch (error) {
    issues.push('Verifica modalità fallita: ' + (error?.message || error));
  }

  return { ok: issues.length === 0, issues, checkedAt: Date.now() };
}

async function setGhostJavascript(enabled) {
  return queueControlTransition(async () => {
    if (await getMode() !== 'GHOST') {
      throw new Error('Il controllo JavaScript è disponibile solo in modalità GHOST.');
    }
    const previous = (await browser.storage.local.get(PRIVACY_POLICY_STORAGE_KEY))[PRIVACY_POLICY_STORAGE_KEY];
    const next = FilumPolicyEngine.update(previous, 'GHOST', {
      type: 'set-feature', feature: 'javascript', value: enabled ? 'full' : 'blocked'
    });
    await browser.storage.local.set({ [PRIVACY_POLICY_STORAGE_KEY]: next });
    let result;
    try {
      await applyRuntimePrivacy('GHOST');
      result = { enabled: (await browser.browserControl.getModeDiagnostics()).javascriptEnabled };
    } catch (error) {
      if (previous === undefined) await browser.storage.local.remove(PRIVACY_POLICY_STORAGE_KEY);
      else await browser.storage.local.set({ [PRIVACY_POLICY_STORAGE_KEY]: previous });
      await applyRuntimePrivacy('GHOST').catch(() => {});
      throw error;
    }
    let reloaded = false;
    try {
      const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      const activeUrl = tab?.url || tab?.pendingUrl || '';
      if (Number.isInteger(tab?.id) && /^https?:/i.test(activeUrl)) {
        await browser.tabs.reload(tab.id);
        reloaded = true;
      }
    } catch (error) {
      console.warn('JavaScript preference changed but active tab reload failed:', error?.message || error);
    }
    return { ...result, reloaded };
  });
}

async function beginGhostSession() {
  await browser.storage.local.set({
    ghostSession: {
      startedAt: Date.now(),
      hosts: []
    }
  });
  ghostTrackingError = '';
}

async function trackGhostHost(url) {
  if (!url) return;

  const mode = await getMode();
  if (mode !== 'GHOST') return;

  let hostname;
  try { hostname = new URL(url).hostname; }
  catch { return; } // Ignore about: and other non-web URLs.
  if (!hostname) return;
  try {
    const data = await browser.storage.local.get('ghostSession');
    const session = data.ghostSession || { startedAt: Date.now(), hosts: [] };

    if (!session.hosts.includes(hostname)) {
      session.hosts.push(hostname);
      await browser.storage.local.set({ ghostSession: session });
    }
  } catch (error) {
    ghostTrackingError = error?.message || String(error);
    throw error;
  }
}

function recordGhostHost(url) {
  const next = ghostRecordQueue.then(() => trackGhostHost(url));
  ghostRecordQueue = next.catch(error => console.warn('Unable to record GHOST host', error));
  return next;
}

async function endGhostSession() {
  await ghostRecordQueue;
  const data = await browser.storage.local.get('ghostSession');
  const session = data.ghostSession;

  if (!session?.startedAt) {
    await browser.storage.local.remove('ghostSession');
    return;
  }

  const hosts = Array.isArray(session.hosts) ? session.hosts : [];

  if (hosts.length) {
    // Firefox rejects `since` for localStorage. Site storage must be removed
    // by hostname; time filtering remains valid for history and form data.
    await browser.browsingData.remove(
      { hostnames: hosts },
      {
        indexedDB: true,
        localStorage: true,
        serviceWorkers: true
      }
    );
    await browser.browsingData.remove(
      { hostnames: hosts, since: session.startedAt },
      { cookies: true }
    );
  }

    await browser.browsingData.remove(
      { since: session.startedAt },
      {
        history: true,
        formData: true
      }
    );

  // Preserve the record on failure so the user can retry instead of silently losing it.
  await browser.storage.local.remove('ghostSession');
}


let socksAuthListener = null;
let torAuthSuspended = false;

function removeSocksAuthHandler() {
  if (socksAuthListener) {
    browser.proxy.onRequest.removeListener(socksAuthListener);
    socksAuthListener = null;
  }
}

function validSocksAuthProfile(profile) {
  return !!profile && typeof profile.host === 'string' && profile.host.trim() &&
    Number.isInteger(profile.port) && profile.port >= 1 && profile.port <= 65535 &&
    typeof profile.user === 'string' && profile.user.length > 0 &&
    typeof profile.pass === 'string' && profile.pass.length > 0;
}

async function restoreSocksAuthProfile() {
  const saved = await browser.storage.local.get(['torEnabled', 'socks_auth_profile']);
  if (torAuthSuspended || torStarting || saved.torEnabled) {
    removeSocksAuthHandler();
    return false;
  }

  const profile = saved.socks_auth_profile;
  if (!validSocksAuthProfile(profile)) {
    removeSocksAuthHandler();
    return false;
  }

  const current = (await browser.proxy.settings.get({})).value || {};
  if (current.proxyType !== 'manual' || current.socks !== profile.host + ':' + profile.port ||
      current.socksVersion !== 5) {
    removeSocksAuthHandler();
    return false;
  }

  removeSocksAuthHandler();
  socksAuthListener = async () => {
    const state = await browser.storage.local.get(['torEnabled', 'socks_auth_profile']);
    if (torAuthSuspended || torStarting || state.torEnabled) return null;
    const active = state.socks_auth_profile;
    if (!validSocksAuthProfile(active)) return null;

    const proxy = (await browser.proxy.settings.get({})).value || {};
    if (proxy.proxyType !== 'manual' || proxy.socks !== active.host + ':' + active.port ||
        proxy.socksVersion !== 5) return null;

    return {
      type: 'socks',
      host: active.host,
      port: active.port,
      username: active.user,
      password: active.pass,
      proxyDNS: true
    };
  };
  browser.proxy.onRequest.addListener(socksAuthListener, { urls: ['<all_urls>'] });
  return true;
}

async function setNetworkProxy(config) {
  if (!config || !['direct', 'system'].includes(config.mode)) {
    throw new Error('Modalità proxy non valida.');
  }
  const state = await browser.storage.local.get('torEnabled');
  if (torAuthSuspended || torStarting || state.torEnabled) throw new Error('La rete è gestita da TOR.');

  removeSocksAuthHandler();
  const value = config.mode === 'direct'
    ? { proxyType: 'none' }
    : { proxyType: 'system' };
  try {
    await browser.proxy.settings.set({ value });
    const applied = (await browser.proxy.settings.get({})).value || {};
    if (!matchesRestoredProxy(applied, value)) throw new Error('Impostazione proxy non confermata.');
  } catch (error) {
    await restoreSocksAuthProfile();
    throw error;
  }
  await browser.storage.local.remove('socks_auth_profile');
  return { success: true };
}

async function setSocksAuthProxy(config) {
  const { host, port, user = '', pass = '' } = config || {};
  if (typeof host !== 'string' || !host.trim() || !Number.isInteger(port) ||
      port < 1 || port > 65535) throw new Error('SOCKS5: host o porta non validi.');
  if (typeof user !== 'string' || typeof pass !== 'string') throw new Error('Credenziali SOCKS5 non valide.');
  if (!!user !== !!pass) throw new Error('SOCKS5: inserisci username e password insieme.');
  const state = await browser.storage.local.get('torEnabled');
  if (torAuthSuspended || torStarting || state.torEnabled) throw new Error('La rete è gestita da TOR.');

  removeSocksAuthHandler();
  const value = {
    proxyType: 'manual',
    socks: host.trim() + ':' + port,
    socksVersion: 5,
    proxyDNS: true,
    passthrough: 'localhost, 127.0.0.1'
  };
  await browser.proxy.settings.set({ value });
  const applied = (await browser.proxy.settings.get({})).value || {};
  if (!matchesRestoredProxy(applied, value)) {
    await restoreSocksAuthProfile();
    throw new Error('Impostazione proxy SOCKS5 non confermata.');
  }

  if (user) {
    const profile = { host: host.trim(), port, user, pass };
    await browser.storage.local.set({ socks_auth_profile: profile });
    await restoreSocksAuthProfile();
  } else {
    await browser.storage.local.remove('socks_auth_profile');
  }
  return { success: true, authenticated: !!user };
}

async function restoreStaleTorState() {
  const saved = await browser.storage.local.get([
    'torEnabled',
    'torPreviousProxy',
    'torPreviousSecureDns',
    'torPreviousSecureDnsUri'
  ]);

  if (!saved.torEnabled) return;

  torAuthSuspended = true;
  removeSocksAuthHandler();
  const restored = await restoreTorNetwork(saved.torPreviousProxy || { proxyType: 'system' },
    saved.torPreviousSecureDns || 'off', saved.torPreviousSecureDnsUri || '');

  try {
    await browser.browserControl.stopTor();
  } catch (_) {}

  if (restored) {
    await browser.storage.local.set({ torEnabled: false });
    await browser.storage.local.remove([
      'torPreviousProxy', 'torPreviousSecureDns', 'torPreviousSecureDnsUri'
    ]);
    torAuthSuspended = false;
    await syncSiteOverridesForTor(false);
  }
}

async function setTorEnabled(enabled, keepAuthSuspended = false) {
  torAuthSuspended = true;
  removeSocksAuthHandler();
  const saved = await browser.storage.local.get([
    'torEnabled',
    'torPreviousProxy',
    'torPreviousSecureDns',
    'torPreviousSecureDnsUri'
  ]);

  if (enabled && saved.torEnabled) {
    await syncSiteOverridesForTor(true);
    await applyRuntimePrivacy(await getMode(), true);
    const process = await browser.browserControl.getTorStatus();

    const proxy = (await browser.proxy.settings.get({})).value;
    const [webRtc, dns] = await Promise.all([
      browser.privacy.network.peerConnectionEnabled.get({}),
      browser.browserControl.getSettings()
    ]);
    const fingerprintSetting = browser.privacy.websites?.resistFingerprinting;
    const fingerprintOk = !fingerprintSetting ||
      (await fingerprintSetting.get({})).value === true;
    if (process?.bootstrapped && hasTorProxy(proxy) && webRtc?.value === false &&
        dns.secureDns === 'off' && fingerprintOk) {
      return { enabled: true, process };
    }
    await setTorEnabled(false, true);
    return setTorEnabled(true, true);
  }

  if (!enabled && !saved.torEnabled) {
    try {
      await browser.browserControl.stopTor();
    } catch (_) {}
    await applyRuntimePrivacy(await getMode(), false);
    await syncSiteOverridesForTor(false);
    if (!keepAuthSuspended) {
      torAuthSuspended = false;
      await restoreSocksAuthProfile();
    }
    return { enabled: false, process: { running: false, bootstrapped: false } };
  }

  if (enabled) {
    const previousProxy = await browser.proxy.settings.get({});
    const settings = await browser.browserControl.getSettings();

    await browser.storage.local.set({
      torPreviousProxy: previousProxy?.value || { proxyType: 'system' },
      torPreviousSecureDns: settings.secureDns || 'off',
      torPreviousSecureDnsUri: settings.secureDnsUri || ''
    });

    torStarting = true;
    try {
      await syncSiteOverridesForTor(true);
      // Raise RFP before Tor starts, so the transition never sends proxied traffic with RFP off.
      await applyRuntimePrivacy(await getMode());
      const process = await browser.browserControl.startTor();

      await browser.proxy.settings.set({
        value: {
          proxyType: 'manual',
          socks: process.socksHost + ':' + process.socksPort,
          socksVersion: 5,
          proxyDNS: true,
          passthrough: 'localhost, 127.0.0.1'
        }
      });

      await browser.browserControl.setSecureDns('off');

      await browser.privacy.network.peerConnectionEnabled.set({ value: false });
      const [appliedProxy, webRtc, appliedDns] = await Promise.all([
        browser.proxy.settings.get({}),
        browser.privacy.network.peerConnectionEnabled.get({}),
        browser.browserControl.getSettings()
      ]);
      const fingerprintSetting = browser.privacy.websites?.resistFingerprinting;
      const fingerprintOk = !fingerprintSetting ||
        (await fingerprintSetting.get({})).value === true;
      if (!hasTorProxy(appliedProxy?.value) || webRtc?.value !== false ||
          appliedDns.secureDns !== 'off' || !fingerprintOk) {
        throw new Error('TOR non confermato: proxy, DNS, WebRTC o RFP non corrispondono.');
      }

      await browser.storage.local.set({ torEnabled: true });
      return { enabled: true, process };
    } catch (error) {
      try {
        await browser.browserControl.stopTor();
      } catch (_) {}

      const restored = await restoreTorNetwork(previousProxy?.value || { proxyType: 'system' },
        settings.secureDns || 'off', settings.secureDnsUri || '');

      await browser.storage.local.set({ torEnabled: !restored });
      if (restored) {
        torStarting = false;
        await browser.storage.local.remove([
          'torPreviousProxy', 'torPreviousSecureDns', 'torPreviousSecureDnsUri'
        ]);
        await applyRuntimePrivacy(await getMode());
        await syncSiteOverridesForTor(false);
        if (!keepAuthSuspended) {
          torAuthSuspended = false;
          await restoreSocksAuthProfile();
        }
      }

      throw error;
    } finally {
      torStarting = false;
    }
  }

  const restored = await restoreTorNetwork(saved.torPreviousProxy || { proxyType: 'system' },
    saved.torPreviousSecureDns || 'off', saved.torPreviousSecureDnsUri || '');
  try { await browser.browserControl.stopTor(); } catch (_) {}
  if (!restored) throw new Error('Ripristino proxy o DNS non confermato. TOR richiede recupero.');

  await browser.storage.local.set({ torEnabled: false });
  await browser.storage.local.remove([
    'torPreviousProxy',
    'torPreviousSecureDns',
    'torPreviousSecureDnsUri'
  ]);

  await applyRuntimePrivacy(await getMode());
  await syncSiteOverridesForTor(false);
  if (!keepAuthSuspended) {
    torAuthSuspended = false;
    await restoreSocksAuthProfile();
  }
  return { enabled: false, process: { running: false } };
}

async function initialize() {
  await initializeBlockCounter();
  try { await initializeSiteBlockRules(); }
  catch (error) { console.warn('Unable to clear stale site exceptions', error); }
  try {
    browser.alarms.create('resource-sweep', { periodInMinutes: 1 });
  } catch (_) {}

  await restoreStaleTorState();
  if ((await browser.storage.local.get('torEnabled')).torEnabled) {
    try { await syncSiteOverridesForTor(true); }
    catch (error) { console.error('Tor site protection recovery failed', error); }
  } else {
    try { await syncSiteOverridesForTor(false); }
    catch (error) { console.warn('Unable to restore site permissions at startup', error); }
  }
  try { await restoreSocksAuthProfile(); }
  catch (error) { console.warn('Unable to restore SOCKS5 auth profile', error); }
  try { await applyDarkTheme(); }
  catch (error) { console.warn('Unable to apply browser theme', error); }
  const mode = await getMode();
  // Recover an interrupted prior GHOST session before applying the selected mode's cookie policy.
  if (mode !== 'GHOST' && browser.browserControl?.applyGhostHardening) {
    await browser.browserControl.applyGhostHardening(false);
  }
  if (mode === 'GHOST' && browser.browserControl?.applyGhostHardening) {
    await browser.browserControl.applyGhostHardening(true);
  }
  await applyRuntimePrivacy(mode);
  // A failed Tor restore keeps ownership recorded. Never re-enable WebRTC in that state.
  if ((await browser.storage.local.get('torEnabled')).torEnabled) {
    await browser.privacy.network.peerConnectionEnabled.set({ value: false }).catch(error => {
      console.warn('Unable to disable WebRTC while Tor recovery is pending', error);
    });
  }
  if (browser.browserControl?.applyMode) {
    await browser.browserControl.applyMode(mode);
    await applyHttpsOverride();
  }

  if (mode === 'GHOST') {
    const data = await browser.storage.local.get('ghostSession');
    if (!data.ghostSession) await beginGhostSession();
  }

  await enforceBackgroundLimit();
}

async function scheduleEnforcement() {
  try {
    await enforceBackgroundLimit();
  } catch (error) {
    console.error(error);
  }
}

browser.runtime.onInstalled.addListener(initialize);
browser.runtime.onStartup.addListener(initialize);

browser.tabs.onActivated.addListener(scheduleEnforcement);
browser.tabs.onCreated.addListener(scheduleEnforcement);
browser.tabs.onRemoved.addListener((tabId) => {
  removeSiteBlockRulesForTab(tabId).catch(error => {
    console.warn('Unable to remove site exceptions for closed tab', error);
  });
  scheduleEnforcement();
});
browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if ('url' in changeInfo || 'status' in changeInfo) {
    recordGhostHost(changeInfo.url || tab?.url).catch(() => {});
  }

  if ('audible' in changeInfo || 'pinned' in changeInfo || 'status' in changeInfo) {
    scheduleEnforcement();
  }
});
browser.windows.onFocusChanged.addListener(scheduleEnforcement);

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'resource-sweep') scheduleEnforcement();
});

async function openSiteProtectionForTab(tabId, expectedOrigin, eventClass = null) {
  const tab = await browser.tabs.get(tabId);
  const origin = FilumPolicyEngine.normalizeOrigin(tab.url || '');
  if (tab.incognito || (tab.cookieStoreId && tab.cookieStoreId !== 'firefox-default') ||
      !origin || origin !== expectedOrigin) {
    throw new Error('La scheda è cambiata o usa un contenitore non supportato.');
  }
  const url = new URL(browser.runtime.getURL('site-protection.html'));
  url.searchParams.set('origin', origin);
  url.searchParams.set('tabId', String(tab.id));
  url.searchParams.set('windowId', String(tab.windowId));
  if (eventClass && FilumProtectionEvents.classLabel(eventClass)) {
    url.searchParams.set('eventClass', eventClass);
  }
  const popup = await browser.windows.create({ url: url.href, type: 'popup', width: 620, height: 760, focused: true });
  return { opened: !!popup?.id };
}

const protectionEventSignals = FilumProtectionEvents.create({
  browser,
  openSiteProtection: ({ tabId, origin, eventClass }) =>
    openSiteProtectionForTab(tabId, origin, eventClass)
});
browser.tabs.onRemoved.addListener(tabId => protectionEventSignals.clearTab(tabId));
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if ('url' in changeInfo) {
    protectionEventSignals.clearTab(tabId, FilumProtectionEvents.normalizeOrigin(changeInfo.url || tab?.url));
  }
});

browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message?.type === 'get-site-protection') {
    if (!['sidebar.html', 'diagnostics.html', 'site-protection.html'].some(page => trustedFilumPage(sender, page))) return { available: false };
    return siteStatus(message.origin, message.tabId, message.windowId);
  }
  if (message?.type === 'open-site-protection') {
    if (!trustedFilumPage(sender, 'sidebar.html')) throw new Error('Popup non autorizzato.');
    return openSiteProtectionForTab(message.tabId, message.origin);
  }
  if (message?.type === 'set-site-override') {
    if (!trustedFilumPage(sender, 'site-protection.html')) throw new Error('Modifica sito non autorizzata.');
    return setSiteOverride(message.tabId, message.origin, message.windowId, message.request || {});
  }
  if (message?.type === 'get-site-overrides') {
    if (!trustedFilumPage(sender, 'site-overrides.html')) return { records: [] };
    return { records: await listSiteOverrides(), globalLevel: (await getPrivacyPolicyStatus()).level };
  }
  if (message?.type === 'remove-site-override') {
    if (!['site-protection.html', 'site-overrides.html'].some(page => trustedFilumPage(sender, page))) throw new Error('Rimozione non autorizzata.');
    return removeSiteOverride(message.origin, message.scope);
  }
  if (message?.type === 'remove-all-site-overrides') {
    if (!trustedFilumPage(sender, 'site-overrides.html')) throw new Error('Rimozione non autorizzata.');
    const records = await listSiteOverrides();
    for (const record of records) await removeSiteOverride(record.origin, 'all');
    return { removed: records.length };
  }
  if (message?.type === 'open-site-overrides') {
    if (!['sidebar.html', 'site-protection.html'].some(page => trustedFilumPage(sender, page))) throw new Error('Apertura non autorizzata.');
    const tab = await browser.tabs.create({ url: browser.runtime.getURL('site-overrides.html') });
    return { opened: !!tab?.id };
  }
  if (message?.type === 'open-privacy-settings') {
    const tab = await browser.tabs.create({ url: browser.runtime.getURL('privacy-settings.html') });
    return { opened: !!tab?.id };
  }
  if (message?.type === 'get-privacy-policy') return getPrivacyPolicyStatus();
  if (message?.type === 'privacy-settings-ready') {
    if (sender?.url !== browser.runtime.getURL('privacy-settings.html')) return { ok: false };
    latestPrivacySettingsRuntime = {
      at: Date.now(),
      sequence: (latestPrivacySettingsRuntime?.sequence || 0) + 1,
      levels: Number(message.levels) || 0,
      controls: Number(message.controls) || 0,
      features: Array.isArray(message.features) ? message.features : []
    };
    return { ok: true };
  }
  if (message?.type === 'get-privacy-settings-runtime') return latestPrivacySettingsRuntime;
  if (message?.type === 'set-privacy-policy') {
    return queueControlTransition(async () => {
      const mode = await getMode();
      const previous = (await browser.storage.local.get(PRIVACY_POLICY_STORAGE_KEY))[PRIVACY_POLICY_STORAGE_KEY];
      const next = FilumPolicyEngine.update(previous, mode, message.change);
      await browser.storage.local.set({ [PRIVACY_POLICY_STORAGE_KEY]: next });
      try {
        await applyRuntimePrivacy(mode);
        const torEnabled = !!(await browser.storage.local.get('torEnabled')).torEnabled;
        const status = await getPrivacyPolicyStatus(mode);
        const failed = Object.entries(status.features)
          .filter(([, feature]) => feature.verified === 'FAIL');
        if (failed.length) {
          throw new Error(`Readback mismatch: ${failed.map(([name]) => name).join(', ')}`);
        }
        const modeHealth = await getModeHealth(mode, torEnabled);
        if (!modeHealth.ok) throw new Error(`Policy non completa: ${modeHealth.issues.join('; ')}`);
        return { ok: true, status, modeHealth };
      } catch (error) {
        if (previous === undefined) await browser.storage.local.remove(PRIVACY_POLICY_STORAGE_KEY);
        else await browser.storage.local.set({ [PRIVACY_POLICY_STORAGE_KEY]: previous });
        await applyRuntimePrivacy(mode).catch(() => {});
        throw error;
      }
    });
  }
  if (message?.type === 'get-block-count') return getBlockCount();
  if (message?.type === 'get-site-block-status') {
    const tab = await getActiveSiteBlockTab();
    return tab ? getSiteBlockStatus(tab.id) : {
      available: false, tabId: null, domain: null, unblocked: false
    };
  }
  if (message?.type === 'toggle-site-block' && typeof message.enabled === 'boolean') {
    const tab = await getActiveSiteBlockTab();
    if (!tab || tab.id !== message.tabId) {
      throw new Error('La scheda attiva è cambiata; aggiorna il controllo.');
    }
    const domain = getSiteBlockDomain(tab.url);
    if (!domain || message.domain !== domain) {
      throw new Error('Il dominio della scheda è cambiato; aggiorna il controllo.');
    }
    const status = await toggleSiteBlock(tab.id, domain, message.enabled);
    return { ok: true, ...status };
  }
  if (message?.type === 'tavily-key-status') return tavilyKeyStatus();
  if (message?.type === 'tavily-key-save') {
    const key = String(message.key || '').trim();
    if (!/^tvly-[^\s]{12,250}$/.test(key)) throw new Error('Formato chiave Tavily non valido.');
    await browser.storage.local.set({ tavilyApiKey: key });
    return tavilyKeyStatus();
  }
  if (message?.type === 'tavily-key-remove') {
    await browser.storage.local.remove('tavilyApiKey');
    return tavilyKeyStatus();
  }
  if (message?.type === 'tavily-limit-save') {
    const limit = Number(message.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > TAVILY_MONTHLY_LIMIT) {
      throw new Error('Il limite giornaliero deve essere tra 1 e 1000.');
    }
    await browser.storage.local.set({ tavilyDailyLimit: limit });
    return tavilyKeyStatus();
  }
  if (message?.type === 'tavily-search-explicit') return searchTavilyExplicit(message.query);
  if (message?.type === 'set-ghost-javascript' && typeof message.enabled === 'boolean') {
    return setGhostJavascript(message.enabled);
  }
  if (message?.type === 'set-mode' && MODE_LIMITS[message.mode]) {
    return queueControlTransition(async () => {
      const previousMode = await getMode();
      const previousGhostJavascriptEnabled = previousMode === 'GHOST'
        ? (await browser.browserControl.getModeDiagnostics()).javascriptEnabled
        : undefined;

      if (message.mode !== 'GHOST' && browser.browserControl?.applyGhostHardening) {
        await browser.browserControl.applyGhostHardening(false);
      }
      if (previousMode === 'GHOST' && message.mode !== 'GHOST') {
        await endGhostSession();
      }
      try {
        if (message.mode === 'GHOST' && previousMode !== 'GHOST') {
          await beginGhostSession();
        }
        if (message.mode === 'GHOST' && previousMode !== 'GHOST' &&
            browser.browserControl?.applyGhostHardening) {
          await browser.browserControl.applyGhostHardening(true);
        }
        await applyRuntimePrivacy(message.mode);
        if ((await browser.storage.local.get('torEnabled')).torEnabled) {
          // Fail closed: a mode change must not succeed with WebRTC enabled during Tor.
          await browser.privacy.network.peerConnectionEnabled.set({ value: false });
        }
        if (browser.browserControl?.applyMode) {
          await browser.browserControl.applyMode(message.mode);
          await applyHttpsOverride();
        }
        await browser.storage.local.set({ mode: message.mode });
        let turboCacheCleared = false;
        if (message.mode === 'TURBO' && previousMode !== 'TURBO') {
          await browser.browsingData.removeCache({ since: 0 });
          turboCacheCleared = true;
        }
        await enforceBackgroundLimit();
        if (turboCacheCleared) {
          void Promise.resolve()
            .then(() => browser.storage.local.get('status'))
            .then(({ status }) => logSecurityEvent('CACHE_CLEAR', message.mode, 'SUCCESS', {
              discarded: status?.discardedNow
            }))
            .catch(() => logSecurityEvent('CACHE_CLEAR', message.mode, 'SUCCESS'));
        }
        await browser.storage.local.remove('ghostSessionRestartedAt');
      } catch (error) {
        await browser.storage.local.set({ mode: previousMode }).catch(() => {});
        if (message.mode === 'GHOST' && previousMode !== 'GHOST') {
          await browser.storage.local.remove('ghostSession').catch(() => {});
        }
        if (previousMode === 'GHOST') {
          const session = await browser.storage.local.get('ghostSession');
          if (!session.ghostSession) {
            await beginGhostSession().catch(() => {});
            await browser.storage.local.set({ ghostSessionRestartedAt: Date.now() }).catch(() => {});
          }
        }
        if (previousMode !== 'GHOST' && browser.browserControl?.applyGhostHardening) {
          await browser.browserControl.applyGhostHardening(false).catch(() => {});
        }
        await applyRuntimePrivacy(previousMode).catch(() => {});
        if (previousMode === 'GHOST' && message.mode !== 'GHOST' &&
            browser.browserControl?.applyGhostHardening) {
          await browser.browserControl.applyGhostHardening(true).catch(() => {});
          if (typeof previousGhostJavascriptEnabled === 'boolean') {
            await browser.browserControl.setGhostJavascriptEnabled(previousGhostJavascriptEnabled)
              .catch(() => {});
          }
        }
        if ((await browser.storage.local.get('torEnabled')).torEnabled) {
          await browser.privacy.network.peerConnectionEnabled.set({ value: false }).catch(() => {});
        }
        if (browser.browserControl?.applyMode) {
          await browser.browserControl.applyMode(previousMode).catch(() => {});
        }
        await applyHttpsOverride().catch(() => {});
        throw error;
      }
      const modeHealth = await getModeHealth(message.mode,
        !!(await browser.storage.local.get('torEnabled')).torEnabled);
      if (modeHealth.ok) logSecurityEvent('MODE_CHANGE', message.mode, 'SUCCESS');
      return { ok: modeHealth.ok, mode: message.mode, modeHealth };
    });
  }

  if (message?.type === 'set-tor' && typeof message.enabled === 'boolean') {
    const eventType = message.enabled ? 'TOR_ENABLE' : 'TOR_DISABLE';
    return queueControlTransition(async () => {
      try {
        const result = await setTorEnabled(message.enabled);
        logSecurityEvent(eventType, undefined, 'SUCCESS');
        return result;
      } catch (error) {
        logSecurityEvent(eventType, undefined, 'ERROR');
        throw error;
      }
    });
  }

  if (message?.type === 'set-network-proxy') {
    return queueControlTransition(() => setNetworkProxy(message.config));
  }

  if (message?.type === 'set-proxy-auth') {
    return queueControlTransition(() => setSocksAuthProxy(message.config));
  }

  if (message?.type === 'get-proxy-auth-status') {
    const state = await browser.storage.local.get('torEnabled');
    const proxy = (await browser.proxy.settings.get({})).value || {};
    return {
      hasListener: !!socksAuthListener &&
        browser.proxy.onRequest.hasListener(socksAuthListener) &&
        !torAuthSuspended && !torStarting && !state.torEnabled &&
        proxy.proxyType === 'manual' && proxy.socksVersion === 5
    };
  }

  if (message?.type === 'set-ads' && typeof message.enabled === 'boolean') {
    await setAdsEnabled(message.enabled);
    return { ok: true, adsEnabled: message.enabled };
  }

  if (message?.type === 'set-urlhaus-malware' && typeof message.enabled === 'boolean') {
    await setUrlhausMalwareEnabled(message.enabled);
    return { ok: true, urlhausMalwareEnabled: message.enabled };
  }

  if (message?.type === 'get-status') {
    const data = await browser.storage.local.get(['mode', 'status', 'torEnabled', 'ghostSessionRestartedAt']);
    let processStats = null;
    let torProcess = {
      running: false,
      bootstrapped: false,
      error: null
    };

    try {
      processStats = browser.browserControl?.getProcessStats
        ? await browser.browserControl.getProcessStats()
        : null;
    } catch (_) {}

    try {
      torProcess = browser.browserControl?.getTorStatus
        ? await browser.browserControl.getTorStatus()
        : torProcess;
    } catch (error) {
      torProcess = {
        running: false,
        bootstrapped: false,
        error: error?.message || String(error)
      };
    }

    let adsEnabled = null;
    try {
      adsEnabled = await getAdsEnabled();
    } catch (error) { console.warn('Unable to read ADS ruleset', error); }

    let urlhausMalwareEnabled = null;
    try {
      urlhausMalwareEnabled = await getUrlhausMalwareEnabled();
    } catch (error) { console.warn('Unable to read URLhaus ruleset', error); }

    const activeSiteTab = await getActiveSiteBlockTab();
    const siteBlockStatus = activeSiteTab
      ? await getSiteBlockStatus(activeSiteTab.id)
      : { available: false, tabId: null, domain: null, unblocked: false };

    let torRouted = false;
    if (data.torEnabled && torProcess.bootstrapped) {
      try {
        const [proxy, webRtc, dns] = await Promise.all([
          browser.proxy.settings.get({}),
          browser.privacy.network.peerConnectionEnabled.get({}),
          browser.browserControl.getSettings()
        ]);
        torRouted = hasTorProxy(proxy?.value) && webRtc?.value === false &&
          dns.secureDns === 'off';
      } catch (_) {}
    }

    return {
      mode: data.mode || DEFAULT_MODE,
      ghostSessionRestartedAt: data.ghostSessionRestartedAt || null,
      modeHealth: await getModeHealth(data.mode || DEFAULT_MODE, !!data.torEnabled),
      adsEnabled,
      urlhausMalwareEnabled,
      siteBlockStatus,
      blockCount: sessionBlockCount,
      blockCountAvailable: sessionBlockCounterAvailable,
      status: data.status || null,
      processStats,
      torEnabled: !!data.torEnabled,
      torStarting,
      torRouted,
      torProcess
    };
  }

  if (message?.type === 'enforce-now') {
    try {
      await browser.browsingData.removeCache({ since: 0 });
      await enforceBackgroundLimit();
      const { status } = await browser.storage.local.get('status');
      logSecurityEvent('CACHE_CLEAR', undefined, 'SUCCESS', {
        discarded: status?.discardedNow
      });
      return { ok: true, discarded: status?.discardedNow || 0 };
    } catch (error) {
      logSecurityEvent('CACHE_CLEAR', undefined, 'ERROR');
      throw error;
    }
  }

  if (message?.type === 'open-addons-installed') {
    await browser.tabs.create({ url: browser.runtime.getURL('addons.html') });
    return { ok: true };
  }

  if (message?.type === 'open-addons-store') {
    await browser.tabs.create({ url: 'https://addons.mozilla.org/firefox/extensions/' });
    return { ok: true };
  }

  if (message?.type === 'open-smart-search') {
    await browser.tabs.create({ url: browser.runtime.getURL('smart-search.html') });
    return { ok: true };
  }

  if (message?.type === 'set-hardware-acceleration' && typeof message.enabled === 'boolean') {
    return browser.browserControl.setHardwareAcceleration(message.enabled);
  }

  if (message?.type === 'set-https-only' && typeof message.enabled === 'boolean') {
    const result = await browser.browserControl.setHttpsOnly(message.enabled);
    await browser.storage.local.set({ httpsOnlyOverride: message.enabled });
    return result;
  }

  if (message?.type === 'set-secure-dns' && ['off', 'balanced', 'strict'].includes(message.level)) {
    return queueControlTransition(async () => {
      if (torStarting || (await browser.storage.local.get('torEnabled')).torEnabled) {
        throw new Error('Stop TOR before changing DNS.');
      }
      return browser.browserControl.setSecureDns(message.level, message.uri || '');
    });
  }

  if (message?.type === 'set-website-appearance' && ['auto', 'dark', 'light'].includes(message.mode)) {
    return browser.browserControl.setWebsiteAppearance(message.mode);
  }

  if (message?.type === 'get-advanced-settings') {
    const settings = await browser.browserControl.getSettings();
    const stored = await browser.storage.local.get('browserTheme');
    return {
      ...settings,
      browserTheme: stored.browserTheme || 'dark'
    };
  }

  if (message?.type === 'get-mode-diagnostics') {
    return browser.browserControl.getModeDiagnostics();
  }

  if (message?.type === 'set-browser-theme' && ['dark', 'system', 'black'].includes(message.mode)) {
    return setBrowserTheme(message.mode);
  }

  if (message?.type === 'open-internal-page' && ['settings', 'privacy', 'passwords', 'profiles', 'processes'].includes(message.page)) {
    return browser.browserControl.openInternalPage(message.page);
  }

  if (message?.type === 'set-filum-panel-open' && typeof message.open === 'boolean') {
    return browser.browserControl.setFilumPanelOpen(message.open);
  }
});
