# Controllo IP VPN.crx — analisi statica e sostituzione in FILUM

File ricevuto: `Controllo IP VPN.crx`, SHA-256 `1ce50ea41fa430ccbe451686e3dedee73ed44ca768d27b948a7359a87d9030bc`, CRX3, Manifest V3, versione 7.2.3. Analizzati staticamente manifest, popup, worker e script collegati senza eseguirli.

## Comportamento del CRX

- `html/popup.js` esegue una chiamata jQuery a `http://ip-api.com/json/` e legge IP, città, paese, ISP, fuso, valuta e flag `mobile`, `proxy`, `hosting`.
- `html/stat.js` fa una richiesta HTTP a `stat.goodextensions.mooo.com`.
- `worker.js` apre una pagina promozionale all'installazione e imposta un URL promozionale alla disinstallazione.
- Il popup include Google Fonts, librerie jQuery/Bootstrap e collegamenti a PixelScan, IPx, IPLeak; le parti promozionali/statistiche non entrano in FILUM.

## Adattamento FILUM 0.6.6

Il lookup IP/geografico usa `https://ipwho.is/` con soli campi necessari: IP, città, paese, ISP e fuso orario. In `popup.js`, `refreshPublicIp` fa fetch HTTPS senza credenziali né cache, timeout di 10 secondi, convalida IP, aggiorna con `textContent` e non archivia risultati. Si attiva all'apertura, ogni 120 secondi quando il pannello è visibile e dopo un cambio Tor. `manifest.json` permette `https://ipwho.is/*` e rimuove l'host del precedente lookup.

La free API ip-api.com usata dal CRX è solo HTTP secondo la sua documentazione, quindi FILUM non la interroga. L'endpoint ipwho.is accetta HTTPS e documenta un limite gratuito di 1.000 richieste giornaliere; la documentazione indica che i dati di sicurezza VPN/proxy/Tor non sono inclusi nel piano gratuito. Per questo FILUM mostra IP/posizione/ISP/fuso, mentre l'uscita Tor viene verificata dal controllo Tor Project già implementato. Non dichiara una rilevazione VPN generica.

## Limiti

L'IP mostrato è quello visto da ipwho.is per la richiesta dell'estensione e non dimostra quale IP vede ogni sito nelle schede, né verifica DNS/WebRTC. Il servizio riceve la richiesta mentre il pannello resta aperto. Nessuna prova di rete reale su Chrome/Edge eseguita qui.