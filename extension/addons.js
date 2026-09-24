const list = document.getElementById('addons');

function button(label, action) {
  const el = document.createElement('button');
  el.textContent = label;
  el.addEventListener('click', action);
  return el;
}

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
  meta.textContent = [
    addon.type,
    addon.version ? 'v' + addon.version : '',
    addon.id
  ].filter(Boolean).join(' · ');

  info.append(title, meta);

  const actions = document.createElement('div');
  actions.className = 'actions';

  if (addon.homepageUrl) {
    actions.appendChild(button('Pagina', () => {
      browser.tabs.create({ url: addon.homepageUrl });
    }));
  }

  if (addon.id !== selfId) {
    if (addon.mayDisable !== false) {
      actions.appendChild(button(addon.enabled ? 'Disattiva' : 'Attiva', async () => {
        try {
          await browser.management.setEnabled(addon.id, !addon.enabled);
          await render();
        } catch (_) {}
      }));
    }

    actions.appendChild(button('Rimuovi', async () => {
      try {
        await browser.management.uninstall(addon.id, { showConfirmDialog: true });
        await render();
      } catch (_) {
        // User cancellation or protected addon.
      }
    }));
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
    .sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

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
