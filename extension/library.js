const content = document.getElementById('content');
const tabs = [...document.querySelectorAll('[data-tab]')];
const filterInput = document.getElementById('filter');
const clearButton = document.getElementById('clear-current');

let currentTab = 'history';
let renderToken = 0;

function setActive(name) {
  currentTab = name;
  for (const tab of tabs) tab.classList.toggle('active', tab.dataset.tab === name);
  clearButton.disabled = name === 'bookmarks';
  clearButton.title = name === 'bookmarks'
    ? 'I preferiti si eliminano singolarmente per evitare cancellazioni accidentali.'
    : '';
}

function matchesFilter(...values) {
  const query = filterInput.value.trim().toLocaleLowerCase();
  if (!query) return true;
  return values
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase().includes(query));
}

function actionButton(label, action) {
  const button = document.createElement('button');
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

function row(titleText, metaText, url, actions = []) {
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

  if (actions.length) {
    const box = document.createElement('div');
    box.className = 'row-actions';
    for (const action of actions) box.appendChild(action);
    item.appendChild(box);
  }

  return item;
}

async function showHistory() {
  const token = ++renderToken;
  setActive('history');
  content.textContent = 'Caricamento…';

  const query = filterInput.value.trim();
  const items = await browser.history.search({
    text: query,
    startTime: 0,
    maxResults: 500
  });

  if (token !== renderToken) return;
  content.textContent = '';

  const visible = items.filter((item) =>
    matchesFilter(item.title, item.url)
  );

  if (!visible.length) {
    content.innerHTML = '<div class="empty">Nessun elemento nella cronologia.</div>';
    return;
  }

  for (const item of visible) {
    const when = item.lastVisitTime
      ? new Date(item.lastVisitTime).toLocaleString()
      : '';

    content.appendChild(row(
      item.title || item.url,
      when,
      item.url,
      [
        actionButton('Rimuovi', async () => {
          await browser.history.deleteUrl({ url: item.url });
          await showHistory();
        })
      ]
    ));
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
  const token = ++renderToken;
  setActive('bookmarks');
  content.textContent = 'Caricamento…';

  const tree = await browser.bookmarks.getTree();
  if (token !== renderToken) return;

  const items = flattenBookmarks(tree)
    .filter((item) => matchesFilter(item.title, item.url))
    .slice(0, 1000);

  content.textContent = '';

  if (!items.length) {
    content.innerHTML = '<div class="empty">Nessun preferito trovato.</div>';
    return;
  }

  for (const item of items) {
    content.appendChild(row(
      item.title || item.url,
      item.url,
      item.url,
      [
        actionButton('Rimuovi', async () => {
          await browser.bookmarks.remove(item.id);
          await showBookmarks();
        })
      ]
    ));
  }
}

async function showDownloads() {
  const token = ++renderToken;
  setActive('downloads');
  content.textContent = 'Caricamento…';

  const items = await browser.downloads.search({
    limit: 500,
    orderBy: ['-startTime']
  });

  if (token !== renderToken) return;

  const visible = items.filter((item) =>
    matchesFilter(item.filename, item.url, item.finalUrl, item.state)
  );

  content.textContent = '';

  if (!visible.length) {
    content.innerHTML = '<div class="empty">Nessun download trovato.</div>';
    return;
  }

  for (const item of visible) {
    const meta = [
      item.state,
      item.filename,
      item.startTime ? new Date(item.startTime).toLocaleString() : ''
    ].filter(Boolean).join(' · ');

    const actions = [];

    if (item.state === 'complete') {
      actions.push(actionButton('Apri', async () => {
        try { await browser.downloads.open(item.id); } catch (_) {}
      }));
      actions.push(actionButton('Cartella', async () => {
        try { await browser.downloads.show(item.id); } catch (_) {}
      }));
    }

    actions.push(actionButton('Dimentica', async () => {
      await browser.downloads.erase({ id: item.id });
      await showDownloads();
    }));

    content.appendChild(row(
      item.url || item.filename,
      meta,
      item.url,
      actions
    ));
  }
}

async function renderCurrent() {
  if (currentTab === 'history') return showHistory();
  if (currentTab === 'bookmarks') return showBookmarks();
  return showDownloads();
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    filterInput.value = '';
    currentTab = tab.dataset.tab;
    renderCurrent();
  });
}

let filterTimer = null;
filterInput.addEventListener('input', () => {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(renderCurrent, 160);
});

clearButton.addEventListener('click', async () => {
  if (currentTab === 'history') {
    const ok = confirm('Cancellare tutta la cronologia?');
    if (!ok) return;
    await browser.history.deleteAll();
    await showHistory();
    return;
  }

  if (currentTab === 'downloads') {
    const ok = confirm('Rimuovere l’elenco dei download? I file scaricati non verranno cancellati.');
    if (!ok) return;
    await browser.downloads.erase({});
    await showDownloads();
  }
});

showHistory();
