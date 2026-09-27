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
const torToggleButton = document.getElementById('tor-toggle');
function renderTor(tor) {
  const confirmed = tor?.active === true && tor?.verified === true;
  torToggleButton.textContent = confirmed ? 'Tor ON' : 'Tor OFF';
  torToggleButton.classList.toggle('tor-on', confirmed);
  torToggleButton.classList.toggle('tor-off', !confirmed);
  torToggleButton.setAttribute('aria-pressed', String(confirmed));
  torStatusEl.hidden = !tor?.active || confirmed;
  torStatusEl.textContent = tor?.active && !confirmed ? 'Uscita Tor non verificata. Premi il tasto per disconnettere.' : '';
}

async function act(type, fields) {
  statusEl.textContent = 'Applicazione…';
  try { render(await command(type, fields)); }
  catch (error) { statusEl.textContent = `Errore: ${error.message}`; }
}

modeButtons.forEach(button => button.addEventListener('click', () => act('mode', { mode: button.dataset.mode })));
adsButton.addEventListener('click', () => { if (current) act('ads', { enabled: !current.adsEnabled }); });
document.getElementById('enforce').addEventListener('click', () => act('enforce'));
torToggleButton.addEventListener('click', async () => {
  if (!current || torToggleButton.disabled) return;
  const type = current.tor?.active ? 'tor-disconnect' : 'tor-connect';
  torToggleButton.disabled = true;
  torStatusEl.hidden = false;
  torStatusEl.textContent = type === 'tor-connect' ? 'Connessione e verifica in corso…' : 'Disconnessione…';
  try { render(await command(type)); }
  catch (error) {
    try { render(await command('status')); } catch (_) { /* preserve the original error */ }
    torStatusEl.hidden = false;
    torStatusEl.textContent = `Tor: ${error.message}`;
  } finally { torToggleButton.disabled = false; }
});
act('status');