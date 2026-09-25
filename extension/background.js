const MODE_LIMITS = { NORMAL: 3, TURBO: 3, PRIVATE: 3, GHOST: 3 };
const DEFAULT_MODE = 'NORMAL';
const ADS_RULESET_ID = 'ads_basic';

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

async function getAdsEnabled() {
  const enabled = await browser.declarativeNetRequest.getEnabledRulesets();
  return enabled.includes(ADS_RULESET_ID);
}

async function setAdsEnabled(enabled) {
  await browser.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? [ADS_RULESET_ID] : [],
    disableRulesetIds: enabled ? [] : [ADS_RULESET_ID]
  });
  await browser.storage.local.set({ adsEnabled: enabled });
}

async function applyDarkTheme() {
  try {
    const saved = await browser.storage.local.get('browserTheme');
    const mode = saved.browserTheme || 'dark';

    if (mode === 'system') {
      await browser.theme.reset();
    } else {
      await browser.theme.update(mode === 'black' ? BLACK_THEME : DARK_THEME);
    }
  } catch (error) {
    console.warn('Unable to apply browser theme', error);
  }
}

async function setBrowserTheme(mode) {
  await browser.storage.local.set({ browserTheme: mode });
  await applyDarkTheme();
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
  for (const tab of toDiscard) {
    try {
      await browser.tabs.discard(tab.id);
      discardedNow += 1;
    } catch (error) {
      console.warn('Unable to discard tab', tab.id, error);
    }
  }

  const activeBackground = protectedBackground.length + keptCandidates.length;
  const degraded = protectedBackground.length > limit;

  await browser.storage.local.set({
    status: {
      mode,
      limit,
      activeBackground,
      protectedBackground: protectedBackground.length,
      keptCandidates: keptCandidates.length,
      discardedNow,
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
      behavior: 'reject_trackers_and_partition_foreign',
      nonPersistentCookies: false
    });
    await safeSet(browser.privacy.websites.resistFingerprinting, false);
    await safeSet(browser.privacy.websites.hyperlinkAuditingEnabled, false);
    await safeSet(browser.privacy.websites.referrersEnabled, true);
    await safeSet(browser.privacy.network.networkPredictionEnabled, false);
    await safeSet(browser.privacy.network.peerConnectionEnabled, true);
    await safeSet(browser.privacy.network.webRTCIPHandlingPolicy, 'default_public_interface_only');
    return;
  }

  if (mode === 'TURBO') {
    await safeSet(browser.privacy.websites.trackingProtectionMode, 'always');
    await safeSet(browser.privacy.websites.cookieConfig, {
      behavior: 'reject_trackers_and_partition_foreign',
      nonPersistentCookies: false
    });
    await safeSet(browser.privacy.websites.resistFingerprinting, false);
    await safeSet(browser.privacy.websites.hyperlinkAuditingEnabled, false);
    await safeSet(browser.privacy.websites.referrersEnabled, true);
    await safeSet(browser.privacy.network.networkPredictionEnabled, false);
    await safeSet(browser.privacy.network.peerConnectionEnabled, true);
    await safeSet(browser.privacy.network.webRTCIPHandlingPolicy, 'default_public_interface_only');
    return;
  }

  if (mode === 'PRIVATE') {
    await safeSet(browser.privacy.websites.trackingProtectionMode, 'always');
    await safeSet(browser.privacy.websites.cookieConfig, {
      behavior: 'reject_trackers_and_partition_foreign',
      nonPersistentCookies: false
    });
    await safeSet(browser.privacy.websites.resistFingerprinting, true);
    await safeSet(browser.privacy.websites.hyperlinkAuditingEnabled, false);
    await safeSet(browser.privacy.websites.referrersEnabled, true);
    await safeSet(browser.privacy.network.networkPredictionEnabled, false);
    await safeSet(browser.privacy.network.peerConnectionEnabled, true);
    await safeSet(browser.privacy.network.webRTCIPHandlingPolicy, 'disable_non_proxied_udp');
    return;
  }

  if (mode === 'GHOST') {
    await safeSet(browser.privacy.websites.trackingProtectionMode, 'always');
    await safeSet(browser.privacy.websites.cookieConfig, {
      behavior: 'reject_trackers_and_partition_foreign',
      nonPersistentCookies: true
    });
    await safeSet(browser.privacy.websites.resistFingerprinting, true);
    await safeSet(browser.privacy.websites.hyperlinkAuditingEnabled, false);
    await safeSet(browser.privacy.websites.referrersEnabled, false);
    await safeSet(browser.privacy.network.networkPredictionEnabled, false);
    await safeSet(browser.privacy.network.peerConnectionEnabled, false);
  }
}

