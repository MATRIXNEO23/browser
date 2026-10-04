'use strict';

const list = document.getElementById('list');
const search = document.getElementById('search');
const summary = document.getElementById('summary');
const message = document.getElementById('message');
const labels = { normal: 'Normale', protected: 'Protetto', strong: 'Forte', maximum: 'Massimo' };
let data = { records: [], globalLevel: 'normal' };

function render() {
  const filter = search.value.trim().toLowerCase();
  const rows = data.records.filter(item => item.origin.toLowerCase().includes(filter));
  list.replaceChildren();
  summary.textContent = `Globale: ${labels[data.globalLevel] || data.globalLevel} · ${rows.length} origini`;

  for (const item of rows) {
    for (const [scope, record] of [['session', item.session], ['persistent', item.persistent]]) {
      if (!record) continue;
      const card = document.createElement('article');
      card.className = 'entry';
      const origin = document.createElement('div');
      origin.className = 'origin';
      origin.textContent = item.origin;
      const level = document.createElement('p');
      level.textContent = `Globale: ${labels[data.globalLevel] || data.globalLevel} · Sito: ${labels[record.level] || 'eccezione Canvas'}`;
      const duration = document.createElement('p');
      duration.className = 'scope';
      duration.textContent = scope === 'session'
        ? 'Temporaneo · sessione browser' : 'Persistente · profilo FILUM';
      const remove = document.createElement('button');
      remove.textContent = 'Rimuovi';
      remove.addEventListener('click', () => void removeOne(item.origin, scope));
      card.append(origin, level, duration, remove);
      list.append(card);
    }
  }

  if (!rows.length) list.textContent = 'Nessun override trovato.';
}

async function load() {
  data = await browser.runtime.sendMessage({ type: 'get-site-overrides' });
  render();
}

async function removeOne(origin, scope) {
  try {
    await browser.runtime.sendMessage({ type: 'remove-site-override', origin, scope });
    message.textContent = 'Override rimosso.';
    await load();
  } catch (error) {
    message.textContent = error.message || String(error);
  }
}

search.addEventListener('input', render);
document.getElementById('remove-all').addEventListener('click', async () => {
  try {
    const result = await browser.runtime.sendMessage({ type: 'remove-all-site-overrides' });
    await load();
    message.textContent = `Ripristinati ${result.removed} siti al livello globale.`;
  } catch (error) {
    message.textContent = error.message || String(error);
  }
});

load().catch(error => { message.textContent = error.message || String(error); });
