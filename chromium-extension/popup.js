const statusEl = document.getElementById('status');
const adsButton = document.getElementById('ads');
const modeButtons = [...document.querySelectorAll('[data-mode]')];
let current;

async function command(type, fields = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...fields });
  if (!response?.ok) throw new Error(response?.error || 'Nessuna risposta dal controller.');
  return response.data;
}

function render(data) {
  current = data;
  modeButtons.forEach(button => button.classList.toggle('active', button.dataset.mode === data.mode));
  adsButton.textContent = `ADS: ${data.adsEnabled ? 'ON' : 'OFF'}`;
  adsButton.classList.toggle('active', data.adsEnabled);
  statusEl.textContent = `${data.mode} · ${data.activeBackground} schede attive in background` +
    (data.protectedBackground ? ` · ${data.protectedBackground} protette` : '');
  renderTor(data.tor);
}

const torStatusEl = document.getElementById('tor-status');
const torConnectButton = document.getElementById('tor-connect');
const torDisconnectButton = document.getElementById('tor-disconnect');
function renderTor(tor) {
  torConnectButton.disabled = tor?.active === true;
  torDisconnectButton.disabled = tor?.active !== true;
  torStatusEl.textContent = tor?.active
    ? (tor.verified ? `Connesso · uscita Tor verificata (${tor.ip || 'IP non disponibile'}). Proxy esterno attivo.`
      : 'Proxy attivo, uscita Tor non verificata di recente. Non presumere anonimato.')
    : 'Proxy FILUM inattivo.';
}

async function act(type, fields) {
  statusEl.textContent = 'Applicazione…';
  try { render(await command(type, fields)); }
  catch (error) { statusEl.textContent = `Errore: ${error.message}`; }
}

modeButtons.forEach(button => button.addEventListener('click', () => act('mode', { mode: button.dataset.mode })));
adsButton.addEventListener('click', () => { if (current) act('ads', { enabled: !current.adsEnabled }); });
document.getElementById('enforce').addEventListener('click', () => act('enforce'));
torConnectButton.addEventListener('click', () => {
  torStatusEl.textContent = 'Connessione e verifica in corso…';
  command('tor-connect').then(render, async error => {
    try { render(await command('status')); } catch (_) { /* preserve the original error */ }
    torStatusEl.textContent = `Tor: ${error.message}`;
  });
});
torDisconnectButton.addEventListener('click', () => {
  torStatusEl.textContent = 'Ripristino proxy…';
  command('tor-disconnect').then(render, error => { torStatusEl.textContent = `Tor: ${error.message}`; });
});
act('status');
