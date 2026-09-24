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
