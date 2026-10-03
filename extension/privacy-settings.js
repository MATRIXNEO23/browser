const LABELS = Object.freeze({
  normal: 'Normale', protected: 'Protetto', strong: 'Forte', maximum: 'Massimo',
  full: 'Completo', blocked: 'Bloccato', standard: 'Standard', protectedCanvas: 'Protetto',
  limited: 'Limitato (WebGL 2 disattivato)', allow: 'Consenti', protect: 'Protetto',
  baseline: 'Baseline', strict: 'Sempre attiva', partitioned: 'Partizionati',
  'third-party-blocked': 'Blocca terze parti'
});
const FEATURE_OPTIONS = Object.freeze({
  javascript: ['full', 'blocked'],
  canvas: ['standard', 'protected'],
  webgl: ['normal', 'limited', 'blocked'],
  webrtc: ['allow', 'protect', 'blocked'],
  tracking: ['baseline', 'strict'],
  cookies: ['partitioned', 'third-party-blocked']
});
const statusEl = document.getElementById('status');
const verificationEl = document.getElementById('verification');
const modeEl = document.getElementById('mode');
let currentStatus = null;

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.dataset.error = String(error);
}

function label(value) {
  return LABELS[value] || value;
}

function render(status) {
  currentStatus = status;
  modeEl.textContent = `Modalità ${status.mode}${status.torEnabled ? ' · Tor attivo' : ''}`;
  for (const button of document.querySelectorAll('[data-level]')) {
    button.setAttribute('aria-pressed', String(button.dataset.level === status.level));
  }
  document.getElementById('level-source').textContent = status.manualLevel
    ? 'Livello selezionato manualmente.'
    : `Livello iniziale derivato dalla modalità ${status.mode}; puoi cambiarlo qui.`;

  for (const [feature, options] of Object.entries(FEATURE_OPTIONS)) {
    const row = document.querySelector(`[data-feature="${feature}"]`);
    const select = row.querySelector('select');
    select.replaceChildren();
    const profileOption = document.createElement('option');
    profileOption.value = 'preset';
    profileOption.textContent = `Segui profilo (${label(status.features[feature].preset)})`;
    select.append(profileOption);
    for (const value of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label(feature === 'canvas' && value === 'protected' ? 'protectedCanvas' : value);
      select.append(option);
    }
    const policy = status.features[feature];
    select.value = policy.manual || 'preset';
    row.dataset.state = policy.verified || 'PARTIAL';
    let note = row.querySelector('.effective');
    if (!note) {
      note = document.createElement('small');
      note.className = 'effective';
      row.firstElementChild.append(note);
    }
    const verification = policy.verified || 'PARTIAL';
    note.textContent = `Effettivo: ${label(policy.effective)} · ${verification}`;
    note.className = `effective ${verification === 'PASS' ? 'pass' : verification === 'FAIL' ? 'fail' : 'partial'}`;
    select.disabled = false;
  }

  verificationEl.replaceChildren();
  const names = {
    javascript: 'JavaScript', canvas: 'Canvas / RFP', webgl: 'WebGL', webrtc: 'WebRTC',
    tracking: 'Tracciamento', cookies: 'Cookie'
  };
  for (const [feature, item] of Object.entries(status.features)) {
    const name = document.createElement('span');
    name.textContent = names[feature];
    const state = document.createElement('span');
    state.textContent = item.verified || 'PARTIAL';
    state.className = item.verified === 'PASS' ? 'pass' : item.verified === 'FAIL' ? 'fail' : 'partial';
    const actual = document.createElement('span');
    actual.className = 'actual muted';
    actual.textContent = item.actual ? `Lettura: ${label(item.actual)}` : 'Non verificato';
    verificationEl.append(name, state, actual);
  }
  setStatus('Impostazioni caricate. Le selezioni vengono applicate subito.');
  void browser.runtime.sendMessage({
    type: 'privacy-settings-ready',
    levels: document.querySelectorAll('[data-level]').length,
    controls: document.querySelectorAll('[data-feature] select').length,
    features: Object.keys(status.features)
  }).catch(() => {});
}

async function load() {
  const status = await browser.runtime.sendMessage({ type: 'get-privacy-policy' });
  render(status);
}

async function update(change) {
  setStatus('Applicazione e verifica…');
  document.querySelectorAll('button, select').forEach(control => { control.disabled = true; });
  try {
    const result = await browser.runtime.sendMessage({ type: 'set-privacy-policy', change });
    render(result.status);
    setStatus('Impostazione applicata e lettura verificata.');
  } catch (error) {
    await load().catch(() => {});
    setStatus(error?.message || String(error), true);
  } finally {
    document.querySelectorAll('button, select').forEach(control => { control.disabled = false; });
  }
}

for (const button of document.querySelectorAll('[data-level]')) {
  button.addEventListener('click', () => update({ type: 'set-level', level: button.dataset.level }));
}

for (const row of document.querySelectorAll('[data-feature]')) {
  row.querySelector('select').addEventListener('change', event => update({
    type: 'set-feature', feature: row.dataset.feature, value: event.target.value
  }));
}

load().catch(error => setStatus(error?.message || String(error), true));
