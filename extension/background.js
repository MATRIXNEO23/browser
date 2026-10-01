const MODE_LIMITS = { NORMAL: 3, TURBO: 3, PRIVATE: 3, GHOST: 3 };
const DEFAULT_MODE = 'NORMAL';
const ADS_RULESET_ID = 'ads_basic';
const URLHAUS_MALWARE_RULESET_ID = 'urlhaus_malware_basic';
const BLOCK_COUNTER_RULESET_IDS = new Set([
  ADS_RULESET_ID,
  URLHAUS_MALWARE_RULESET_ID
]);
const TAVILY_DEFAULT_DAILY_LIMIT = 33;
const TAVILY_MONTHLY_LIMIT = 1000;

let sessionBlockCount = 0;
let sessionBlockCounterAvailable = false;

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
  const safeSet = async (setting, value) => {
    try {
      await setting.set({ value });
    } catch (error) {
      console.warn('Privacy setting not applied', error);
    }
  };

  if (mode === 'NORMAL') {
    await safeSet(browser.privacy.websites.trackingProtectionMode, 'always');
    await safeSet(browser.privacy.websites.cookieConfig, {
      behavior: 'reject_trackers_and_partition_foreign'
    });
    await updateRFPState(mode);
    await safeSet(browser.privacy.websites.hyperlinkAuditingEnabled, false);
    await safeSet(browser.privacy.websites.referrersEnabled, true);
    await safeSet(browser.privacy.network.networkPredictionEnabled, false);
    await safeSet(browser.privacy.network.peerConnectionEnabled, false);
    await safeSet(browser.privacy.network.webRTCIPHandlingPolicy, 'default_public_interface_only');
    return;
  }

  if (mode === 'TURBO') {
    await safeSet(browser.privacy.websites.trackingProtectionMode, 'always');
    await safeSet(browser.privacy.websites.cookieConfig, {
      behavior: 'reject_trackers_and_partition_foreign'
    });
    await updateRFPState(mode);
    await safeSet(browser.privacy.websites.hyperlinkAuditingEnabled, false);
    await safeSet(browser.privacy.websites.referrersEnabled, true);
    await safeSet(browser.privacy.network.networkPredictionEnabled, false);
    await safeSet(browser.privacy.network.peerConnectionEnabled, false);
    await safeSet(browser.privacy.network.webRTCIPHandlingPolicy, 'default_public_interface_only');
    return;
  }

  if (mode === 'PRIVATE') {
    await safeSet(browser.privacy.websites.trackingProtectionMode, 'always');
    await safeSet(browser.privacy.websites.cookieConfig, {
      behavior: 'reject_trackers_and_partition_foreign'
    });
    await updateRFPState(mode);
    await safeSet(browser.privacy.websites.hyperlinkAuditingEnabled, false);
    await safeSet(browser.privacy.websites.referrersEnabled, true);
    await safeSet(browser.privacy.network.networkPredictionEnabled, false);
    await safeSet(browser.privacy.network.peerConnectionEnabled, false);
    await safeSet(browser.privacy.network.webRTCIPHandlingPolicy, 'disable_non_proxied_udp');
    return;
  }

  if (mode === 'GHOST') {
    await safeSet(browser.privacy.websites.trackingProtectionMode, 'always');
    await safeSet(browser.privacy.websites.cookieConfig, {
      behavior: 'reject_third_party'
    });
    await updateRFPState(mode);
    await safeSet(browser.privacy.websites.hyperlinkAuditingEnabled, false);
    await safeSet(browser.privacy.websites.referrersEnabled, false);
    await safeSet(browser.privacy.network.networkPredictionEnabled, false);
    await safeSet(browser.privacy.network.peerConnectionEnabled, false);
    await safeSet(browser.privacy.network.webRTCIPHandlingPolicy, 'disable_non_proxied_udp');
  }
}

async function updateRFPState(mode, isTorActive) {
  const storedTorActive = !!(await browser.storage.local.get('torEnabled')).torEnabled;
  const torActive = isTorActive === true || torStarting || storedTorActive;
  const shouldEnableRFP = mode === 'PRIVATE' || mode === 'GHOST' || torActive;
  await browser.privacy.websites.resistFingerprinting.set({ value: shouldEnableRFP });
  return shouldEnableRFP;
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
    const protectedMode = mode === 'PRIVATE' || mode === 'GHOST';
    const expectedRFP = protectedMode || torEnabled;
    expect('Autoplay', prefs.autoplay, mode === 'TURBO' || mode === 'GHOST' ? 5 : 1);
    expect('Fingerprint (preferenza)', prefs.fingerprintResistance, expectedRFP);
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
    if (tracking !== undefined) expect('Protezione tracciamento', tracking, 'always');
    if (cookies !== undefined) {
      expect('Protezione cookie', cookies?.behavior,
        mode === 'GHOST' ? 'reject_third_party' : 'reject_trackers_and_partition_foreign');
    }
    if (mode === 'GHOST') {
      expect('Cookie behavior hardening', prefs.ghostCookieBehavior, 1);
      expect('FPI', prefs.ghostFpi, true);
      expect('WASM', prefs.ghostWasm, false);
      expect('HTTP/3', prefs.ghostHttp3, false);
      expect('Alt-Svc', prefs.ghostAltSvc, false);
    }
    if (webRtc !== undefined) expect('WebRTC', webRtc, false);
    if (referrers !== undefined) expect('Referrer', referrers, mode !== 'GHOST');
    if (webRtcPolicy !== undefined) expect('Policy WebRTC', webRtcPolicy,
      mode === 'PRIVATE' || mode === 'GHOST'
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
  if (!keepAuthSuspended) {
    torAuthSuspended = false;
    await restoreSocksAuthProfile();
  }
  return { enabled: false, process: { running: false } };
}

async function initialize() {
  await initializeBlockCounter();
  try {
    browser.alarms.create('resource-sweep', { periodInMinutes: 1 });
  } catch (_) {}

  await restoreStaleTorState();
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
browser.tabs.onRemoved.addListener(scheduleEnforcement);
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

browser.runtime.onMessage.addListener(async (message) => {
  if (message?.type === 'get-block-count') return getBlockCount();
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
  if (message?.type === 'set-mode' && MODE_LIMITS[message.mode]) {
    return queueControlTransition(async () => {
      const previousMode = await getMode();

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
        if (message.mode === 'GHOST' && browser.browserControl?.applyGhostHardening) {
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
        if (previousMode === 'GHOST' && browser.browserControl?.applyGhostHardening) {
          await browser.browserControl.applyGhostHardening(true).catch(() => {});
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
