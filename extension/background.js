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

async function initialize() {
  await applyDarkTheme();
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
browser.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if ('audible' in changeInfo || 'pinned' in changeInfo || 'status' in changeInfo) {
    scheduleEnforcement();
  }
});
browser.windows.onFocusChanged.addListener(scheduleEnforcement);

browser.runtime.onMessage.addListener(async (message) => {
  if (message?.type === 'set-mode' && MODE_LIMITS[message.mode]) {
    await browser.storage.local.set({ mode: message.mode });
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
    await browser.tabs.create({ url: 'about:addons' });
    return { ok: true };
  }

  if (message?.type === 'open-addons-store') {
    await browser.tabs.create({ url: 'https://addons.mozilla.org/firefox/extensions/' });
    return { ok: true };
  }
});
