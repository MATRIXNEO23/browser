const form = document.getElementById('search-form');
const queryInput = document.getElementById('query');
const resultsEl = document.getElementById('results');
const summaryEl = document.getElementById('summary');
const stopButton = document.getElementById('stop');
const tavilyButton = document.getElementById('search-tavily');
const tavilyKeyInput = document.getElementById('tavily-key');
const tavilyStatus = document.getElementById('tavily-status');
const tavilyDailyLimit = document.getElementById('tavily-daily-limit');
const blockedSitesEl = document.getElementById('blocked-sites');

let activeController = null;
let blockedDomains = [];
let lastRendered = null;

function siteHost(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}

function isBlockedSite(url) {
  const host = siteHost(url);
  return blockedDomains.some(domain => host === domain || host.endsWith('.' + domain));
}

async function loadBlockedSites() {
  const data = await browser.storage.local.get('smartSearchBlockedDomains');
  blockedDomains = Array.isArray(data.smartSearchBlockedDomains)
    ? data.smartSearchBlockedDomains.filter(value => typeof value === 'string') : [];
  renderBlockedSites();
}

function renderBlockedSites() {
  blockedSitesEl.replaceChildren();
  if (!blockedDomains.length) {
    blockedSitesEl.textContent = 'Nessun sito escluso.';
    return;
  }
  for (const domain of blockedDomains) {
    const item = document.createElement('div');
    item.className = 'blocked-site';
    const label = document.createElement('span');
    label.textContent = domain;
    const remove = document.createElement('button');
    remove.textContent = 'Rimuovi';
    remove.addEventListener('click', async () => {
      const next = blockedDomains.filter(value => value !== domain);
      try {
        await browser.storage.local.set({ smartSearchBlockedDomains: next });
        blockedDomains = next;
        renderBlockedSites();
        // Do not repeat a paid search without another explicit click.
        summaryEl.textContent = 'Sito rimosso dalla lista. Ripeti la ricerca per rivedere i risultati.';
      } catch (error) {
        summaryEl.textContent = 'Rimozione non salvata: ' + (error?.message || error);
      }
    });
    item.append(label, remove);
    blockedSitesEl.append(item);
  }
}

async function blockResultSite(url) {
  const domain = siteHost(url);
  if (!domain || blockedDomains.includes(domain)) return;
  const next = [...blockedDomains, domain].sort();
  await browser.storage.local.set({ smartSearchBlockedDomains: next });
  blockedDomains = next;
  renderBlockedSites();
  if (lastRendered) {
    const { results, query, meta } = lastRendered;
    const visible = results.filter(result => !isBlockedSite(result.url));
    render(visible, query, { ...meta, blockedCount: meta.blockedCount + results.length - visible.length });
  }
}

const STOP_WORDS = new Set([
  'a','ad','al','alla','alle','allo','ai','agli','anche','che','con','da','dal','dalla',
  'dalle','dei','del','della','delle','di','e','ed','gli','i','il','in','la','le','lo',
  'ma','mi','nel','nella','nelle','non','o','per','piu','più','su','tra','un','una',
  'uno','the','a','an','and','or','for','to','of','in','on','with','from'
]);

const DIRECT_HINTS = [
  'docs','documentation','developer','manual','support','spec','specification',
  'github.com','gitlab.com','wikipedia.org','.gov','.edu','pdf'
];

const SHOPPING_HINTS = [
  'amazon.','ebay.','aliexpress.','temu.','shopping.','shop.','store.','price','prezzo'
];

const SOCIAL_HINTS = [
  'facebook.com','instagram.com','tiktok.com','twitter.com','x.com','pinterest.'
];

