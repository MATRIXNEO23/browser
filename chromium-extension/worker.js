const TAVILY_DEFAULT_DAILY_LIMIT = 33;
const TAVILY_MONTHLY_LIMIT = 1000;
let tavilyRequestInFlight = false;

function localUsageDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function tavilyKeyStatus() {
  const saved = await chrome.storage.local.get([
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
    const saved = await chrome.storage.local.get([
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
    await chrome.storage.local.set({
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


const RULESET = 'ads_basic';
async function captureDuckResults(query) {
  const text = String(query || '').trim();
  if (!text || text.length > 300) throw new Error('Query non valida.');
  const tab = await chrome.tabs.create({ url: 'https://duckduckgo.com/?q=' + encodeURIComponent(text), active: false });
  const tabId = tab.id;
  try {
    await chrome.tabs.update(tabId, { autoDiscardable: false });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { cleanup(); reject(new Error('DuckDuckGo non ha caricato la pagina in tempo.')); }, 15000);
      function cleanup() { clearTimeout(timeout); chrome.tabs.onUpdated.removeListener(updated); chrome.tabs.onRemoved.removeListener(removed); }
      function removed(id) { if (id === tabId) { cleanup(); reject(new Error('Scheda di ricerca chiusa.')); } }
      function updated(id, info, updatedTab) {
        if (id !== tabId || info.status !== 'complete') return;
        cleanup();
        if (!updatedTab.url?.startsWith('https://duckduckgo.com/')) reject(new Error('DuckDuckGo ha reindirizzato la scheda.'));
        else resolve();
      }
      chrome.tabs.onUpdated.addListener(updated);
      chrome.tabs.onRemoved.addListener(removed);
      chrome.tabs.get(tabId).then(current => {
        if (current.status === 'complete') updated(tabId, { status: 'complete' }, current);
      }).catch(() => {});
    });
    await new Promise(resolve => setTimeout(resolve, 1200));
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: () => {
      const out = [], seen = new Set();
      let excludedAds = 0;
      const nodes = document.querySelectorAll('article[data-testid="result"], .result, [data-testid="result"]');
      for (const node of nodes) {
        const anchor = node.querySelector('a[data-testid="result-title-a"], a.result__a, h2 a, h3 a');
        if (!anchor) continue;
        if (node.matches('[data-testid*="ad"], .result--ad') || node.querySelector('[data-testid="ad"], .result__ad, .result__badge--ad')) { excludedAds++; continue; }
        let address;
        try {
          const link = new URL(anchor.href, location.href);
          address = link.searchParams.get('uddg') || link.href;
          const parsed = new URL(address);
          if (!['http:', 'https:'].includes(parsed.protocol) || parsed.hostname.endsWith('duckduckgo.com') || seen.has(parsed.href)) continue;
          address = parsed.href;
        } catch { continue; }
        seen.add(address);
        out.push({ title: anchor.textContent.trim().slice(0, 250), url: address, snippet: (node.querySelector('[data-result="snippet"], [data-testid="result-snippet"], .result__snippet')?.textContent || '').trim().slice(0, 600) });
        if (out.length >= 50) break;
      }
      return { results: out, excludedAds };
    } });
    if (!result?.results?.length) throw new Error('La pagina di DuckDuckGo non contiene risultati leggibili.');
    return result;
  } finally { await chrome.tabs.remove(tabId).catch(() => {}); }
}
const ALARM = 'filum-turbo';
const MODES = new Set(['NORMAL', 'TURBO']);
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.warn);
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
      case 'tavily-key-status': return tavilyKeyStatus();
      case 'tavily-key-save': {
        const key = String(request.key || '').trim();
        if (!/^tvly-[^\s]{12,250}$/.test(key)) throw new Error('Formato chiave Tavily non valido.');
        await chrome.storage.local.set({ tavilyApiKey: key });
        return tavilyKeyStatus();
      }
      case 'tavily-key-remove':
        await chrome.storage.local.remove('tavilyApiKey');
        return tavilyKeyStatus();
      case 'tavily-limit-save': {
        const limit = Number(request.limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > TAVILY_MONTHLY_LIMIT) throw new Error('Il limite giornaliero deve essere tra 1 e 1000.');
        await chrome.storage.local.set({ tavilyDailyLimit: limit });
        return tavilyKeyStatus();
      }
      case 'tavily-search-explicit': return searchTavilyExplicit(request.query);
      case 'duck-search-tab': return captureDuckResults(request.query);
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
