const list = document.getElementById('addons');

function makeAddonRow(addon, selfId) {
  const row = document.createElement('article');
  row.className = 'addon';

  const info = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = addon.name || addon.id;

  const state = document.createElement('span');
  state.className = 'badge';
  state.textContent = addon.enabled ? 'attivo' : 'disattivato';
  title.appendChild(state);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = [addon.type, addon.version ? 'v' + addon.version : '', addon.id]
    .filter(Boolean)
    .join(' · ');

  info.append(title, meta);

  const actions = document.createElement('div');
  actions.className = 'actions';

  if (addon.homepageUrl) {
    const home = document.createElement('button');
    home.textContent = 'Pagina';
    home.addEventListener('click', () => browser.tabs.create({ url: addon.homepageUrl }));
    actions.appendChild(home);
  }

  if (addon.id !== selfId) {
    const remove = document.createElement('button');
    remove.textContent = 'Rimuovi';
    remove.addEventListener('click', async () => {
      try {
        await browser.management.uninstall(addon.id, { showConfirmDialog: true });
        await render();
      } catch (_) {
        // User cancellation or protected addon.
      }
    });
    actions.appendChild(remove);
  }

  row.append(info, actions);
  return row;
}

async function render() {
  const [addons, self] = await Promise.all([
    browser.management.getAll(),
    browser.management.getSelf()
  ]);

  list.textContent = '';
  const visible = addons
    .filter((addon) => addon.type === 'extension' || addon.type === 'theme')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (!visible.length) {
    list.textContent = 'Nessun addon trovato.';
    return;
  }

  for (const addon of visible) {
    list.appendChild(makeAddonRow(addon, self.id));
  }
}

document.getElementById('store').addEventListener('click', () => {
  browser.tabs.create({ url: 'https://addons.mozilla.org/firefox/extensions/' });
});

render();
