const list = document.getElementById('addons');
const status = document.getElementById('addons-status');

function showError(error) {
  status.textContent = 'Addon: ' + (error?.message || error);
}

function button(label, action) {
  const el = document.createElement('button');
  el.textContent = label;
  el.addEventListener('click', async () => {
    el.disabled = true;
    try {
      await action();
    } finally {
      if (el.isConnected) el.disabled = false;
    }
  });
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
      browser.tabs.create({ url: addon.homepageUrl }).catch(showError);
    }));
  }

  if (addon.id !== selfId) {
    if (addon.mayDisable !== false) {
      actions.appendChild(button(addon.enabled ? 'Disattiva' : 'Attiva', async () => {
        try {
          const requested = !addon.enabled;
          const result = await browser.browserControl.setAddonEnabled(addon.id, requested);
          if (result?.enabled !== requested) {
            throw new Error('Stato addon non confermato dal browser.');
          }
          await render();
        } catch (error) { showError(error); }
      }));
    }

    actions.appendChild(button('Rimuovi', async () => {
      try {
        const confirmed = window.confirm(`Rimuovere definitivamente “${addon.name || addon.id}”?`);
        if (!confirmed) return;
        const result = await browser.browserControl.uninstallAddon(addon.id);
        if (result?.installed !== false) {
          throw new Error('Rimozione addon non confermata dal browser.');
        }
        await render();
      } catch (error) { showError(error); }
    }));
  }

  row.append(info, actions);
  return row;
}

async function render() {
  status.textContent = '';
  const [addons, self] = await Promise.all([
    browser.management.getAll(),
    browser.management.getSelf()
  ]);

  list.textContent = '';

  const visible = addons
    .filter((addon) => addon.id !== self.id)
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
  browser.tabs.create({ url: 'https://addons.mozilla.org/firefox/extensions/' }).catch(showError);
});

render().catch(showError);

for (const event of [
  browser.management.onInstalled,
  browser.management.onUninstalled,
  browser.management.onEnabled,
  browser.management.onDisabled
]) {
  event?.addListener(() => render().catch(showError));
}
