const clockEl = document.querySelector('.clock');
const dateEl = document.querySelector('.date');
const modeEl = document.querySelector('.mode-label');

function updateClock() {
  const now = new Date();
  clockEl.textContent = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(now);
  dateEl.textContent = new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  }).format(now);
}

async function updateMode() {
  try {
    const data = await browser.storage.local.get('mode');
    modeEl.textContent = data.mode || 'NORMAL';
    document.body.dataset.mode = data.mode || 'NORMAL';
  } catch (_) {
    modeEl.textContent = 'NORMAL';
  }
}

document.getElementById('normal-search').addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = document.getElementById('q').value.trim();
  if (!query) return;
  await browser.search.search({ query });
});

document.getElementById('smart').addEventListener('click', () => {
  location.href = browser.runtime.getURL('smart-search.html');
});

document.getElementById('library').addEventListener('click', () => {
  location.href = browser.runtime.getURL('library.html');
});

document.getElementById('addons').addEventListener('click', () => {
  location.href = browser.runtime.getURL('addons.html');
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.mode) updateMode();
});

updateClock();
updateMode();
setInterval(updateClock, 30000);