function fold(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(value) {
  return fold(value)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function parseQuery(raw) {
  const phrases = [...raw.matchAll(/"([^"]+)"/g)].map((m) => fold(m[1]).trim()).filter(Boolean);
  const required = [...raw.matchAll(/(?:^|\s)\+([^\s"]+)/g)].map((m) => fold(m[1])).filter(Boolean);
  const excluded = [...raw.matchAll(/(?:^|\s)-([^\s"]+)/g)].map((m) => fold(m[1])).filter(Boolean);

  let plain = raw.replace(/"[^"]+"/g, ' ');
  plain = plain.replace(/(?:^|\s)[+-][^\s"]+/g, ' ');

  const terms = [...new Set([
    ...tokenize(plain),
    ...required.flatMap(tokenize),
    ...phrases.flatMap(tokenize)
  ])];

  const engineQuery = [
    ...phrases.map((p) => `"${p}"`),
    ...required,
    ...tokenize(plain)
  ].join(' ').trim();

  return { raw, phrases, required, excluded, terms, engineQuery: engineQuery || raw };
}

function countOccurrences(haystack, needle, max = 8) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while ((index = haystack.indexOf(needle, index)) !== -1) {
    count += 1;
    if (count >= max) break;
    index += needle.length;
  }
  return count;
}

function decodeResultUrl(href) {
  try {
    const parsed = new URL(href, 'https://html.duckduckgo.com/');
    const redirected = parsed.searchParams.get('uddg');
    // URLSearchParams already decodes the redirect parameter once.
    return redirected || parsed.href;
  } catch {
    return href;
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function suspiciousUrlReasons(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const reasons = [];
    if (url.username || url.password) reasons.push('credenziali nell’URL');
    if (host.includes('xn--')) reasons.push('dominio internazionale codificato');
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) {
      reasons.push('indirizzo IP al posto del dominio');
    }
    if (host.length > 70 || (host.match(/-/g) || []).length >= 5) {
      reasons.push('dominio insolitamente complesso');
    }
    return reasons;
  } catch {
    return ['URL non valido'];
  }
}

function isAdResult(node, anchor) {
  return node.classList.contains('result--ad') ||
    !!node.querySelector('.result__badge--ad, .result__ad, [data-testid="ad"]') ||
    /\/y\.js(?:[?#]|$)/.test(anchor.getAttribute('href') || '');
}

function mergeCandidates(duck, tavily) {
  const merged = new Map();
  for (const result of duck) merged.set(result.url, result);
  for (const item of tavily) {
    try {
      const url = new URL(item.url);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      url.hash = '';
      const address = url.href;
      const existing = merged.get(address);
      if (existing) {
        existing.sources.push('Tavily');
        if (!existing.snippet && item.snippet) existing.snippet = item.snippet;
      } else {
        merged.set(address, {
          title: item.title || address, url: address, domain: getDomain(address),
          snippet: item.snippet || '', sources: ['Tavily'],
          suspiciousReasons: suspiciousUrlReasons(address),
          deep: null, initialScore: 0, finalScore: 0, reasons: []
        });
      }
    } catch (_) {}
  }
  return [...merged.values()];
}

function scoreCandidate(result, query, options) {
  const title = fold(result.title);
  const snippet = fold(result.snippet);
  const domain = fold(result.domain);
  const url = fold(result.url);
  const combined = `${title} ${snippet} ${domain} ${url}`;
  let score = 0;
  const reasons = [];

  for (const term of query.terms) {
    const titleHits = countOccurrences(title, term, 3);
    const snippetHits = countOccurrences(snippet, term, 4);
    const domainHits = countOccurrences(domain, term, 2);

    if (titleHits) score += titleHits * 5;
    if (snippetHits) score += snippetHits * 2;
    if (domainHits) score += domainHits * 2;
  }

  for (const phrase of query.phrases) {
    if (title.includes(phrase)) {
      score += 14;
      reasons.push('frase esatta nel titolo');
    } else if (snippet.includes(phrase)) {
      score += 8;
      reasons.push('frase esatta nello snippet');
    }
  }

  for (const req of query.required) {
    if (combined.includes(req)) {
      score += 10;
      reasons.push(`+${req}`);
    } else {
      score -= 6;
    }
  }

  for (const excluded of query.excluded) {
    if (combined.includes(excluded)) {
      return { score: -Infinity, reasons: [`escluso: ${excluded}`] };
    }
  }

  if (options.preferDirect && DIRECT_HINTS.some((hint) => combined.includes(hint))) {
    score += 5;
    reasons.push('fonte diretta/tecnica');
  }

  if (options.penalizeShopping && SHOPPING_HINTS.some((hint) => combined.includes(hint))) {
    score -= 10;
    reasons.push('shopping penalizzato');
  }

  if (options.penalizeSocial && SOCIAL_HINTS.some((hint) => combined.includes(hint))) {
    score -= 10;
    reasons.push('social penalizzato');
  }

  const tokenMatches = query.terms.filter((term) => combined.includes(term)).length;
  if (tokenMatches) reasons.push(`${tokenMatches}/${query.terms.length} termini`);

  return { score, reasons };
}

async function fetchWithTimeout(url, options, timeoutMs, outerSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const abortFromOuter = () => controller.abort();
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener('abort', abortFromOuter, { once: true });
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store'
    });
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', abortFromOuter);
  }
}

async function readLimitedText(response, maxBytes = 393216) {
  if (!response.body?.getReader) {
    const text = await response.text();
    return text.slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';

  try {
    while (total < maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    if (total >= maxBytes) {
      try { await reader.cancel(); } catch {}
    }
  }

  text += decoder.decode();
  return text;
}

async function searchCandidates(query, signal) {
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query.engineQuery);
  const response = await fetchWithTimeout(url, {}, 10000, signal);

  if (!response.ok) {
    throw new Error(`Motore di ricerca: HTTP ${response.status}`);
  }

  const html = await readLimitedText(response, 524288);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const candidates = [];
  const seen = new Set();
  let excludedAds = 0;

  for (const node of doc.querySelectorAll('.result')) {
    const anchor = node.querySelector('.result__a');
    if (!anchor) continue;
    if (isAdResult(node, anchor)) {
      excludedAds += 1;
      continue;
    }

    const resultUrl = decodeResultUrl(anchor.getAttribute('href') || anchor.href || '');
    if (!/^https?:/i.test(resultUrl)) continue;

    const normalizedUrl = resultUrl.replace(/#.*$/, '');
    if (seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);

    const snippet = node.querySelector('.result__snippet')?.textContent?.trim() || '';
    candidates.push({
      title: anchor.textContent?.trim() || normalizedUrl,
      url: normalizedUrl,
      domain: getDomain(normalizedUrl),
      sources: ['DuckDuckGo'],
      snippet,
      deep: null,
      initialScore: 0,
      finalScore: 0,
      reasons: [],
      suspiciousReasons: suspiciousUrlReasons(normalizedUrl)
    });

    if (candidates.length >= 30) break;
  }

  return { candidates, excludedAds };
}

function cleanDocumentText(doc) {
  for (const selector of ['script','style','noscript','svg','form','nav','footer','aside','iframe']) {
    for (const node of doc.querySelectorAll(selector)) node.remove();
  }

  const title = doc.querySelector('title')?.textContent?.trim() || '';
  const h1 = [...doc.querySelectorAll('h1')]
    .slice(0, 3)
    .map((n) => n.textContent?.trim() || '')
    .join(' ');

  const body = (doc.body?.innerText || doc.body?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14000);

  return { title, h1, body };
}

function makeExcerpt(text, query) {
  const folded = fold(text);
  const needle = query.phrases[0] || query.required[0] || query.terms[0];
  if (!needle) return text.slice(0, 280);

  const index = folded.indexOf(needle);
  if (index < 0) return text.slice(0, 280);

  const start = Math.max(0, index - 100);
  const end = Math.min(text.length, index + needle.length + 180);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

async function inspectPage(result, query, signal) {
  try {
    const response = await fetchWithTimeout(result.url, {
      headers: { 'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.2' }
    }, 7000, signal);

    if (!response.ok) return { score: 0, note: `pagina HTTP ${response.status}`, requiredMissing: [] };

    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html') && !type.includes('text/plain') && !type.includes('application/xhtml')) {
      return { score: 0, note: 'contenuto non HTML', requiredMissing: [] };
    }

    const html = await readLimitedText(response, 393216);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const page = cleanDocumentText(doc);

    const title = fold(page.title);
    const h1 = fold(page.h1);
    const body = fold(page.body);
    const all = `${title} ${h1} ${body}`;

    let score = 0;
    const reasons = [];

    for (const term of query.terms) {
      score += countOccurrences(title, term, 2) * 4;
      score += countOccurrences(h1, term, 2) * 3;
      score += Math.min(5, countOccurrences(body, term, 5));
    }

    for (const phrase of query.phrases) {
      if (title.includes(phrase) || h1.includes(phrase)) {
        score += 12;
        reasons.push('frase esatta nella pagina');
      } else if (body.includes(phrase)) {
        score += 7;
        reasons.push('frase esatta nel contenuto');
      }
    }

    const requiredMissing = query.required.filter((term) => !all.includes(term));
    score -= requiredMissing.length * 12;

    return {
      score,
      note: makeExcerpt(page.body, query),
      reasons,
      requiredMissing
    };
  } catch (error) {
    if (signal.aborted) throw error;
    return { score: 0, note: 'pagina non approfondibile', reasons: [], requiredMissing: [] };
  }
}

function render(results, query, meta) {
  resultsEl.textContent = '';

  summaryEl.textContent =
    `${meta.candidates} candidati · ${meta.excludedAds} annunci riconoscibili esclusi · ` +
    `${meta.hiddenSuspicious} link sospetti nascosti · ${meta.blockedCount} siti esclusi da te · ` +
    `${meta.deepRead} pagine approfondite · ` +
    `${Math.min(results.length, 10)} risultati mostrati · ranking locale`;

  lastRendered = { results, query, meta };

  const shown = results.slice(0, 10);
  if (!shown.length) {
    resultsEl.textContent = 'Nessun risultato sufficientemente pertinente.';
    return;
  }

  shown.forEach((result, index) => {
    const article = document.createElement('article');
    article.className = 'result';

    const head = document.createElement('div');
    head.className = 'result-head';

    const h2 = document.createElement('h2');
    const link = document.createElement('a');
    link.href = result.url;
    link.textContent = `${index + 1}. ${result.title}`;
    link.target = '_blank';
    link.rel = 'noreferrer';
    h2.appendChild(link);

    if (result.deep) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'letto';
      h2.appendChild(badge);
    }

    if (result.suspiciousReasons.length) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'URL da verificare';
      badge.title = result.suspiciousReasons.join(' · ');
      h2.appendChild(badge);
    }

    const score = document.createElement('div');
    score.className = 'score';
    score.textContent = `pertinenza ${Math.round(result.finalScore)}`;

    head.append(h2, score);

    const domain = document.createElement('div');
    domain.className = 'domain';
    domain.textContent = `${result.domain} · ${result.sources.join(' + ')}`;

    const snippet = document.createElement('div');
    snippet.className = 'snippet';
    snippet.textContent = result.snippet;

    article.append(head, domain, snippet);

    if (result.deep?.note) {
      const deep = document.createElement('div');
      deep.className = 'deep-note';
      deep.textContent = result.deep.note;
      article.appendChild(deep);
    }

    const reason = document.createElement('div');
    reason.className = 'reason';
    const reasons = [...new Set([...(result.reasons || []), ...(result.deep?.reasons || [])])];
    reason.textContent = reasons.length ? 'Perché: ' + reasons.slice(0, 4).join(' · ') : 'Ranking locale';
    article.appendChild(reason);

    const block = document.createElement('button');
    block.type = 'button';
    block.className = 'block-site';
    block.textContent = 'Segna come fake · escludi sito';
    block.title = `Escludi ${siteHost(result.url)} dalle future ricerche`;
    block.addEventListener('click', async () => {
      try { await blockResultSite(result.url); }
      catch (error) { summaryEl.textContent = 'Blocco non salvato: ' + (error?.message || error); }
    });
    article.appendChild(block);

    resultsEl.appendChild(article);
  });

}

async function executeSearch(rawQuery, useTavily = false) {
  activeController?.abort();
  activeController = new AbortController();
  const signal = activeController.signal;

  const query = parseQuery(rawQuery);
  const options = {
    deep: document.getElementById('deep').checked,
    preferDirect: document.getElementById('prefer-direct').checked,
    penalizeShopping: document.getElementById('penalize-shopping').checked,
    penalizeSocial: document.getElementById('penalize-social').checked,
    hideSuspicious: document.getElementById('hide-suspicious').checked
  };

  stopButton.disabled = false;
  resultsEl.textContent = '';
  summaryEl.textContent = 'Cerco candidati…';

  try {
    await loadBlockedSites();
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const requests = [searchCandidates(query, signal)];
    if (useTavily) requests.push(browser.runtime.sendMessage({
      type: 'tavily-search-explicit', query: query.engineQuery
    }));
    const outcomes = await Promise.allSettled(requests);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const duck = outcomes[0].status === 'fulfilled'
      ? outcomes[0].value : { candidates: [], excludedAds: 0 };
    const tavily = useTavily && outcomes[1].status === 'fulfilled'
      ? outcomes[1].value.results : [];
    const sourceErrors = outcomes.filter(item => item.status === 'rejected')
      .map(item => item.reason?.message || String(item.reason));
    if (outcomes.every(item => item.status === 'rejected')) {
      throw new Error(sourceErrors.join(' · '));
    }
    let candidates = mergeCandidates(duck.candidates, tavily);
    const collectedCount = candidates.length;
    if (useTavily) await updateTavilyStatus();
    const blockedCount = candidates.filter(result => isBlockedSite(result.url)).length;
    candidates = candidates.filter(result => !isBlockedSite(result.url));
    const hiddenSuspicious = options.hideSuspicious
      ? candidates.filter(result => result.suspiciousReasons.length).length : 0;
    if (options.hideSuspicious) {
      candidates = candidates.filter(result => !result.suspiciousReasons.length);
    }

    for (const result of candidates) {
      const scored = scoreCandidate(result, query, options);
      result.initialScore = scored.score;
      result.finalScore = scored.score;
      result.reasons = scored.reasons;
    }

    candidates = candidates
      .filter((result) => Number.isFinite(result.initialScore))
      .sort((a, b) => b.initialScore - a.initialScore);

    let deepRead = 0;

    if (options.deep) {
      const inspect = candidates.slice(0, 5);
      summaryEl.textContent = `${candidates.length} candidati trovati · approfondisco i migliori ${inspect.length}…`;

      for (const result of inspect) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        result.deep = await inspectPage(result, query, signal);
        result.finalScore += result.deep.score;
        deepRead += 1;
      }

      candidates = candidates
        .filter((result) => !result.deep?.requiredMissing?.length)
        .sort((a, b) => b.finalScore - a.finalScore);
    }

    render(candidates, query, {
      candidates: collectedCount, excludedAds: duck.excludedAds,
      hiddenSuspicious, blockedCount, deepRead
    });
    if (sourceErrors.length) summaryEl.textContent += ` · Fonte non disponibile: ${sourceErrors.join(' · ')}`;
  } catch (error) {
    if (activeController?.signal !== signal) return;
    if (error?.name === 'AbortError') {
      summaryEl.textContent = 'Ricerca interrotta.';
    } else {
      summaryEl.textContent = 'SMART SEARCH non ha completato la ricerca: ' + (error?.message || error);
    }
  } finally {
    if (activeController?.signal === signal) {
      stopButton.disabled = true;
      activeController = null;
    }
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (query) executeSearch(query);
});

tavilyButton.addEventListener('click', () => {
  const query = queryInput.value.trim();
  if (query) executeSearch(query, true);
  else queryInput.reportValidity();
});

async function updateTavilyStatus() {
  try {
    const state = await browser.runtime.sendMessage({ type: 'tavily-key-status' });
    tavilyButton.disabled = !state.configured || state.used >= state.limit ||
      state.monthUsed >= state.monthLimit;
    tavilyDailyLimit.value = state.limit;
    tavilyStatus.textContent = state.configured
      ? `Chiave configurata · ${state.used}/${state.limit} oggi · ` +
        `${state.monthUsed}/${state.monthLimit} nel mese (contatori locali; la quota effettiva è su Tavily).`
      : 'Nessuna chiave configurata. La ricerca senza chiave resta disponibile.';
  } catch (error) {
    tavilyButton.disabled = true;
    tavilyStatus.textContent = 'Stato Tavily non disponibile: ' + (error?.message || error);
  }
}

document.getElementById('save-tavily-key').addEventListener('click', async () => {
  try {
    await browser.runtime.sendMessage({ type: 'tavily-key-save', key: tavilyKeyInput.value });
    tavilyKeyInput.value = '';
    await updateTavilyStatus();
  } catch (error) {
    tavilyStatus.textContent = 'Chiave non salvata: ' + (error?.message || error);
  }
});

document.getElementById('remove-tavily-key').addEventListener('click', async () => {
  try {
    await browser.runtime.sendMessage({ type: 'tavily-key-remove' });
    tavilyKeyInput.value = '';
    await updateTavilyStatus();
  } catch (error) {
    tavilyStatus.textContent = 'Rimozione fallita: ' + (error?.message || error);
  }
});

document.getElementById('save-tavily-limit').addEventListener('click', async () => {
  try {
    await browser.runtime.sendMessage({
      type: 'tavily-limit-save', limit: tavilyDailyLimit.value
    });
    await updateTavilyStatus();
  } catch (error) {
    tavilyStatus.textContent = 'Limite non salvato: ' + (error?.message || error);
  }
});

updateTavilyStatus();
loadBlockedSites().catch(error => {
  blockedSitesEl.textContent = 'Lista non disponibile: ' + (error?.message || error);
});

stopButton.addEventListener('click', () => {
  activeController?.abort();
});
