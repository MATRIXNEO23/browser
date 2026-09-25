const statusEl = document.getElementById('status');
const modeWarning = document.getElementById('mode-warning');
const resourceEl = document.getElementById('resource-stats');
const adsButton = document.getElementById('ads');
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const browserTheme = document.getElementById('browser-theme');
const websiteAppearance = document.getElementById('website-appearance');
const httpsOnly = document.getElementById('https-only');
const secureDns = document.getElementById('secure-dns');
const dnsProvider = document.getElementById('dns-provider');
const dnsEndpoint = document.getElementById('dns-endpoint');
const applyDns = document.getElementById('apply-dns');
const dnsStatus = document.getElementById('dns-status');
const hardwareAccel = document.getElementById('hardware-accel');
const hardwareNote = document.getElementById('hardware-note');
const torButton = document.getElementById('tor-toggle');
const torStatus = document.getElementById('tor-status');
const applyNetworkButton = document.getElementById('apply-network');
const diagnosticsButton = document.getElementById('diagnostics');

let adsEnabled = null;
let torEnabled = false;
let torStarting = false;
let torActionError = '';
let previousCpuSample = null;
const DNS_PROVIDERS = Object.freeze({
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  google: 'https://dns.google/dns-query',
  quad9: 'https://dns.quad9.net/dns-query'
});

function providerFor(level, uri) {
  if (level === 'off') return 'system';
  if (!uri) return 'default';
  return Object.keys(DNS_PROVIDERS).find(key => DNS_PROVIDERS[key] === uri) || 'custom';
}

function formatMb(bytes) {
  return (Number(bytes || 0) / 1024 / 1024).toFixed(0) + ' MB';
}

function errorText(error) {
  return error?.message || String(error || 'Errore sconosciuto');
}

function setPanelStatus(text, error = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', error);
}

