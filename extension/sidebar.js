const statusEl = document.getElementById('status');
const resourceEl = document.getElementById('resource-stats');
const adsButton = document.getElementById('ads');
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const browserTheme = document.getElementById('browser-theme');
const websiteAppearance = document.getElementById('website-appearance');
const httpsOnly = document.getElementById('https-only');
const secureDns = document.getElementById('secure-dns');
const hardwareAccel = document.getElementById('hardware-accel');
const hardwareNote = document.getElementById('hardware-note');

let adsEnabled = true;
let previousCpuSample = null;

function formatMb(bytes) {
  return (Number(bytes || 0) / 1024 / 1024).toFixed(0) + ' MB';
}

function renderResources(stats) {
  if (!stats) {
    resourceEl.textContent = 'RAM — · CPU — · processi —';
    return;
  }

  const now = performance.now();
  let cpu = '—';

  if (previousCpuSample) {
    const cpuDeltaMs = (Number(stats.cpuTimeNs) - previousCpuSample.cpuTimeNs) / 1e6;
    const wallDeltaMs = now - previousCpuSample.at;
    const cores = Math.max(1, navigator.hardwareConcurrency || 1);

    if (wallDeltaMs > 0 && cpuDeltaMs >= 0) {
      const pct = Math.max(0, Math.min(100, (cpuDeltaMs / wallDeltaMs / cores) * 100));
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

  for (const button of modeButtons) {
    button.classList.toggle('active', button.dataset.mode === mode);
  }

  adsButton.textContent = adsEnabled ? 'ADS: ON' : 'ADS: OFF';
  adsButton.classList.toggle('active', adsEnabled);
  renderResources(data?.processStats);

  const s = data?.status;
  if (!s) {
    statusEl.textContent = 'Nessun dato ancora.';
    return;
  }

  const warning = s.degradedByProtectedTabs
    ? '\nLimite superato da tab protette/non scaricabili.'
    : '';

  const turbo = s.turboIdleDiscardMs
    ? `\nTURBO discard: ${Math.round(s.turboIdleDiscardMs / 1000)} s`
    : '';

  statusEl.textContent =
    `Background: ${s.activeBackground}/${s.limit}` +
    `\nProtette: ${s.protectedBackground}` +
    `\nScaricate ora: ${s.discardedNow}` +
    turbo +
    warning;
}

async function refresh() {
  try {
    render(await browser.runtime.sendMessage({ type: 'get-status' }));
  } catch (_) {}
}

async function loadAdvancedSettings() {
  try {
    const data = await browser.runtime.sendMessage({ type: 'get-advanced-settings' });
    browserTheme.value = data.browserTheme || 'dark';
    websiteAppearance.value = data.websiteAppearance || 'auto';
    httpsOnly.checked = !!data.httpsOnly;
    secureDns.value = data.secureDns || 'off';
    hardwareAccel.checked = data.hardwareAcceleration !== false;
  } catch (error) {
    hardwareNote.textContent = 'Impostazioni avanzate non disponibili in questa build.';
  }
}

for (const button of modeButtons) {
  button.addEventListener('click', async () => {
    await browser.runtime.sendMessage({ type: 'set-mode', mode: button.dataset.mode });
    await Promise.all([refresh(), loadAdvancedSettings()]);
  });
}

adsButton.addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'set-ads', enabled: !adsEnabled });
  await refresh();
});

document.getElementById('enforce').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'enforce-now' });
  await refresh();
});

browserTheme.addEventListener('change', async () => {
  await browser.runtime.sendMessage({
    type: 'set-browser-theme',
    mode: browserTheme.value
  });
});

websiteAppearance.addEventListener('change', async () => {
  await browser.runtime.sendMessage({
    type: 'set-website-appearance',
    mode: websiteAppearance.value
  });
});

httpsOnly.addEventListener('change', async () => {
  await browser.runtime.sendMessage({
    type: 'set-https-only',
    enabled: httpsOnly.checked
  });
});

secureDns.addEventListener('change', async () => {
  await browser.runtime.sendMessage({
    type: 'set-secure-dns',
    level: secureDns.value
  });
});

hardwareAccel.addEventListener('change', async () => {
  const result = await browser.runtime.sendMessage({
    type: 'set-hardware-acceleration',
    enabled: hardwareAccel.checked
  });
  hardwareNote.textContent = result?.restartRequired
    ? 'La modifica dell’accelerazione hardware sarà completa al prossimo riavvio.'
    : '';
});

for (const button of document.querySelectorAll('[data-internal-page]')) {
  button.addEventListener('click', async () => {
    await browser.runtime.sendMessage({
      type: 'open-internal-page',
      page: button.dataset.internalPage
    });
  });
}

document.getElementById('addons-installed').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'open-addons-installed' });
});

document.getElementById('addons-store').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'open-addons-store' });
});

document.getElementById('smart-search').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'open-smart-search' });
});

document.getElementById('library').addEventListener('click', async () => {
  await browser.tabs.create({ url: browser.runtime.getURL('library.html') });
});

document.getElementById('close').addEventListener('click', async () => {
  await browser.sidebarAction.close();
});

const networkMode = document.getElementById('network-mode');
const socksFields = document.getElementById('socks-fields');
const socksHost = document.getElementById('socks-host');
const socksPort = document.getElementById('socks-port');

function updateSocksVisibility() {
  socksFields.style.display = networkMode.value === 'socks' ? 'grid' : 'none';
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
  } catch (_) {
    networkMode.value = 'system';
  }

  updateSocksVisibility();
}

networkMode.addEventListener('change', updateSocksVisibility);

document.getElementById('apply-network').addEventListener('click', async () => {
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

    statusEl.textContent = 'Rete applicata: ' + networkMode.value.toUpperCase();
  } catch (error) {
    statusEl.textContent = 'Rete: ' + (error?.message || error);
  }
});

Promise.all([refresh(), loadAdvancedSettings(), loadNetworkSettings()]);
setInterval(refresh, 5000);
