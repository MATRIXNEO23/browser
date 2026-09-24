const content = document.getElementById('content');
const tabs = [...document.querySelectorAll('[data-tab]')];

function setActive(name) {
  for (const tab of tabs) tab.classList.toggle('active', tab.dataset.tab === name);
}

function row(titleText, metaText, url, actionLabel, action) {
  const item = document.createElement('article');
  item.className = 'item';

  const left = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'title';

  if (url) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = titleText || url;
    title.appendChild(link);
  } else {
    title.textContent = titleText;
  }

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = metaText || '';

  left.append(title, meta);
  item.appendChild(left);

  if (actionLabel && action) {
    const button = document.createElement('button');
    button.textContent = actionLabel;
    button.addEventListener('click', action);
    item.appendChild(button);
  }

  return item;
}

async function showHistory() {
  setActive('history');
  content.textContent = 'Caricamento…';

  const items = await browser.history.search({
    text: '',
    startTime: Date.now() - 1000 * 60 * 60 * 24 * 30,
    maxResults: 200
  });

  content.textContent = '';
  if (!items.length) {
    content.innerHTML = '<div class="empty">Cronologia vuota.</div>';
    return;
  }

  for (const item of items) {
    const when = item.lastVisitTime ? new Date(item.lastVisitTime).toLocaleString() : '';
    content.appendChild(row(item.title || item.url, when, item.url, 'Rimuovi', async () => {
      await browser.history.deleteUrl({ url: item.url });
      await showHistory();
    }));
  }
}

function flattenBookmarks(nodes, out = []) {
  for (const node of nodes || []) {
    if (node.url) out.push(node);
    if (node.children) flattenBookmarks(node.children, out);
  }
  return out;
}

async function showBookmarks() {
  setActive('bookmarks');
  content.textContent = 'Caricamento…';

  const tree = await browser.bookmarks.getTree();
  const items = flattenBookmarks(tree).slice(0, 300);

  content.textContent = '';
  if (!items.length) {
    content.innerHTML = '<div class="empty">Nessun preferito.</div>';
    return;
  }

  for (const item of items) {
    content.appendChild(row(item.title || item.url, item.url, item.url, 'Rimuovi', async () => {
      await browser.bookmarks.remove(item.id);
      await showBookmarks();
    }));
  }
}

async function showDownloads() {
  setActive('downloads');
  content.textContent = 'Caricamento…';

  const items = await browser.downloads.search({
    limit: 200,
    orderBy: ['-startTime']
  });

  content.textContent = '';
  if (!items.length) {
    content.innerHTML = '<div class="empty">Nessun download.</div>';
    return;
  }

  for (const item of items) {
    const meta = [item.state, item.filename, item.startTime ? new Date(item.startTime).toLocaleString() : '']
      .filter(Boolean)
      .join(' · ');

    content.appendChild(row(item.url || item.filename, meta, item.url));
  }
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab === 'history') showHistory();
    if (tab.dataset.tab === 'bookmarks') showBookmarks();
    if (tab.dataset.tab === 'downloads') showDownloads();
  });
}

showHistory();