function setModeVisual(mode) {
  document.body.dataset.mode = mode;

  for (const button of modeButtons) {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function renderResources(stats) {
  if (!stats) {
    resourceEl.textContent = 'RAM — · CPU — · processi —';
    return;
  }

  const now = performance.now();
  let cpu = '—';

  if (previousCpuSample) {
    const cpuDeltaMs =
      (Number(stats.cpuTimeNs) - previousCpuSample.cpuTimeNs) / 1e6;
    const wallDeltaMs = now - previousCpuSample.at;
    const cores = Math.max(1, navigator.hardwareConcurrency || 1);

    if (wallDeltaMs > 0 && cpuDeltaMs >= 0) {
      const pct = Math.max(
        0,
        Math.min(100, (cpuDeltaMs / wallDeltaMs / cores) * 100)
      );
      cpu = pct.toFixed(1) + '%';
    }
  }

  previousCpuSample = {
    cpuTimeNs: Number(stats.cpuTimeNs || 0),
    at: now
  };

  resourceEl.textContent =
    `RAM ${formatMb(stats.memoryBytes)} · CPU ${cpu} · processi ${stats.processCount ?? '—'}`;
}

function render(data) {
  const mode = data?.mode || 'NORMAL';
  adsEnabled = typeof data?.adsEnabled === 'boolean' ? data.adsEnabled : null;
  torEnabled = !!data?.torEnabled;
  torStarting = !!data?.torStarting;

  setModeVisual(mode);
  const health = data?.modeHealth;
  const warnings = [];
  if (adsEnabled === null) warnings.push('ADS: stato non verificabile.');
  if (!health?.ok) warnings.push(
    `${mode}: applicazione incompleta o interrotta. ${health?.issues?.join(' · ') || 'Stato non verificabile.'}`
  );
  if (mode === 'GHOST' && data?.ghostSessionRestartedAt) {
    warnings.push('GHOST: pulizia eseguita, poi un errore ha riavviato una nuova sessione vuota.');
  }
  if (torEnabled && (!data?.torProcess?.bootstrapped || !data?.torRouted)) {
    warnings.push('TOR: connessione o instradamento interrotto; arresta TOR per ripristinare il proxy.');
  }
  if (!torEnabled && !data?.torStarting && data?.torProcess?.running) {
    warnings.push('TOR: processo inatteso senza instradamento confermato; arresta TOR.');
  }
  modeWarning.hidden = !warnings.length;
  modeWarning.textContent = warnings.length ? '⚠ ' + warnings.join(' · ') : '';

  adsButton.textContent = adsEnabled === null ? 'ADS: ERRORE' : adsEnabled ? 'ADS: ON' : 'ADS: OFF';
  adsButton.classList.toggle('active', adsEnabled);
  adsButton.setAttribute('aria-pressed', String(adsEnabled));

  const torReady = !!data?.torProcess?.bootstrapped;
  const torRouted = torEnabled && torReady && data?.torRouted;
  torButton.textContent = torRouted ? 'TOR: ON' : data?.torStarting ? 'TOR: AVVIO' : torEnabled || data?.torProcess?.running
    ? 'TOR: ERRORE' : 'TOR: OFF';
  torButton.classList.toggle('active', torRouted);
  torButton.setAttribute('aria-pressed', String(torRouted));
  dnsProvider.disabled = torEnabled || torStarting;
  secureDns.disabled = torEnabled || torStarting;
  dnsEndpoint.disabled = torEnabled || torStarting;
  applyDns.disabled = torEnabled || torStarting;

  if (torEnabled && data?.torProcess?.error) {
    torStatus.textContent = 'TOR: ' + data.torProcess.error;
  } else if (torEnabled && !torReady) {
    torStatus.textContent = '⚠ TOR interrotto o bootstrap perso. Premi per arrestare e ripristinare il proxy.';
  } else if (torEnabled && !torRouted) {
    torStatus.textContent = '⚠ TOR avviato, ma proxy SOCKS5/DNS non confermato. Premi per arrestare.';
  } else if (torRouted) {
    torStatus.textContent =
      'TOR attivo · bootstrap 100% · SOCKS5 + DNS remoto · WebRTC bloccato.';
  } else if (data?.torStarting) {
    torStatus.textContent = 'TOR in avvio e bootstrap…';
  } else if (data?.torProcess?.running) {
    torStatus.textContent = '⚠ Processo TOR inatteso; premi per arrestare.';
  } else {
    torStatus.textContent = 'TOR disattivato.';
  }

  if (torEnabled) dnsStatus.textContent = 'DNS gestito da TOR; modifica disponibile dopo lo stop.';

  renderResources(data?.processStats);
  updateSocksVisibility();

  const s = data?.status;
  if (!s) {
    setPanelStatus('Stato pronto.');
    return;
  }

  const warning = s.degradedByProtectedTabs
    ? '\nLimite superato da tab protette/non scaricabili.'
    : '';

  const turbo = s.turboIdleDiscardMs
    ? `\nTURBO discard: ${Math.round(s.turboIdleDiscardMs / 1000)} s`
    : '';

  setPanelStatus(
    `Modalità: ${mode}` +
      `\nBackground: ${s.activeBackground}/${s.limit}` +
      `\nProtette: ${s.protectedBackground}` +
      `\nScaricate ora: ${s.discardedNow}` +
      turbo +
      warning
  );
}

async function getStatus() {
  return browser.runtime.sendMessage({ type: 'get-status' });
}

async function refresh() {
  try {
    const data = await getStatus();
    render(data);
    return data;
  } catch (error) {
    setPanelStatus('Errore stato: ' + errorText(error), true);
    throw error;
  }
}

async function loadAdvancedSettings() {
  try {
    const data = await browser.runtime.sendMessage({
      type: 'get-advanced-settings'
    });

    browserTheme.value = data.browserTheme || 'dark';
    websiteAppearance.value = data.websiteAppearance || 'auto';
    httpsOnly.checked = !!data.httpsOnly;
    secureDns.value = data.secureDns || 'off';
    dnsEndpoint.value = data.secureDnsUri || '';
    dnsProvider.value = providerFor(secureDns.value, dnsEndpoint.value);
    hardwareAccel.checked = data.hardwareAcceleration !== false;

    dnsStatus.textContent =
      torEnabled
        ? 'DNS gestito da TOR; modifica disponibile dopo lo stop.'
        : data.secureDns === 'off'
        ? 'DNS di sistema attivo.'
        : data.secureDnsUri
          ? 'DoH personalizzato: ' + data.secureDnsUri
          : 'DoH attivo con provider predefinito.';

    return data;
  } catch (error) {
    hardwareNote.textContent =
      'Impostazioni avanzate non disponibili: ' + errorText(error);
    throw error;
  }
}

async function selectMode(mode) {
  const previous = (await getStatus()).mode || 'NORMAL';
  setModeVisual(mode);
  setPanelStatus('Applicazione modalità ' + mode + '…');

  try {
    const result = await browser.runtime.sendMessage({
      type: 'set-mode',
      mode
    });

    if (!result || result.mode !== mode) {
      throw new Error('La modalità non è stata confermata dal core.');
    }

    const data = await refresh();
    await loadAdvancedSettings();

    if (data.mode !== mode) {
      throw new Error('La modalità riletta non corrisponde a ' + mode + '.');
    }

    if (!data.modeHealth?.ok) {
      setPanelStatus('Modalità parziale: controlla il warning in alto.', true);
    }

    return data;
  } catch (error) {
    try { await refresh(); }
    catch (_) { setModeVisual(previous); }
    setPanelStatus('Modalità: ' + errorText(error), true);
    throw error;
  }
}

for (const button of modeButtons) {
  button.addEventListener('click', async () => {
    try {
      await selectMode(button.dataset.mode);
    } catch (_) {}
  });
}

diagnosticsButton.addEventListener('click', async () => {
  try {
    await browser.tabs.create({ url: browser.runtime.getURL('diagnostics.html') });
  } catch (error) {
    setPanelStatus('Diagnostica: ' + errorText(error), true);
  }
});

adsButton.addEventListener('click', async () => {
  if (adsEnabled === null) { await refresh(); return; }
  const requested = !adsEnabled;
  adsButton.classList.toggle('active', requested);
  adsButton.textContent = requested ? 'ADS: ON' : 'ADS: OFF';

  try {
    const result = await browser.runtime.sendMessage({
      type: 'set-ads',
      enabled: requested
    });

    if (result?.adsEnabled !== requested) {
      throw new Error('Stato ADS non confermato.');
    }

    await refresh();
  } catch (error) {
    setPanelStatus('ADS: ' + errorText(error), true);
    await refresh().catch(() => {});
  }
});

torButton.addEventListener('click', async () => {
  torButton.disabled = true;
  torActionError = '';

  try {
    const current = await getStatus();
    const stopping = current.torEnabled || current.torProcess?.running;
    torStatus.textContent = stopping ? 'Disattivazione TOR…' : 'Avvio TOR e bootstrap della rete…';
    const result = await browser.runtime.sendMessage({
      type: 'set-tor',
      enabled: !stopping
    });

    if (!stopping && (!result?.enabled || !result?.process?.bootstrapped)) {
      throw new Error('TOR non ha completato il bootstrap.');
    }

    await Promise.all([
      refresh(),
      loadAdvancedSettings(),
      loadNetworkSettings()
    ]);
  } catch (error) {
    torActionError = errorText(error);
    torStatus.textContent = 'TOR: ' + errorText(error);
    setPanelStatus('TOR: ' + errorText(error), true);
    await refresh().catch(() => {});
  } finally {
    torButton.disabled = false;
  }
});

document.getElementById('enforce').addEventListener('click', async () => {
  try {
    const result = await browser.runtime.sendMessage({ type: 'enforce-now' });
    if (!result?.ok) throw new Error('Comando RAM non confermato.');
    setPanelStatus('Controllo RAM eseguito.');
    await refresh();
  } catch (error) {
    setPanelStatus('RAM: ' + errorText(error), true);
  }
});

browserTheme.addEventListener('change', async () => {
  const requested = browserTheme.value;
  try {
    await browser.runtime.sendMessage({
      type: 'set-browser-theme',
      mode: requested
    });
    setPanelStatus('Interfaccia: ' + requested.toUpperCase());
  } catch (error) {
    setPanelStatus('Interfaccia: ' + errorText(error), true);
  }
});

websiteAppearance.addEventListener('change', async () => {
  const requested = websiteAppearance.value;
  try {
    await browser.runtime.sendMessage({
      type: 'set-website-appearance',
      mode: requested
    });
    await loadAdvancedSettings();
    setPanelStatus(
      'Aspetto siti: ' + requested.toUpperCase()
    );
  } catch (error) {
    setPanelStatus('Aspetto siti: ' + errorText(error), true);
  }
});

httpsOnly.addEventListener('change', async () => {
  try {
    const result = await browser.runtime.sendMessage({
      type: 'set-https-only',
      enabled: httpsOnly.checked
    });

    if (result?.enabled !== httpsOnly.checked) {
      throw new Error('Stato HTTPS-only non confermato.');
    }

    setPanelStatus(
      'HTTPS-only: ' + (httpsOnly.checked ? 'ON' : 'OFF')
    );
  } catch (error) {
    setPanelStatus('HTTPS-only: ' + errorText(error), true);
    await loadAdvancedSettings().catch(() => {});
  }
});

secureDns.addEventListener('change', () => {
  if (secureDns.value === 'off') dnsEndpoint.value = '';
  dnsProvider.value = providerFor(secureDns.value, dnsEndpoint.value);
  dnsStatus.textContent = 'Premi “Applica DNS” per confermare la modifica.';
});

dnsProvider.addEventListener('change', () => {
  const choice = dnsProvider.value;
  if (choice === 'system') {
    secureDns.value = 'off';
    dnsEndpoint.value = '';
  } else {
    if (secureDns.value === 'off') secureDns.value = 'balanced';
    if (choice === 'default') dnsEndpoint.value = '';
    else if (DNS_PROVIDERS[choice]) dnsEndpoint.value = DNS_PROVIDERS[choice];
  }
  dnsStatus.textContent = 'Premi “Applica DNS” per confermare la modifica.';
});

dnsEndpoint.addEventListener('input', () => {
  if (dnsEndpoint.value.trim() && secureDns.value === 'off') secureDns.value = 'balanced';
  dnsProvider.value = providerFor(secureDns.value, dnsEndpoint.value.trim());
  dnsStatus.textContent = 'Premi “Applica DNS” per confermare la modifica.';
});

applyDns.addEventListener('click', async () => {
  applyDns.disabled = true;

  try {
    const level = secureDns.value;
    const uri = dnsEndpoint.value.trim();

    if (uri && level === 'off') {
      throw new Error(
        'Per usare un endpoint personalizzato seleziona DoH + fallback o DoH STRICT.'
      );
    }

    const result = await browser.runtime.sendMessage({
      type: 'set-secure-dns',
      level,
      uri
    });

    if (result?.level !== level || (level !== 'off' && result.uri !== uri)) {
      throw new Error('Configurazione DNS non confermata.');
    }

    const confirmed = await loadAdvancedSettings();
    if (confirmed.secureDns !== level ||
        (level !== 'off' && confirmed.secureDnsUri !== uri)) {
      throw new Error('DNS applicato ma la rilettura non corrisponde.');
    }
    dnsStatus.textContent =
      level === 'off'
        ? 'DNS di sistema applicato.'
        : result.uri
          ? `${dnsProvider.options[dnsProvider.selectedIndex].text} applicato (DoH).`
          : 'DNS DoH predefinito applicato.';
    setPanelStatus('DNS applicato: ' + level.toUpperCase());
  } catch (error) {
    dnsStatus.textContent = 'DNS: ' + errorText(error);
    setPanelStatus('DNS: ' + errorText(error), true);
  } finally {
    applyDns.disabled = torEnabled || torStarting;
  }
});

hardwareAccel.addEventListener('change', async () => {
  try {
    const result = await browser.runtime.sendMessage({
      type: 'set-hardware-acceleration',
      enabled: hardwareAccel.checked
    });

    hardwareNote.textContent = result?.restartRequired
      ? 'La modifica sarà completa al prossimo riavvio.'
      : '';
    setPanelStatus(
      'Accelerazione hardware: ' + (hardwareAccel.checked ? 'ON' : 'OFF')
    );
  } catch (error) {
    setPanelStatus('Accelerazione hardware: ' + errorText(error), true);
    await loadAdvancedSettings().catch(() => {});
  }
});

for (const button of document.querySelectorAll('[data-internal-page]')) {
  button.addEventListener('click', async () => {
    try {
      const result = await browser.runtime.sendMessage({
        type: 'open-internal-page',
        page: button.dataset.internalPage
      });

      if (!result?.opened) throw new Error('Pagina non aperta.');
    } catch (error) {
      setPanelStatus('Apertura pagina: ' + errorText(error), true);
    }
  });
}

document.getElementById('addons-installed').addEventListener('click', async () => {
  try {
    await browser.runtime.sendMessage({ type: 'open-addons-installed' });
  } catch (error) {
    setPanelStatus('Addon: ' + errorText(error), true);
  }
});

document.getElementById('addons-store').addEventListener('click', async () => {
  try {
    await browser.runtime.sendMessage({ type: 'open-addons-store' });
  } catch (error) {
    setPanelStatus('Catalogo addon: ' + errorText(error), true);
  }
});

document.getElementById('smart-search').addEventListener('click', async () => {
  try {
    await browser.runtime.sendMessage({ type: 'open-smart-search' });
  } catch (error) {
    setPanelStatus('Smart Search: ' + errorText(error), true);
  }
});

document.getElementById('library').addEventListener('click', async () => {
  try {
    await browser.tabs.create({
      url: browser.runtime.getURL('library.html')
    });
  } catch (error) {
    setPanelStatus('Libreria: ' + errorText(error), true);
  }
});

document.getElementById('close').addEventListener('click', async () => {
  try {
    await browser.runtime.sendMessage({
      type: 'set-filum-panel-open',
      open: false
    });
  } catch (error) {
    setPanelStatus('Chiusura pannello: ' + errorText(error), true);
  }
});

const networkMode = document.getElementById('network-mode');
const socksFields = document.getElementById('socks-fields');
const socksHost = document.getElementById('socks-host');
const socksPort = document.getElementById('socks-port');

function updateSocksVisibility() {
  socksFields.style.display =
    networkMode.value === 'socks' && !torEnabled && !torStarting ? 'grid' : 'none';
  networkMode.disabled = torEnabled || torStarting;
  socksHost.disabled = torEnabled || torStarting;
  socksPort.disabled = torEnabled || torStarting;
  applyNetworkButton.disabled = torEnabled || torStarting;
}

async function loadNetworkSettings() {
  try {
    const current = await browser.proxy.settings.get({});
    const value = current?.value || {};

    if (value.proxyType === 'manual' && value.socks) {
      networkMode.value = 'socks';
      const match = String(value.socks).match(/^(.+):(\d+)$/);
      if (match) {
        socksHost.value = match[1];
        socksPort.value = match[2];
      }
    } else if (value.proxyType === 'system') {
      networkMode.value = 'system';
    } else {
      networkMode.value = 'direct';
    }
  } catch (error) {
    setPanelStatus('Rete: ' + errorText(error), true);
    networkMode.value = 'system';
  }

  updateSocksVisibility();
}

networkMode.addEventListener('change', updateSocksVisibility);

applyNetworkButton.addEventListener('click', async () => {
  try {
    if (networkMode.value === 'direct') {
      await browser.proxy.settings.set({ value: { proxyType: 'none' } });
    } else if (networkMode.value === 'system') {
      await browser.proxy.settings.set({ value: { proxyType: 'system' } });
    } else {
      const host = socksHost.value.trim();
      const port = Number(socksPort.value);

      if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('SOCKS5: host o porta non validi.');
      }

      await browser.proxy.settings.set({
        value: {
          proxyType: 'manual',
          socks: host + ':' + port,
          socksVersion: 5,
          proxyDNS: true,
          passthrough: 'localhost, 127.0.0.1'
        }
      });
    }

    await loadNetworkSettings();
    setPanelStatus('Rete applicata: ' + networkMode.value.toUpperCase());
  } catch (error) {
    setPanelStatus('Rete: ' + errorText(error), true);
  }
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(check, timeoutMs = 5000, stepMs = 150) {
  const end = Date.now() + timeoutMs;

  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await sleep(stepMs);
  }

  throw new Error('Timeout self-test.');
}

async function runControlSelfTest() {
  const checks = [];
  let passed = true;

  const record = (name, ok, detail = '') => {
    checks.push({ name, ok: !!ok, detail });
    if (!ok) passed = false;
  };

  const initialStatus = await getStatus();
  const initialAdvanced = await browser.runtime.sendMessage({
    type: 'get-advanced-settings'
  });
  const initialProxy = (await browser.proxy.settings.get({})).value;

  try {
    const initialTabs = await browser.tabs.query({ active: true });
    const expectedNewTab = browser.runtime.getURL('newtab.html');
    const startup = await browser.runtime.sendMessage({ type: 'get-mode-diagnostics' });
    record('startup-homepage-config', startup.startupPage === 1 &&
      startup.startupHomepage === 'about:newtab', JSON.stringify({
        page: startup.startupPage, homepage: startup.startupHomepage,
        headlessInitialTabs: initialTabs.map(tab => tab.url || tab.pendingUrl || '')
      }));
    const newTab = await browser.tabs.create({ url: expectedNewTab, active: false });
    try {
      const resolved = await waitFor(async () => {
        const tab = await browser.tabs.get(newTab.id);
        return (tab.url || tab.pendingUrl || '').startsWith(expectedNewTab);
      }, 10000).catch(() => false);
      record('filum-newtab-page-load', !!resolved, (await browser.tabs.get(newTab.id)).url || '');
    } finally {
      await browser.tabs.remove(newTab.id);
    }

    for (const mode of ['NORMAL', 'TURBO', 'PRIVATE', 'GHOST']) {
      const button = modeButtons.find(item => item.dataset.mode === mode);
      button.click();

      await waitFor(async () => (await getStatus()).mode === mode);
      await waitFor(() => button.classList.contains('active') &&
        button.getAttribute('aria-pressed') === 'true');
      await waitFor(async () => (await getStatus()).modeHealth?.ok, 10000)
        .catch(() => {});

      const applied = await browser.runtime.sendMessage({ type: 'get-mode-diagnostics' });
      const privacy = await browser.privacy.websites.resistFingerprinting.get({});
      const health = (await getStatus()).modeHealth;
      const protectedMode = mode === 'PRIVATE' || mode === 'GHOST';
      const expectedAutoplay = mode === 'TURBO' || mode === 'GHOST' ? 5 : 1;

      record(
        'mode-' + mode.toLowerCase(),
        button.classList.contains('active') &&
          button.getAttribute('aria-pressed') === 'true' &&
          applied.httpsOnly === protectedMode &&
          applied.fingerprintResistance === protectedMode &&
          applied.autoplay === expectedAutoplay &&
          privacy.value === protectedMode && health?.ok,
        JSON.stringify({ selected: mode, applied, fingerprintPrivacy: privacy.value,
          issues: health?.issues || [] })
      );
    }

    await selectMode(initialStatus.mode || 'NORMAL');

    const adsBefore = (await getStatus()).adsEnabled;
    adsButton.click();
    await waitFor(async () => (await getStatus()).adsEnabled !== adsBefore);
    await refresh();
    record(
      'ads-toggle',
      adsButton.classList.contains('active') === !adsBefore
    );
    adsButton.click();
    await waitFor(async () => (await getStatus()).adsEnabled === adsBefore);

    httpsOnly.checked = !initialAdvanced.httpsOnly;
    httpsOnly.dispatchEvent(new Event('change'));
    await waitFor(async () => {
      const value = await browser.runtime.sendMessage({
        type: 'get-advanced-settings'
      });
      return value.httpsOnly === !initialAdvanced.httpsOnly;
    });
    record('https-only', true);

    await browser.runtime.sendMessage({
      type: 'set-https-only',
      enabled: !!initialAdvanced.httpsOnly
    });

    secureDns.value = 'balanced';
    dnsEndpoint.value = 'https://example.com/dns-query';
    applyDns.click();
    await waitFor(async () => {
      const value = await browser.runtime.sendMessage({
        type: 'get-advanced-settings'
      });
      return (
        value.secureDns === 'balanced' &&
        value.secureDnsUri === 'https://example.com/dns-query'
      );
    });
    record('dns-custom-endpoint', true);
    await waitFor(() => !applyDns.disabled);

    dnsProvider.value = 'cloudflare';
    dnsProvider.dispatchEvent(new Event('change'));
    applyDns.click();
    await waitFor(async () => {
      const value = await browser.runtime.sendMessage({
        type: 'get-advanced-settings'
      });
      return value.secureDns === 'balanced' &&
        value.secureDnsUri === DNS_PROVIDERS.cloudflare;
    });
    record('dns-cloudflare-preset', dnsEndpoint.value === DNS_PROVIDERS.cloudflare);

    await browser.runtime.sendMessage({
      type: 'set-secure-dns',
      level: initialAdvanced.secureDns || 'off',
      uri: initialAdvanced.secureDnsUri || ''
    });

    const requestedAppearance =
      initialAdvanced.websiteAppearance === 'dark' ? 'light' : 'dark';
    websiteAppearance.value = requestedAppearance;
    websiteAppearance.dispatchEvent(new Event('change'));
    await waitFor(async () => {
      const value = await browser.runtime.sendMessage({
        type: 'get-advanced-settings'
      });
      return value.websiteAppearance === requestedAppearance;
    });
    record('website-appearance', true);

    await browser.runtime.sendMessage({
      type: 'set-website-appearance',
      mode: initialAdvanced.websiteAppearance || 'auto'
    });

    const initialTheme = initialAdvanced.browserTheme || 'dark';
    const requestedTheme = initialTheme === 'black' ? 'dark' : 'black';
    browserTheme.value = requestedTheme;
    browserTheme.dispatchEvent(new Event('change'));
    await waitFor(async () => {
      const value = await browser.runtime.sendMessage({
        type: 'get-advanced-settings'
      });
      return value.browserTheme === requestedTheme;
    });
    record('browser-theme', true);

    await browser.runtime.sendMessage({
      type: 'set-browser-theme',
      mode: initialTheme
    });

    const requestedHardware = !initialAdvanced.hardwareAcceleration;
    hardwareAccel.checked = requestedHardware;
    hardwareAccel.dispatchEvent(new Event('change'));
    await waitFor(async () => {
      const value = await browser.runtime.sendMessage({
        type: 'get-advanced-settings'
      });
      return value.hardwareAcceleration === requestedHardware;
    });
    record('hardware-acceleration', true);

    await browser.runtime.sendMessage({
      type: 'set-hardware-acceleration',
      enabled: !!initialAdvanced.hardwareAcceleration
    });

    const ramResult = await browser.runtime.sendMessage({
      type: 'enforce-now'
    });
    record('free-ram', !!ramResult?.ok);

    await browser.proxy.settings.set({ value: { proxyType: 'none' } });
    let proxy = await browser.proxy.settings.get({});
    record('network-direct', proxy?.value?.proxyType === 'none');

    await browser.proxy.settings.set({ value: { proxyType: 'system' } });
    proxy = await browser.proxy.settings.get({});
    record('network-system-vpn', proxy?.value?.proxyType === 'system');

    await browser.proxy.settings.set({
      value: {
        proxyType: 'manual',
        socks: '127.0.0.1:65534',
        socksVersion: 5,
        proxyDNS: true,
        passthrough: 'localhost, 127.0.0.1'
      }
    });
    proxy = await browser.proxy.settings.get({});
    record(
      'network-socks5',
      proxy?.value?.proxyType === 'manual' &&
        proxy?.value?.socks === '127.0.0.1:65534' &&
        proxy?.value?.socksVersion === 5
    );

    await browser.proxy.settings.set({ value: initialProxy });

    const torStartedAt = Date.now();
    let torOn = null;
    let lastTorStatus = null;
    let lastTorLog = '';
    let observedTorProcess = false;
    let torStatusError = '';
    torButton.click();

    while (Date.now() - torStartedAt < 195000) {
      try {
        lastTorStatus = await getStatus();
        observedTorProcess ||= !!lastTorStatus.torProcess?.running;
        if (lastTorStatus.torProcess?.lastLog?.trim()) {
          lastTorLog = lastTorStatus.torProcess.lastLog.trim();
        }
        if (lastTorStatus.torEnabled && lastTorStatus.torRouted &&
            lastTorStatus.torProcess?.bootstrapped) {
          torOn = lastTorStatus;
          break;
        }
        if (lastTorStatus.torProcess?.error) {
          torStatusError = lastTorStatus.torProcess.error;
          break;
        }
        if (torActionError) {
          torStatusError = torActionError;
          break;
        }
        if (observedTorProcess && !lastTorStatus.torProcess?.running &&
            Date.now() - torStartedAt > 3000) {
          break;
        }
      } catch (error) {
        torStatusError = errorText(error);
      }
      await sleep(500);
    }

    proxy = await browser.proxy.settings.get({});
    const torElapsedMs = Date.now() - torStartedAt;
    const torDiagnostic = JSON.stringify({
      elapsedMs: torElapsedMs,
      processRunning: !!lastTorStatus?.torProcess?.running,
      processObserved: observedTorProcess,
      bootstrapped: !!lastTorStatus?.torProcess?.bootstrapped,
      lastLog: lastTorLog || lastTorStatus?.torProcess?.lastLog || '',
      proxy: proxy?.value || null,
      processFailure: observedTorProcess && !lastTorStatus?.torProcess?.running,
      exitCode: lastTorStatus?.torProcess?.exitCode ?? null,
      error: torStatusError || torActionError || (torOn ? '' : torStatus.textContent)
    });
    record('tor-bootstrap-100', !!torOn?.torProcess?.bootstrapped, torDiagnostic);

    if (torOn) {
      await browser.runtime.sendMessage({ type: 'set-mode', mode: 'NORMAL' });
      const webRtc = await browser.privacy.network.peerConnectionEnabled.get({});
      record('tor-mode-switch-webrtc', webRtc.value === false,
        `WebRTC enabled=${webRtc.value}`);
      await browser.runtime.sendMessage({
        type: 'set-mode', mode: initialStatus.mode || 'NORMAL'
      });
    }
    record(
      'tor-proxy',
      !!torOn && proxy?.value?.proxyType === 'manual' &&
        proxy?.value?.socks === '127.0.0.1:19050' &&
        proxy?.value?.socksVersion === 5 &&
        proxy?.value?.proxyDNS === true,
      torOn ? JSON.stringify(proxy?.value || null) : 'blocked by TOR bootstrap'
    );

    if (torOn) {
      const abort = new AbortController();
      const deadline = setTimeout(() => abort.abort(), 25000);
      try {
        const response = await fetch('https://check.torproject.org/api/ip', {
          cache: 'no-store',
          signal: abort.signal
        });
        const result = await response.json();
        record('tor-egress', response.ok && result?.IsTor === true,
          `HTTP ${response.status}; IsTor=${result?.IsTor}`);
      } catch (error) {
        record('tor-egress', false, errorText(error));
      } finally {
        clearTimeout(deadline);
      }
    } else {
      record('tor-egress', false, 'blocked by TOR bootstrap');
    }

    if (torOn) torButton.click();
    else await browser.runtime.sendMessage({ type: 'set-tor', enabled: false });
    await waitFor(async () => {
      const state = await getStatus();
      return !state.torEnabled && !state.torProcess?.running;
    }, 20000, 250);
    proxy = await browser.proxy.settings.get({});
    record('tor-stop', proxy?.value?.proxyType === initialProxy?.proxyType &&
      proxy?.value?.socks === initialProxy?.socks,
      JSON.stringify(proxy?.value || null));

    const verifyLauncher = async (name, buttonId, expectedUrl) => {
      const before = new Set((await browser.tabs.query({})).map(tab => tab.id));
      const button = document.getElementById(buttonId) ||
        document.querySelector(`[data-internal-page="${buttonId}"]`);
      if (!button) {
        record(name, false, 'Missing launcher: ' + buttonId);
        return;
      }
      button.click();
      try {
        const matchesTarget = url => {
          if (name === 'addons-catalog') {
            return /^https:\/\/addons\.mozilla\.org\/(?:[a-zA-Z-]+\/)?firefox\/extensions\/?(?:[?#].*)?$/.test(url);
          }
          return url.startsWith(expectedUrl);
        };
        const tab = await waitFor(async () => {
          const tabs = await browser.tabs.query({});
          return tabs.find(item => !before.has(item.id) &&
            matchesTarget(item.url || item.pendingUrl || ''));
        }, 10000, 250);
        record(name, true, tab.url || tab.pendingUrl || '');
      } catch (error) {
        const tabs = await browser.tabs.query({});
        const opened = tabs.filter(item => !before.has(item.id))
          .map(item => item.url || item.pendingUrl || '').join(', ');
        record(name, false, `expected=${expectedUrl}; opened=${opened}; ${errorText(error)}`);
      }
    };

    await verifyLauncher('smart-search', 'smart-search',
      browser.runtime.getURL('smart-search.html'));
    await verifyLauncher('addons-installed', 'addons-installed',
      browser.runtime.getURL('addons.html'));
    await verifyLauncher('addons-catalog', 'addons-store',
      'https://addons.mozilla.org/firefox/extensions/');
    await verifyLauncher('library', 'library',
      browser.runtime.getURL('library.html'));
    await verifyLauncher('diagnostics', 'diagnostics',
      browser.runtime.getURL('diagnostics.html'));

    for (const [name, buttonId, url] of [
      ['internal-settings', 'settings', 'about:preferences'],
      ['internal-privacy', 'privacy', 'about:preferences#privacy'],
      ['internal-passwords', 'passwords', 'about:logins'],
      ['internal-profiles', 'profiles', 'about:profiles'],
      ['internal-processes', 'processes', 'about:processes']
    ]) {
      await verifyLauncher(name, buttonId, url);
    }
  } catch (error) {
    record('exception', false, errorText(error));
  } finally {
    try {
      await browser.runtime.sendMessage({
        type: 'set-mode',
        mode: initialStatus.mode || 'NORMAL'
      });
    } catch (_) {}

    try {
      const now = await getStatus();
      if (now.adsEnabled !== initialStatus.adsEnabled) {
        await browser.runtime.sendMessage({
          type: 'set-ads',
          enabled: initialStatus.adsEnabled
        });
      }
    } catch (_) {}

    try {
      const now = await getStatus();
      if (now.torEnabled || now.torProcess?.running) {
        await browser.runtime.sendMessage({
          type: 'set-tor',
          enabled: false
        });
      }
    } catch (_) {}

    try {
      await browser.proxy.settings.set({ value: initialProxy });
    } catch (_) {}

    try {
      await browser.runtime.sendMessage({
        type: 'set-secure-dns',
        level: initialAdvanced.secureDns || 'off',
        uri: initialAdvanced.secureDnsUri || ''
      });
      await browser.runtime.sendMessage({
        type: 'set-website-appearance',
        mode: initialAdvanced.websiteAppearance || 'auto'
      });
      await browser.runtime.sendMessage({
        type: 'set-browser-theme',
        mode: initialAdvanced.browserTheme || 'dark'
      });
      await browser.runtime.sendMessage({
        type: 'set-https-only',
        enabled: !!initialAdvanced.httpsOnly
      });
      await browser.runtime.sendMessage({
        type: 'set-hardware-acceleration',
        enabled: !!initialAdvanced.hardwareAcceleration
      });
    } catch (_) {}
  }

  await browser.browserControl.reportControlSelfTest(
    JSON.stringify({ passed, checks })
  );
}

Promise.all([
  refresh(),
  loadAdvancedSettings(),
  loadNetworkSettings()
]).catch(error => {
  setPanelStatus('Inizializzazione: ' + errorText(error), true);
});

setInterval(() => {
  refresh().catch(() => {});
}, 5000);

if (new URL(location.href).searchParams.get('selftest') === '1') {
  setTimeout(() => {
    runControlSelfTest().catch(async error => {
      await browser.browserControl.reportControlSelfTest(
        JSON.stringify({
          passed: false,
          checks: [
            { name: 'selftest-start', ok: false, detail: errorText(error) }
          ]
        })
      );
    });
  }, 1200);
}
