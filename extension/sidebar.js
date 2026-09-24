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
