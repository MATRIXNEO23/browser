const MODE_LIMITS = { NORMAL: 3, TURBO: 2, PRIVATE: 2, GHOST: 2 };
const DEFAULT_MODE = 'NORMAL';

async function getMode() {
  const saved = await browser.storage.local.get('mode');
  return MODE_LIMITS[saved.mode] ? saved.mode : DEFAULT_MODE;
}

function isProtected(tab, foregroundTabId) {
  return tab.id === foregroundTabId || tab.pinned || tab.audible || tab.discarded;
}

async function enforceBackgroundLimit() {
  const mode = await getMode();
  const limit = MODE_LIMITS[mode];
  const windows = await browser.windows.getAll({ populate: true });
  const focused = windows.find((w) => w.focused);
  const foreground = focused?.tabs?.find((t) => t.active);
  const foregroundTabId = foreground?.id;

  const tabs = windows.flatMap((w) => (w.tabs || []).map((tab) => ({ ...tab, windowFocused: !!w.focused })));

  const backgroundSelected = tabs.filter((tab) => tab.active && tab.id !== foregroundTabId && !tab.discarded);
  const candidates = tabs
    .filter((tab) => !tab.active && !isProtected(tab, foregroundTabId))
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

  const protectedBackgroundCount = backgroundSelected.filter((tab) => tab.pinned || tab.audible).length;
  const effectiveLimit = Math.max(0, limit - protectedBackgroundCount);
  const toDiscard = candidates.slice(effectiveLimit);

  for (const tab of toDiscard) {
    try {
      await browser.tabs.discard(tab.id);
    } catch (error) {
      console.warn('Unable to discard tab', tab.id, error);
    }
  }

  await browser.storage.local.set({
    status: {
      mode,
      limit,
      backgroundSelected: backgroundSelected.length,
      eligibleActiveBackground: Math.min(candidates.length, effectiveLimit),
      discardedNow: toDiscard.length,
      degradedBySelectedWindowTabs: backgroundSelected.length > limit,
      updatedAt: Date.now()
    }
  });
}

async function scheduleEnforcement() {
  try { await enforceBackgroundLimit(); } catch (error) { console.error(error); }
}

browser.runtime.onInstalled.addListener(scheduleEnforcement);
browser.runtime.onStartup.addListener(scheduleEnforcement);
browser.tabs.onActivated.addListener(scheduleEnforcement);
browser.tabs.onCreated.addListener(scheduleEnforcement);
browser.tabs.onRemoved.addListener(scheduleEnforcement);
browser.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if ('audible' in changeInfo || 'pinned' in changeInfo || 'status' in changeInfo) scheduleEnforcement();
});
browser.windows.onFocusChanged.addListener(scheduleEnforcement);

browser.runtime.onMessage.addListener(async (message) => {
  if (message?.type === 'set-mode' && MODE_LIMITS[message.mode]) {
    await browser.storage.local.set({ mode: message.mode });
    await enforceBackgroundLimit();
    return { ok: true, mode: message.mode };
  }
  if (message?.type === 'get-status') {
    const data = await browser.storage.local.get(['mode', 'status']);
    return { mode: data.mode || DEFAULT_MODE, status: data.status || null };
  }
  if (message?.type === 'enforce-now') {
    await enforceBackgroundLimit();
    return { ok: true };
  }
});