async function beginGhostSession() {
  await browser.storage.local.set({
    ghostSession: {
      startedAt: Date.now(),
      hosts: []
    }
  });
}

async function recordGhostHost(url) {
  if (!url) return;

  const mode = await getMode();
  if (mode !== 'GHOST') return;

  try {
    const hostname = new URL(url).hostname;
    if (!hostname) return;

    const data = await browser.storage.local.get('ghostSession');
    const session = data.ghostSession || { startedAt: Date.now(), hosts: [] };

    if (!session.hosts.includes(hostname)) {
      session.hosts.push(hostname);
      if (session.hosts.length > 200) session.hosts = session.hosts.slice(-200);
      await browser.storage.local.set({ ghostSession: session });
    }
  } catch (_) {
    // Ignore non-web URLs such as about: pages.
  }
}

async function endGhostSession() {
  const data = await browser.storage.local.get('ghostSession');
  const session = data.ghostSession;

  if (!session?.startedAt) {
    await browser.storage.local.remove('ghostSession');
    return;
  }

  const hosts = Array.isArray(session.hosts) ? session.hosts : [];

  try {
    if (hosts.length) {
      await browser.browsingData.remove(
        { hostnames: hosts },
        {
          cookies: true,
          indexedDB: true,
          localStorage: true,
          serviceWorkers: true
        }
      );
    }

    await browser.browsingData.remove(
      { since: session.startedAt },
      {
        history: true,
        formData: true
      }
    );
  } catch (error) {
    console.warn('Ghost cleanup incomplete', error);
  } finally {
    await browser.storage.local.remove('ghostSession');
  }
}


async function restoreStaleTorState() {
  const saved = await browser.storage.local.get([
    'torEnabled',
    'torPreviousProxy',
    'torPreviousSecureDns',
    'torPreviousSecureDnsUri'
  ]);

  if (!saved.torEnabled) return;

  try {
    if (saved.torPreviousProxy) {
      await browser.proxy.settings.set({ value: saved.torPreviousProxy });
    } else {
      await browser.proxy.settings.set({ value: { proxyType: 'system' } });
    }
  } catch (error) {
    console.warn('Unable to restore proxy after previous TOR session', error);
  }

  try {
    if (saved.torPreviousSecureDns) {
      await browser.browserControl.setSecureDns(
        saved.torPreviousSecureDns,
        saved.torPreviousSecureDnsUri || ''
      );
    }
  } catch (_) {}

  try {
    await browser.browserControl.stopTor();
  } catch (_) {}

  await browser.storage.local.set({ torEnabled: false });
  await browser.storage.local.remove([
    'torPreviousProxy',
    'torPreviousSecureDns',
    'torPreviousSecureDnsUri'
  ]);
}

