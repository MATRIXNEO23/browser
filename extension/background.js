const MODE_LIMITS = { NORMAL: 3, TURBO: 2, PRIVATE: 2, GHOST: 2 };
const DEFAULT_MODE = 'NORMAL';

async function getMode() {
  const saved = await browser.storage.local.get('mode');
  return MODE_LIMITS[saved.mode] ? saved.mode : DEFAULT_MODE;
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

  // These remain active by policy or because Firefox does not allow discarding
  // a selected tab in another window.
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

async function scheduleEnforcement() {
  try {
    await enforceBackgroundLimit();
  } catch (error) {
    console.error(error);
  }
}

browser.runtime.onInstalled.addListener(scheduleEnforcement);
browser.runtime.onStartup.addListener(scheduleEnforcement);
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

  if (message?.type === 'get-status') {
    const data = await browser.storage.local.get(['mode', 'status']);
    return { mode: data.mode || DEFAULT_MODE, status: data.status || null };
  }

  if (message?.type === 'enforce-now') {
    await enforceBackgroundLimit();
    return { ok: true };
  }
});
