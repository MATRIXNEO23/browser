const statusEl = document.getElementById('status');
const adsButton = document.getElementById('ads');
const modeButtons = [...document.querySelectorAll('[data-mode]')];
let adsEnabled = true;

function render(data) {
  const mode = data?.mode || 'NORMAL';
  adsEnabled = data?.adsEnabled !== false;

  for (const button of modeButtons) {
    button.classList.toggle('active', button.dataset.mode === mode);
  }

  adsButton.textContent = adsEnabled ? 'ADS: ON' : 'ADS: OFF';
  adsButton.classList.toggle('active', adsEnabled);

  const s = data?.status;
  if (!s) {
    statusEl.textContent = 'Nessun dato ancora.';
    return;
  }

  const warning = s.degradedByProtectedTabs
    ? '\nLimite superato da tab protette/non scaricabili.'
    : '';

  statusEl.textContent =
    `Background: ${s.activeBackground}/${s.limit}` +
    `\nProtette: ${s.protectedBackground}` +
    `\nScaricate ora: ${s.discardedNow}` +
    warning;
}

async function refresh() {
  render(await browser.runtime.sendMessage({ type: 'get-status' }));
}

for (const button of modeButtons) {
  button.addEventListener('click', async () => {
    await browser.runtime.sendMessage({ type: 'set-mode', mode: button.dataset.mode });
    await refresh();
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

document.getElementById('addons-installed').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'open-addons-installed' });
});

document.getElementById('addons-store').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'open-addons-store' });
});

document.getElementById('close').addEventListener('click', async () => {
  await browser.sidebarAction.close();
});

refresh();


document.getElementById('smart-search').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'open-smart-search' });
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
  } catch (error) {
    statusEl.textContent = 'Rete: ' + (error?.message || error);
  }
});

document.getElementById('library').addEventListener('click', async () => {
  await browser.tabs.create({ url: browser.runtime.getURL('library.html') });
});

loadNetworkSettings();