async function setTorEnabled(enabled) {
  const saved = await browser.storage.local.get([
    'torEnabled',
    'torPreviousProxy',
    'torPreviousSecureDns',
    'torPreviousSecureDnsUri'
  ]);

  if (enabled && saved.torEnabled) {
    const process = await browser.browserControl.getTorStatus();

    if (process?.bootstrapped) {
      return { enabled: true, process };
    }

    try {
      await browser.browserControl.stopTor();
    } catch (_) {}

    try {
      if (saved.torPreviousProxy) {
        await browser.proxy.settings.set({ value: saved.torPreviousProxy });
      }
    } catch (_) {}

    try {
      await browser.browserControl.setSecureDns(
        saved.torPreviousSecureDns || 'off',
        saved.torPreviousSecureDnsUri || ''
      );
    } catch (_) {}

    await browser.storage.local.set({ torEnabled: false });
    await browser.storage.local.remove([
      'torPreviousProxy',
      'torPreviousSecureDns',
      'torPreviousSecureDnsUri'
    ]);

    return setTorEnabled(true);
  }

  if (!enabled && !saved.torEnabled) {
    try {
      await browser.browserControl.stopTor();
    } catch (_) {}
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

    try {
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

      try {
        await browser.privacy.network.peerConnectionEnabled.set({ value: false });
      } catch (_) {}

      await browser.storage.local.set({ torEnabled: true });
      return { enabled: true, process };
    } catch (error) {
      try {
        await browser.browserControl.stopTor();
      } catch (_) {}

      try {
        await browser.proxy.settings.set({
          value: previousProxy?.value || { proxyType: 'system' }
        });
      } catch (_) {}

      try {
        await browser.browserControl.setSecureDns(
          settings.secureDns || 'off',
          settings.secureDnsUri || ''
        );
      } catch (_) {}

      await browser.storage.local.set({ torEnabled: false });
      await browser.storage.local.remove([
        'torPreviousProxy',
        'torPreviousSecureDns',
        'torPreviousSecureDnsUri'
      ]);

      throw error;
    }
  }

  try {
    if (saved.torPreviousProxy) {
      await browser.proxy.settings.set({ value: saved.torPreviousProxy });
    } else {
      await browser.proxy.settings.set({ value: { proxyType: 'system' } });
    }
  } finally {
    try {
      await browser.browserControl.stopTor();
    } catch (_) {}
  }

  if (saved.torPreviousSecureDns) {
    try {
      await browser.browserControl.setSecureDns(
        saved.torPreviousSecureDns,
        saved.torPreviousSecureDnsUri || ''
      );
    } catch (_) {}
  }

  await browser.storage.local.set({ torEnabled: false });
  await browser.storage.local.remove([
    'torPreviousProxy',
    'torPreviousSecureDns',
    'torPreviousSecureDnsUri'
  ]);

  await applyRuntimePrivacy(await getMode());
  return { enabled: false, process: { running: false } };
}

async function initialize() {
  try {
    browser.alarms.create('resource-sweep', { periodInMinutes: 1 });
  } catch (_) {}

  await restoreStaleTorState();
  await applyDarkTheme();
  const mode = await getMode();
  await applyRuntimePrivacy(mode);
  if (browser.browserControl?.applyMode) {
    await browser.browserControl.applyMode(mode);
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
    recordGhostHost(changeInfo.url || tab?.url);
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
  if (message?.type === 'set-mode' && MODE_LIMITS[message.mode]) {
    const previousMode = await getMode();

    if (previousMode === 'GHOST' && message.mode !== 'GHOST') {
      await endGhostSession();
    }

    await browser.storage.local.set({ mode: message.mode });

    if (message.mode === 'GHOST' && previousMode !== 'GHOST') {
      await beginGhostSession();
    }

    await applyRuntimePrivacy(message.mode);
    if (browser.browserControl?.applyMode) {
      await browser.browserControl.applyMode(message.mode);
    }
    await enforceBackgroundLimit();
    return { ok: true, mode: message.mode };
  }

  if (message?.type === 'set-tor' && typeof message.enabled === 'boolean') {
    return setTorEnabled(message.enabled);
  }

  if (message?.type === 'set-ads' && typeof message.enabled === 'boolean') {
    await setAdsEnabled(message.enabled);
    return { ok: true, adsEnabled: message.enabled };
  }

  if (message?.type === 'get-status') {
    const data = await browser.storage.local.get(['mode', 'status', 'torEnabled']);
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

    let adsEnabled = true;
    try {
      adsEnabled = await getAdsEnabled();
    } catch (_) {}

    return {
      mode: data.mode || DEFAULT_MODE,
      adsEnabled,
      status: data.status || null,
      processStats,
      torEnabled: !!data.torEnabled && !!torProcess.bootstrapped,
      torProcess
    };
  }

  if (message?.type === 'enforce-now') {
    await enforceBackgroundLimit();
    return { ok: true };
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
    return browser.browserControl.setHttpsOnly(message.enabled);
  }

  if (message?.type === 'set-secure-dns' && ['off', 'balanced', 'strict'].includes(message.level)) {
    return browser.browserControl.setSecureDns(message.level, message.uri || '');
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
