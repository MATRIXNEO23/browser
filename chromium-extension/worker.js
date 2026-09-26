const RULESET = 'ads_basic';
const ALARM = 'filum-turbo';
const MODES = new Set(['NORMAL', 'TURBO']);
let transition = Promise.resolve();

function serial(action) {
  const next = transition.then(action);
  transition = next.catch(() => {});
  return next;
}

async function state() {
  const stored = await chrome.storage.local.get({ mode: 'NORMAL' });
  const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
  return { mode: MODES.has(stored.mode) ? stored.mode : 'NORMAL', adsEnabled: enabled.includes(RULESET) };
}

async function enforceTurbo() {
  const { mode } = await state();
  if (mode !== 'TURBO') return { discarded: 0, protected: 0, activeBackground: 0 };
  const tabs = await chrome.tabs.query({});
  const active = tabs.filter(tab => !tab.discarded && !tab.active);
  const protectedTabs = active.filter(tab => tab.pinned || tab.audible || tab.autoDiscardable === false);
  const candidates = active.filter(tab => !tab.pinned && !tab.audible && tab.autoDiscardable !== false)
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  const keep = Math.max(0, 3 - protectedTabs.length);
  let discarded = 0;
  for (const tab of candidates.slice(keep)) {
    try { await chrome.tabs.discard(tab.id); discarded++; } catch (_) { /* tab changed or is protected */ }
  }
  return { discarded, protected: protectedTabs.length, activeBackground: Math.max(0, active.length - discarded) };
}

async function status() {
  const current = await state();
  const tabs = await chrome.tabs.query({});
  return {
    ...current,
    activeBackground: tabs.filter(tab => !tab.active && !tab.discarded).length,
    protectedBackground: tabs.filter(tab => !tab.active && !tab.discarded &&
      (tab.pinned || tab.audible || tab.autoDiscardable === false)).length
  };
}

async function setMode(mode) {
  if (!MODES.has(mode)) throw new Error('Modalità non disponibile in Chromium.');
  await chrome.storage.local.set({ mode });
  if (mode === 'TURBO') {
    await chrome.alarms.create(ALARM, { periodInMinutes: 1 });
    await enforceTurbo();
  } else {
    await chrome.alarms.clear(ALARM);
  }
  return status();
}

async function setAds(enabled) {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? [RULESET] : [],
    disableRulesetIds: enabled ? [] : [RULESET]
  });
  const result = await status();
  if (result.adsEnabled !== enabled) throw new Error('ADS: stato non confermato dal browser.');
  return result;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  serial(async () => {
    switch (request?.type) {
      case 'status': return status();
      case 'mode': return setMode(request.mode);
      case 'ads': return setAds(request.enabled === true);
      case 'enforce': return { ...(await status()), result: await enforceTurbo() };
      default: throw new Error('Comando FILUM sconosciuto.');
    }
  }).then(data => sendResponse({ ok: true, data }), error => sendResponse({ ok: false, error: String(error.message || error) }));
  return true;
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM) serial(enforceTurbo).catch(console.warn);
});
chrome.tabs.onActivated.addListener(() => serial(enforceTurbo).catch(console.warn));
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.status === 'complete') serial(enforceTurbo).catch(console.warn);
});
chrome.runtime.onStartup.addListener(() => serial(async () => {
  if ((await state()).mode === 'TURBO') await chrome.alarms.create(ALARM, { periodInMinutes: 1 });
}).catch(console.warn));
