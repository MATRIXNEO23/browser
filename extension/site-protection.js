'use strict';

const query = new URLSearchParams(location.search);
const origin = query.get('origin');
const tabId = Number(query.get('tabId'));
const windowId = Number(query.get('windowId'));
const labels = { normal: 'Normale', protected: 'Protetto', strong: 'Forte', maximum: 'Massimo' };
const featureNames = {
  javascript: 'JavaScript', canvas: 'Canvas / RFP', webgl: 'WebGL',
  webrtc: 'WebRTC', tracking: 'Tracciamento', cookies: 'Cookie'
};
let state = null;
let selected = null;

function say(text, error = false) {
  const element = document.getElementById('message');
  element.textContent = text;
  element.dataset.error = String(error);
}

function render(status) {
  state = status;
  document.getElementById('origin').textContent = status.available
    ? `${status.host} · ${status.origin}` : status.reason;
  const level = labels[status.effectiveLevel] || status.effectiveLevel;
  const globalLevel = labels[status.globalLevel] || status.globalLevel;
  const warning = status.torCanvasConflict ? ' · ATTENZIONE: permesso Canvas in conflitto con Tor' : '';
  document.getElementById('summary').textContent =
    `Effettivo: ${level} · globale: ${globalLevel}` +
    `${status.overrideScope ? ` · override sito ${status.overrideScope}` : ''}` +
    `${status.torEnabled ? ' · Tor' : ''}${warning}`;
  document.getElementById('global').textContent = status.manualGlobalLevel
    ? 'Il livello globale resta invariato.'
    : `Livello globale della modalità ${status.mode}.`;

  selected = status.siteOverride?.level || selected || status.globalLevel;
  for (const button of document.querySelectorAll('[data-level]')) {
    button.setAttribute('aria-pressed', String(button.dataset.level === selected));
    button.disabled = !status.available;
  }

  const scope = document.getElementById('scope');
  scope.value = status.overrideScope || 'session';
  scope.disabled = !!status.overrideScope || !status.sessionAvailable;
  if (!status.sessionAvailable) scope.querySelector('[value="session"]').disabled = true;
  document.getElementById('apply').disabled = !status.available;
  document.getElementById('restore').disabled = !status.overrideScope;
  document.getElementById('canvas-section').hidden = !(
    status.available && !status.torEnabled &&
    status.features.canvas.globalEffective === 'protected' &&
    status.overrideScope !== 'persistent' && status.sessionAvailable &&
    status.nativePermissions.canvas.action !== 'allow'
  );

  const body = document.getElementById('features');
  body.replaceChildren();
  for (const [key, item] of Object.entries(status.features || {})) {
    const row = document.createElement('tr');
    for (const value of [featureNames[key] || key, item.requested, item.source,
      item.effective, item.verified]) {
      const cell = document.createElement('td');
      cell.textContent = String(value ?? '—');
      row.append(cell);
    }
    body.append(row);
  }
}

async function refresh() {
  const status = await browser.runtime.sendMessage({
    type: 'get-site-protection', origin, tabId, windowId
  });
  render(status);
}

async function apply(request, scope = document.getElementById('scope').value) {
  try {
    const status = await browser.runtime.sendMessage({
      type: 'set-site-override', origin, tabId, windowId,
      request: { ...request, scope }
    });
    render(status);
    say('Stato applicato; valori riletti da Gecko.');
  } catch (error) {
    say(error.message || String(error), true);
    await refresh();
  }
}

for (const button of document.querySelectorAll('[data-level]')) {
  button.addEventListener('click', () => {
    selected = button.dataset.level;
    for (const item of document.querySelectorAll('[data-level]')) {
      item.setAttribute('aria-pressed', String(item === button));
    }
  });
}

document.getElementById('apply').addEventListener('click', () => {
  void apply({ level: selected || state?.globalLevel });
});
document.getElementById('canvas').addEventListener('click', () => {
  void apply({ operation: 'canvas-exception' }, 'session');
});
document.getElementById('restore').addEventListener('click', async () => {
  try {
    await browser.runtime.sendMessage({ type: 'remove-site-override', origin, scope: 'all' });
    selected = null;
    await refresh();
    say('Override rimosso; il sito segue il livello globale.');
  } catch (error) {
    say(error.message || String(error), true);
  }
});
document.getElementById('manage').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'open-site-overrides' });
  window.close();
});

refresh().catch(error => say(error.message || String(error), true));
