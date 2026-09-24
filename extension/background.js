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
    await browser.theme.update(DARK_THEME);
  } catch (error) {
    console.warn('Unable to apply dark theme', error);
  }
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
  const keptCandidates = candidates.slice(0, candidateSlots);
  const toDiscard = candidates.slice(candidateSlots);

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

async function initialize() {
  await applyDarkTheme();
  const mode = await getMode();
  await applyRuntimePrivacy(mode);

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

browser.action.onClicked.addListener(async () => {
  try {
    const open = await browser.sidebarAction.isOpen({});
    if (open) {
      await browser.sidebarAction.close();
    } else {
      await browser.sidebarAction.open();
    }
  } catch (error) {
    console.error('Unable to toggle sidebar', error);
  }
});

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
    await enforceBackgroundLimit();
    return { ok: true, mode: message.mode };
  }

  if (message?.type === 'set-ads' && typeof message.enabled === 'boolean') {
    await setAdsEnabled(message.enabled);
    return { ok: true, adsEnabled: message.enabled };
  }

  if (message?.type === 'get-status') {
    const data = await browser.storage.local.get(['mode', 'status']);
    return {
      mode: data.mode || DEFAULT_MODE,
      adsEnabled: await getAdsEnabled(),
      status: data.status || null
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
});
