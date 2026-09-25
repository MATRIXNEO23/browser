const modeEl = document.getElementById('mode');
const torEl = document.getElementById('tor');
const featuresEl = document.getElementById('features');
const checkedEl = document.getElementById('checked');
const refreshButton = document.getElementById('refresh');
const copyButton = document.getElementById('copy');
let report = '';

function formatReport() {
  const blocks = [
    ['Modalità', modeEl], ['Altre funzioni', featuresEl], ['Rete Tor', torEl]
  ];
  return ['FILUM · Diagnostica', `Data: ${new Date().toISOString()}`,
    `Esito: ${checkedEl.textContent}`,
    ...blocks.flatMap(([title, container]) => [
      '', `[${title}]`,
      ...[...container.querySelectorAll('.row')].map(item =>
        `${item.querySelector('span').textContent}: ${item.querySelector('strong').textContent}`)
    ])].join('\n');
}

async function copyReport() {
  if (!report) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(report);
    } else {
      const field = document.createElement('textarea');
      field.value = report;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.append(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      if (!copied) throw new Error('Clipboard non disponibile');
    }
    copyButton.textContent = 'Diagnostica copiata';
  } catch (error) {
    copyButton.textContent = 'Copia non riuscita';
    checkedEl.textContent = `Copia non riuscita: ${error?.message || String(error)}`;
  }
}

function row(container, label, value, verdict = '') {
  const item = document.createElement('div');
  item.className = 'row';
  const name = document.createElement('span');
  name.textContent = label;
  const result = document.createElement('strong');
  result.className = verdict;
  result.textContent = String(value);
  item.append(name, result);
  container.append(item);
}

async function readPrivacy(setting) {
  try { return (await setting.get({})).value; }
  catch (_) { return undefined; }
}

