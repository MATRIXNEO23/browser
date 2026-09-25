const statusEl = document.getElementById('status');
const resourceEl = document.getElementById('resource-stats');
const adsButton = document.getElementById('ads');
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const browserTheme = document.getElementById('browser-theme');
const websiteAppearance = document.getElementById('website-appearance');
const httpsOnly = document.getElementById('https-only');
const secureDns = document.getElementById('secure-dns');
const dnsEndpoint = document.getElementById('dns-endpoint');
const applyDns = document.getElementById('apply-dns');
const dnsStatus = document.getElementById('dns-status');
const hardwareAccel = document.getElementById('hardware-accel');
const hardwareNote = document.getElementById('hardware-note');
const torButton = document.getElementById('tor-toggle');
const torStatus = document.getElementById('tor-status');
const applyNetworkButton = document.getElementById('apply-network');

let adsEnabled = true;
let torEnabled = false;
let previousCpuSample = null;

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
  adsEnabled = data?.adsEnabled !== false;
  torEnabled = !!data?.torEnabled;

  setModeVisual(mode);

  adsButton.textContent = adsEnabled ? 'ADS: ON' : 'ADS: OFF';
  adsButton.classList.toggle('active', adsEnabled);
  adsButton.setAttribute('aria-pressed', String(adsEnabled));

  const torReady = !!data?.torProcess?.bootstrapped;
  torButton.textContent = torEnabled && torReady ? 'TOR: ON' : 'TOR: OFF';
  torButton.classList.toggle('active', torEnabled && torReady);
  torButton.setAttribute('aria-pressed', String(torEnabled && torReady));

  if (data?.torProcess?.error) {
    torStatus.textContent = 'TOR: ' + data.torProcess.error;
  } else if (torEnabled && torReady) {
    torStatus.textContent =
      'TOR attivo · bootstrap 100% · SOCKS5 + DNS remoto · WebRTC bloccato.';
  } else if (data?.torProcess?.running) {
    torStatus.textContent = 'TOR in avvio…';
  } else {
    torStatus.textContent = 'TOR disattivato.';
  }

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
    hardwareAccel.checked = data.hardwareAcceleration !== false;

    dnsStatus.textContent =
      data.secureDns === 'off'
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

    if (!result?.ok || result.mode !== mode) {
      throw new Error('La modalità non è stata confermata dal core.');
    }

    const data = await refresh();
    await loadAdvancedSettings();

    if (data.mode !== mode) {
      throw new Error('La modalità riletta non corrisponde a ' + mode + '.');
    }

    return data;
  } catch (error) {
    setModeVisual(previous);
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

adsButton.addEventListener('click', async () => {
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
  torStatus.textContent = torEnabled
    ? 'Disattivazione TOR…'
    : 'Avvio TOR e bootstrap della rete…';

  try {
    const result = await browser.runtime.sendMessage({
      type: 'set-tor',
      enabled: !torEnabled
    });

    if (!torEnabled && (!result?.enabled || !result?.process?.bootstrapped)) {
      throw new Error('TOR non ha completato il bootstrap.');
    }

    await Promise.all([
      refresh(),
      loadAdvancedSettings(),
      loadNetworkSettings()
    ]);
  } catch (error) {
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
  try {
    await browser.runtime.sendMessage({
      type: 'set-browser-theme',
      mode: browserTheme.value
    });
    setPanelStatus('Interfaccia: ' + browserTheme.value.toUpperCase());
  } catch (error) {
    setPanelStatus('Interfaccia: ' + errorText(error), true);
  }
});

websiteAppearance.addEventListener('change', async () => {
  try {
    await browser.runtime.sendMessage({
      type: 'set-website-appearance',
      mode: websiteAppearance.value
    });
    await loadAdvancedSettings();
    setPanelStatus(
      'Aspetto siti: ' + websiteAppearance.value.toUpperCase()
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

    if (result?.level !== level) {
      throw new Error('Configurazione DNS non confermata.');
    }

    await loadAdvancedSettings();
    dnsStatus.textContent =
      level === 'off'
        ? 'DNS di sistema applicato.'
        : result.uri
          ? 'DNS DoH personalizzato applicato.'
          : 'DNS DoH predefinito applicato.';
    setPanelStatus('DNS applicato: ' + level.toUpperCase());
  } catch (error) {
    dnsStatus.textContent = 'DNS: ' + errorText(error);
    setPanelStatus('DNS: ' + errorText(error), true);
  } finally {
    applyDns.disabled = false;
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
    networkMode.value === 'socks' && !torEnabled ? 'grid' : 'none';
  networkMode.disabled = torEnabled;
  socksHost.disabled = torEnabled;
  socksPort.disabled = torEnabled;
  applyNetworkButton.disabled = torEnabled;
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
    for (const mode of ['NORMAL', 'TURBO', 'PRIVATE', 'GHOST']) {
      const button = modeButtons.find(item => item.dataset.mode === mode);
      button.click();

      await waitFor(async () => (await getStatus()).mode === mode);

      record(
        'mode-' + mode.toLowerCase(),
        button.classList.contains('active') &&
          button.getAttribute('aria-pressed') === 'true',
        'selected=' + mode
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

    await browser.runtime.sendMessage({
      type: 'set-secure-dns',
      level: initialAdvanced.secureDns || 'off',
      uri: initialAdvanced.secureDnsUri || ''
    });

    websiteAppearance.value =
      initialAdvanced.websiteAppearance === 'dark' ? 'light' : 'dark';
    websiteAppearance.dispatchEvent(new Event('change'));
    await waitFor(async () => {
      const value = await browser.runtime.sendMessage({
        type: 'get-advanced-settings'
      });
      return value.websiteAppearance === websiteAppearance.value;
    });
    record('website-appearance', true);

    await browser.runtime.sendMessage({
      type: 'set-website-appearance',
      mode: initialAdvanced.websiteAppearance || 'auto'
    });

    const initialTheme = initialAdvanced.browserTheme || 'dark';
    browserTheme.value = initialTheme === 'black' ? 'dark' : 'black';
    browserTheme.dispatchEvent(new Event('change'));
    await waitFor(async () => {
      const value = await browser.runtime.sendMessage({
        type: 'get-advanced-settings'
      });
      return value.browserTheme === browserTheme.value;
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

    torButton.click();
    const torOn = await waitFor(
      async () => {
        const value = await getStatus();
        return value.torEnabled && value.torProcess?.bootstrapped
          ? value
          : null;
      },
      90000,
      500
    );

    await refresh();
    record('tor-bootstrap-100', !!torOn?.torProcess?.bootstrapped);

    proxy = await browser.proxy.settings.get({});
    record(
      'tor-proxy',
      proxy?.value?.proxyType === 'manual' &&
        proxy?.value?.socks === '127.0.0.1:19050' &&
        proxy?.value?.socksVersion === 5 &&
        proxy?.value?.proxyDNS === true
    );

    torButton.click();
    await waitFor(async () => !(await getStatus()).torEnabled, 20000, 250);
    record('tor-stop', !(await getStatus()).torEnabled);

    const smartBefore = (await browser.tabs.query({})).length;
    const smartResult = await browser.runtime.sendMessage({
      type: 'open-smart-search'
    });
    await waitFor(
      async () => (await browser.tabs.query({})).length > smartBefore
    );
    record('smart-search', !!smartResult?.ok);

    const addonBefore = (await browser.tabs.query({})).length;
    const addonResult = await browser.runtime.sendMessage({
      type: 'open-addons-installed'
    });
    await waitFor(
      async () => (await browser.tabs.query({})).length > addonBefore
    );
    record('addons-installed', !!addonResult?.ok);

    const catalogBefore = (await browser.tabs.query({})).length;
    const catalogResult = await browser.runtime.sendMessage({
      type: 'open-addons-store'
    });
    await waitFor(
      async () => (await browser.tabs.query({})).length > catalogBefore
    );
    record('addons-catalog', !!catalogResult?.ok);

    const libraryBefore = (await browser.tabs.query({})).length;
    await browser.tabs.create({
      url: browser.runtime.getURL('library.html')
    });
    await waitFor(
      async () => (await browser.tabs.query({})).length > libraryBefore
    );
    record('library', true);

    const settingsBefore = (await browser.tabs.query({})).length;
    const settingsResult = await browser.runtime.sendMessage({
      type: 'open-internal-page',
      page: 'settings'
    });
    await waitFor(
      async () => (await browser.tabs.query({})).length > settingsBefore
    );
    record('internal-settings', !!settingsResult?.opened);

    const privacyResult = await browser.runtime.sendMessage({
      type: 'open-internal-page',
      page: 'privacy'
    });
    record('internal-privacy', !!privacyResult?.opened);

    const passwordResult = await browser.runtime.sendMessage({
      type: 'open-internal-page',
      page: 'passwords'
    });
    record('internal-passwords', !!passwordResult?.opened);

    const profilesResult = await browser.runtime.sendMessage({
      type: 'open-internal-page',
      page: 'profiles'
    });
    record('internal-profiles', !!profilesResult?.opened);

    const processesResult = await browser.runtime.sendMessage({
      type: 'open-internal-page',
      page: 'processes'
    });
    record('internal-processes', !!processesResult?.opened);
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
