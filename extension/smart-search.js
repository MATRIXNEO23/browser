const form = document.getElementById('search-form');
const queryInput = document.getElementById('query');
const resultsEl = document.getElementById('results');
const summaryEl = document.getElementById('summary');
const stopButton = document.getElementById('stop');

let activeController = null;

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
    return redirected ? decodeURIComponent(redirected) : parsed.href;
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

  for (const node of doc.querySelectorAll('.result')) {
    const anchor = node.querySelector('.result__a');
    if (!anchor) continue;

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
      snippet,
      deep: null,
      initialScore: 0,
      finalScore: 0,
      reasons: []
    });

    if (candidates.length >= 30) break;
  }

  return candidates;
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

    const score = document.createElement('div');
    score.className = 'score';
    score.textContent = `pertinenza ${Math.round(result.finalScore)}`;

    head.append(h2, score);

    const domain = document.createElement('div');
    domain.className = 'domain';
    domain.textContent = result.domain;

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

    resultsEl.appendChild(article);
  });

  summaryEl.textContent =
    `${meta.candidates} candidati · ${meta.deepRead} pagine approfondite · ${shown.length} risultati mostrati · ranking locale`;
}

async function executeSearch(rawQuery) {
  activeController?.abort();
  activeController = new AbortController();
  const signal = activeController.signal;

  const query = parseQuery(rawQuery);
  const options = {
    deep: document.getElementById('deep').checked,
    preferDirect: document.getElementById('prefer-direct').checked,
    penalizeShopping: document.getElementById('penalize-shopping').checked,
    penalizeSocial: document.getElementById('penalize-social').checked
  };

  stopButton.disabled = false;
  resultsEl.textContent = '';
  summaryEl.textContent = 'Cerco candidati…';

  try {
    let candidates = await searchCandidates(query, signal);

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

    render(candidates, query, { candidates: candidates.length, deepRead });
  } catch (error) {
    if (error?.name === 'AbortError') {
      summaryEl.textContent = 'Ricerca interrotta.';
    } else {
      summaryEl.textContent = 'SMART SEARCH non ha completato la ricerca: ' + (error?.message || error);
    }
  } finally {
    stopButton.disabled = true;
    activeController = null;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (query) executeSearch(query);
});

stopButton.addEventListener('click', () => {
  activeController?.abort();
});
