const clock = document.getElementById('clock');
function tick() { clock.textContent = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()); }
async function refresh() {
  const { mode } = await chrome.storage.local.get({ mode: 'NORMAL' });
  document.getElementById('mode').textContent = mode;
  document.body.dataset.mode = mode;
}
document.getElementById('search').addEventListener('submit', async event => {
  event.preventDefault();
  const text = document.getElementById('query').value.trim();
  if (text) await chrome.search.query({ text, disposition: 'CURRENT_TAB' });
});
for (const [id, url] of [['bookmarks', 'chrome://bookmarks/'], ['history', 'chrome://history/'], ['addons', 'chrome://extensions/']]) {
  document.getElementById(id).addEventListener('click', () => chrome.tabs.update({ url }));
}
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.mode) refresh(); });
tick(); refresh(); setInterval(tick, 30000);
