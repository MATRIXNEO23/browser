const statusEl = document.getElementById('status');
const adsButton = document.getElementById('ads');
const buttons = [...document.querySelectorAll('[data-mode]')];
let adsEnabled = null;

function render(data) {
  const mode = data?.mode || 'NORMAL';
  adsEnabled = typeof data?.adsEnabled === 'boolean' ? data.adsEnabled : null;

  for (const button of buttons) {
    button.classList.toggle('active', button.dataset.mode === mode);
  }

  adsButton.textContent = adsEnabled === null ? 'ADS: ERRORE' : adsEnabled ? 'ADS: ON' : 'ADS: OFF';
  adsButton.classList.toggle('active', adsEnabled);

  const s = data?.status;
  if (!s) {
    statusEl.textContent = 'Nessun dato ancora.';
    return;
  }

  const warning = s.degradedByProtectedTabs
    ? '\nATTENZIONE: limite superato da tab protette/non scaricabili.'
    : '';

  statusEl.textContent =
    `Modalità: ${mode}` +
    `\nADS: ${adsEnabled === null ? 'ERRORE' : adsEnabled ? 'ON' : 'OFF'}` +
    `\nLimite background: ${s.limit}` +
    `\nAttive background: ${s.activeBackground}` +
    `\nProtette/non scaricabili: ${s.protectedBackground}` +
    `\nScaricate ora: ${s.discardedNow}` +
    warning;
}

async function refresh() {
  render(await browser.runtime.sendMessage({ type: 'get-status' }));
}

for (const button of buttons) {
  button.addEventListener('click', async () => {
    await browser.runtime.sendMessage({ type: 'set-mode', mode: button.dataset.mode });
    await refresh();
  });
}

adsButton.addEventListener('click', async () => {
  if (adsEnabled === null) { await refresh(); return; }
  await browser.runtime.sendMessage({ type: 'set-ads', enabled: !adsEnabled });
  await refresh();
});

document.getElementById('enforce').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'enforce-now' });
  await refresh();
});

refresh();
