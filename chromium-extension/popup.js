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
  if (data.torError) {
    torStatusEl.hidden = false;
    torStatusEl.textContent = data.torError;
  }
}

const torStatusEl = document.getElementById('tor-status');
const torToggleButton = document.getElementById('tor-toggle');
const defaultSearchHome = 'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/';
const searchHomeButton = document.getElementById('search-home');
const homeSettingsButton = document.getElementById('home-settings');
const homeForm = document.getElementById('home-form');
const homeUrlInput = document.getElementById('home-url');
function validHome(raw) {
  const url = new URL(raw.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Inserisci un indirizzo HTTP o HTTPS senza credenziali.');
  }
  return url.href;
}
async function savedHome() {
  const { searchHomeUrl } = await chrome.storage.local.get('searchHomeUrl');
  return searchHomeUrl || defaultSearchHome;
}
homeSettingsButton.addEventListener('click', async () => {
  homeForm.hidden = !homeForm.hidden;
  homeSettingsButton.setAttribute('aria-expanded', String(!homeForm.hidden));
  if (!homeForm.hidden) {
    homeUrlInput.value = await savedHome();
    homeUrlInput.focus();
  }
});
homeForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await chrome.storage.local.set({ searchHomeUrl: validHome(homeUrlInput.value) });
    homeForm.hidden = true;
    homeSettingsButton.setAttribute('aria-expanded', 'false');
    torStatusEl.hidden = true;
  } catch (error) { torStatusEl.hidden = false; torStatusEl.textContent = error.message; }
});
document.getElementById('home-reset').addEventListener('click', async () => {
  await chrome.storage.local.remove('searchHomeUrl');
  homeUrlInput.value = defaultSearchHome;
});
searchHomeButton.addEventListener('click', async () => {
  try { await chrome.tabs.create({ url: validHome(await savedHome()) }); }
  catch (error) { torStatusEl.hidden = false; torStatusEl.textContent = `Home: ${error.message}`; }
});
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
let refreshingTor = false;
async function refreshTor() {
  if (refreshingTor || torToggleButton.disabled || document.hidden) return;
  refreshingTor = true;
  torToggleButton.disabled = true;
  torToggleButton.textContent = 'Tor …';
  torToggleButton.classList.remove('tor-on');
  torToggleButton.classList.add('tor-off');
  torToggleButton.setAttribute('aria-pressed', 'false');
  try { render(await command('tor-refresh')); }
  catch (error) { torStatusEl.hidden = false; torStatusEl.textContent = `Verifica Tor: ${error.message}`; }
  finally { refreshingTor = false; torToggleButton.disabled = false; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshTor(); });
setInterval(refreshTor, 30000);
refreshTor();