async function verify() {
  refreshButton.disabled = true;
  copyButton.disabled = true;
  copyButton.textContent = 'Copia diagnostica';
  report = '';
  checkedEl.textContent = 'Lettura dello stato reale…';
  modeEl.replaceChildren();
  featuresEl.replaceChildren();
  torEl.replaceChildren();
  try {
    const [status, prefs, proxy, settings, fingerprinting, tracking, cookies, webRtc, referrers] = await Promise.all([
      browser.runtime.sendMessage({ type: 'get-status' }),
      browser.runtime.sendMessage({ type: 'get-mode-diagnostics' }),
      browser.proxy.settings.get({}),
      browser.runtime.sendMessage({ type: 'get-advanced-settings' }),
      readPrivacy(browser.privacy.websites.resistFingerprinting),
      readPrivacy(browser.privacy.websites.trackingProtectionMode),
      readPrivacy(browser.privacy.websites.cookieConfig),
      readPrivacy(browser.privacy.network.peerConnectionEnabled),
      readPrivacy(browser.privacy.websites.referrersEnabled)
    ]);
    const mode = status.mode;
    const privateMode = mode === 'PRIVATE' || mode === 'GHOST';
    const expectedAutoplay = mode === 'TURBO' || mode === 'GHOST' ? 5 : 1;
    const check = (label, actual, expected) => row(modeEl, label,
      actual === undefined ? 'Non leggibile' : `${String(actual)} · atteso ${String(expected)}`,
      actual === undefined ? 'unknown' : actual === expected ? 'pass' : 'fail');
    row(modeEl, 'Modalità selezionata', mode);
    row(modeEl, 'HTTPS-only (controllo indipendente)',
      `${String(prefs.httpsOnly)} · base modalità ${String(privateMode)}`);
    check('Resistenza fingerprint (preferenza)', prefs.fingerprintResistance, privateMode);
    check('Cookie senza archiviazione persistente (preferenza)',
      prefs.cookieNoPersistentStorage, mode === 'GHOST');
    check('Autoplay (preferenza)', prefs.autoplay, expectedAutoplay);
    check('Prefetch disabilitato', prefs.prefetch, false);
    check('DNS prefetch disabilitato', prefs.dnsPrefetch, true);
    check('Resistenza fingerprint (API privacy)', fingerprinting, privateMode);
    check('Protezione tracciamento', tracking, 'always');
    check('WebRTC abilitato', webRtc, mode !== 'GHOST' && !status.torEnabled);
    check('Referrer abilitati', referrers, mode !== 'GHOST');
    row(modeEl, 'Schede background attive / limite',
      `${status.status?.activeBackground ?? '—'} / ${status.status?.limit ?? '—'}`);
    row(modeEl, 'TURBO: scarica schede inattive dopo',
      status.status?.turboIdleDiscardMs ? `${status.status.turboIdleDiscardMs / 1000} s` : 'Non applicabile');

    row(featuresEl, 'ADS', status.adsEnabled === null ? 'Non verificabile' :
      status.adsEnabled ? 'Attivo' : 'Disattivo', status.adsEnabled === null ? 'fail' : 'pass');
    row(featuresEl, 'DNS sicuro', settings.secureDns || 'Non leggibile');
    row(featuresEl, 'Endpoint DNS', settings.secureDnsUri || 'Predefinito / sistema');
    row(featuresEl, 'HTTPS-only effettivo', String(settings.httpsOnly));
    row(featuresEl, 'Modalità applicata', status.modeHealth?.ok ? 'Confermata' : 'Incompleta',
      status.modeHealth?.ok ? 'pass' : 'fail');
    if (status.modeHealth?.issues?.length) {
      row(featuresEl, 'Differenze modalità', status.modeHealth.issues.join(' · '), 'fail');
    }
    row(featuresEl, 'GHOST: sessione riavviata dopo errore',
      status.ghostSessionRestartedAt ? 'Sì' : 'No', status.ghostSessionRestartedAt ? 'fail' : 'pass');

    const tor = status.torProcess || {};
    row(torEl, 'Processo Tor', tor.running ? 'In esecuzione' : 'Fermo', tor.running ? 'pass' : 'unknown');
    row(torEl, 'Bootstrap', tor.bootstrapped ? '100%' : 'Non completato', tor.bootstrapped ? 'pass' : 'unknown');
    row(torEl, 'Fase', tor.stage || '—');
    const proxyValue = proxy?.value || {};
    row(torEl, 'Proxy browser', JSON.stringify({
      proxyType: proxyValue.proxyType, socks: proxyValue.socks,
      socksVersion: proxyValue.socksVersion, proxyDNS: proxyValue.proxyDNS
    }));
    row(torEl, 'DoH browser', settings.secureDns || 'non leggibile');
    row(torEl, 'WebRTC', webRtc === undefined ? 'Non leggibile' : webRtc ? 'Abilitato' : 'Disabilitato');
    row(torEl, 'Proxy/DNS/WebRTC Tor confermati', status.torRouted ? 'Sì' : 'No',
      status.torRouted ? 'pass' : status.torEnabled ? 'fail' : 'unknown');
    if (tor.error) row(torEl, 'Ultimo errore', tor.error, 'fail');
    if (tor.exitCode !== null && tor.exitCode !== undefined) row(torEl, 'Ultimo exit code', tor.exitCode);
    if (tor.lastLog) row(torEl, 'Ultime righe Tor', tor.lastLog);
    checkedEl.textContent = `Letto alle ${new Date().toLocaleTimeString('it-IT')}. Le voci rosse differiscono dalla modalità selezionata.`;
    report = formatReport();
  } catch (error) {
    checkedEl.textContent = 'Diagnostica non disponibile: ' + (error?.message || String(error));
    report = formatReport();
  } finally {
    refreshButton.disabled = false;
    copyButton.disabled = false;
  }
}

refreshButton.addEventListener('click', verify);
copyButton.addEventListener('click', copyReport);
verify();
