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
}

async function act(type, fields) {
  statusEl.textContent = 'Applicazione…';
  try { render(await command(type, fields)); }
  catch (error) { statusEl.textContent = `Errore: ${error.message}`; }
}

modeButtons.forEach(button => button.addEventListener('click', () => act('mode', { mode: button.dataset.mode })));
adsButton.addEventListener('click', () => { if (current) act('ads', { enabled: !current.adsEnabled }); });
document.getElementById('enforce').addEventListener('click', () => act('enforce'));
act('status');
