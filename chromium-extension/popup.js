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
  } else if (!data.tor?.active && data.torRecovery) {
    torStatusEl.hidden = false;
    torStatusEl.textContent = `Riconnessione Tor automatica in corso · tentativo ${Math.min(data.torRecovery.attempts + 1, 3)} di 3.`;
  }
}

const torStatusEl = document.getElementById('tor-status');
const torToggleButton = document.getElementById('tor-toggle');
const publicIpEl = document.getElementById('public-ip');
const publicIpDetailsEl = document.getElementById('public-ip-details');
const PUBLIC_IP_ENDPOINT = 'https://ipwho.is/?fields=success,message,ip,city,country,country_code,connection.isp,timezone.id,timezone.utc';
let ipRequest;
let lastPublicIp;
function validPublicIp(value) {
  const ip = String(value || '').trim();
  const ipv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) &&
    ip.split('.').every(part => Number(part) <= 255);
  let ipv6 = false;
  if (ip.includes(':') && ip.length <= 45 && /^[0-9a-fA-F:.]+$/.test(ip)) {
    try { ipv6 = new URL(`http://[${ip}]/`).hostname.length > 2; } catch (_) { /* invalid IPv6 */ }
  }
  if (!ipv4 && !ipv6) {
    throw new Error('Risposta IP non valida.');
  }
  return ip;
}
async function refreshPublicIp() {
  if (document.hidden) return;
  if (ipRequest) ipRequest.abort();
  const controller = new AbortController();
  ipRequest = controller;
  publicIpEl.textContent = lastPublicIp ? `IP pubblico (ultimo controllo): ${lastPublicIp.ip}` : 'IP pubblico: verifica…';
  publicIpDetailsEl.textContent = lastPublicIp ? `${lastPublicIp.details} · aggiornamento in corso…` : '';
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(PUBLIC_IP_ENDPOINT, {
      signal: controller.signal, cache: 'no-store', credentials: 'omit'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data?.success !== true) throw new Error('Il servizio IP non ha restituito dati validi.');
    const ip = validPublicIp(data.ip);
    const city = typeof data.city === 'string' ? data.city.slice(0, 80) : '';
    const country = typeof data.country === 'string' ? data.country.slice(0, 80) : '';
    const isp = typeof data.connection?.isp === 'string' ? data.connection.isp.slice(0, 100) : '';
    const timezone = typeof data.timezone?.id === 'string' ? data.timezone.id.slice(0, 80) : '';
    const location = [city, country].filter(Boolean).join(', ');
    if (ipRequest === controller) {
      lastPublicIp = { ip, details: [location, isp, timezone].filter(Boolean).join(' · ') };
      publicIpEl.textContent = `IP pubblico: ${ip}`;
      publicIpDetailsEl.textContent = lastPublicIp.details;
    }
  } catch (error) {
    if (ipRequest === controller) {
      publicIpEl.textContent = lastPublicIp
        ? `IP pubblico (ultimo controllo): ${lastPublicIp.ip}`
        : 'IP pubblico: non disponibile';
      publicIpDetailsEl.textContent = lastPublicIp
        ? `${lastPublicIp.details} · aggiornamento non riuscito`
        : 'Riprovo automaticamente.';
    }
  } finally {
    clearTimeout(timeout);
    if (ipRequest === controller) ipRequest = null;
  }
}
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
  torToggleButton.setAttribute('aria-label', confirmed ? 'Tor attivo e verificato' : 'Tor disattivato o non verificato');
  torToggleButton.classList.toggle('tor-on', confirmed);
  torToggleButton.classList.toggle('tor-off', !confirmed);
  torToggleButton.setAttribute('aria-pressed', String(confirmed));
  torStatusEl.hidden = !tor?.active || confirmed;
  torStatusEl.textContent = tor?.active && !confirmed
    ? 'Verifica Tor non riuscita. Il proxy resta attivo; FILUM riprova automaticamente.' : '';
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
  } finally { torToggleButton.disabled = false; refreshPublicIp(); }
});
let refreshingTor = false;
async function refreshTor() {
  if (refreshingTor || torToggleButton.disabled || document.hidden) return;
  refreshingTor = true;
  torToggleButton.disabled = true;
  torToggleButton.setAttribute('aria-label', 'Verifica Tor in corso');
  torToggleButton.classList.remove('tor-on');
  torToggleButton.classList.add('tor-off');
  torToggleButton.setAttribute('aria-pressed', 'false');
  try { render(await command('tor-refresh')); }
  catch (error) { torStatusEl.hidden = false; torStatusEl.textContent = `Verifica Tor: ${error.message}`; }
  finally { refreshingTor = false; torToggleButton.disabled = false; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshTor(); refreshPublicIp(); } });
setInterval(refreshTor, 30000);
setInterval(refreshPublicIp, 120000);
refreshTor();
refreshPublicIp();
