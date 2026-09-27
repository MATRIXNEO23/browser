# FILUM Chrome/Edge — mappa del codice e registro modifiche

Questa mappa è parte del checkpoint dell'estensione. **A ogni modifica funzionale dell'add-on, aggiornare nello stesso commit questa mappa e il registro in fondo**: file/funzione, comportamento, dipendenze, test e limiti. Il progetto rimane nella repository tecnica `MATRIXNEO23/browser`; non scrivere memorie GPTina per queste modifiche.

## Componenti FILUM

| File | Responsabilità | Interfacce / effetti |
| --- | --- | --- |
| `chromium-extension/manifest.json` | Identità MV3, host e permessi, service worker, home e pannello laterale | L'opzione proxy richiede `proxy`, `webRequest`, `webRequestAuthProvider`, `<all_urls>`, host del servizio GoodExtensions e del check Tor. L'avviso di permessi del browser è previsto. |
| `chromium-extension/worker.js`, `state` / `status` | Lettura NORMAL/TURBO, ADS, schede e stato proxy per la barra | `chrome.storage.local`, `declarativeNetRequest`, `tabs`, `proxy`, `storage.session`; il messaggio `status` non fa richieste esterne. |
| `worker.js`, `setMode` / `enforceTurbo` | Scarica schede non protette in TURBO e gestisce allarme | Non modifica il proxy. |
| `worker.js`, `setAds` | Abilita/disabilita `ads_basic` con readback | `rules/ads-basic.json` contiene le regole. |
| `worker.js`, `captureDuckResults` | Fallback Smart Search via scheda temporanea | Scheda DuckDuckGo chiusa a fine ricerca; non usa Tavily. |
| `worker.js`, `searchTavilyExplicit` | Ricerca a pagamento richiesta dall'utente con limiti locali | `api.tavily.com`; chiave e contatori in `chrome.storage.local`. |
| `chromium-extension/smart-search.js` / `smart-search.html` / `smart-search.css` | Parsing e ranking candidati, filtri, interfaccia Smart Search | Massimo 50 candidati disponibili, senza paginazione. |
| `chromium-extension/newtab.js` / `newtab.html` / `style.css` | Home locale, ricerca predefinita e link | Pagina disponibile offline. |
| `chromium-extension/popup.js` / `popup.html` / `style.css` | Barra laterale FILUM, pulsanti e stati leggibili | Comandi al worker via `chrome.runtime.sendMessage`. |
| `chromium-extension/test.cjs` | Test con API simulate su modalità, ADS, autenticazione proxy, conferma Tor e rilascio | Non prova servizio remoto, DNS/WebRTC o runtime Chrome/Edge. |
| `chrome-windows-theme/` | Tema facoltativo separato | Non fa parte dell'estensione funzionale. |

## Modulo Tor tramite servizio del CRX ricevuto

`Browser Tor.crx` v9.0.1, SHA-256 `e5c7eefd379776b0e994ee3882c3e597416a4b064500c82247decdda1f7a3330`, è stato analizzato staticamente in `docs/FILUM_CHROMIUM_BROWSER_TOR_CRX_AUDIT_2026-09-27.md`. FILUM **non copia file, librerie, pubblicità o script statistici** di terzi: implementa il protocollo osservato e dipende dal servizio remoto. Alberto riferisce che l'add-on originale ha raggiunto la rete Tor nel suo test; il nuovo codice FILUM non è stato ancora provato sul suo Windows.

| Codice originale osservato | Adattamento FILUM 0.6.0 | Limite o verifica |
| --- | --- | --- |
| `js/popup.js` richiede `torconfig.php?cid=...` | `worker.js`: `getTorClientId`, `limitedFetch`, `validateTorConfig`, `connectFilumTor` richiedono la configurazione solo dopo click e validano host/credenziali | Invia un ID casuale stabile al gestore; se il servizio cambia schema o non accetta FILUM, la connessione fallisce. Nessun contatto automatico all'avvio. |
| `js/functions.js` usa `chrome.proxy.settings.set` con PAC `HTTPS host:443` | `worker.js`: `connectFilumTor` applica lo stesso tipo di rotta HTTPS al profilo regolare, controlla `levelOfControl` e non aggiunge fallback `DIRECT` | Il proxy è gestito da GoodExtensions. In caso di errore di verifica FILUM prova a rilasciare subito il controllo. Non cambia il proxy di Windows. |
| `js/background.js` usa `onAuthRequired` | `worker.js`: listener `onAuthRequired` con `asyncBlocking`, limitato alle sfide proxy dell'host configurato, credenziali in `chrome.storage.session`, un solo tentativo per request ID | Richiede permessi globali webRequestAuthProvider; l'autenticazione reale va verificata su Chrome/Edge. |
| Nessun test di uscita prima di mostrare “On” | `worker.js`: `verifyTorEgress` interroga `check.torproject.org/api/ip`, richiede `IsTor === true`; l'allarme `filum-tor-check` ricontrolla circa ogni minuto. `torStatus` espone stato/IP solo se la verifica è recente (90 secondi). Se la verifica fallisce, FILUM rilascia il proxy. | Controlla quelle richieste, non tutte le possibili perdite DNS, WebRTC, cookie o fingerprint. Un browser sospeso può ritardare l'allarme; la barra indica verifica scaduta. |
| `torOff` imposta PAC `DIRECT` e `onSuspend` tenta lo stesso | `worker.js`: `clearFilumTorProxy` usa `chrome.proxy.settings.clear`, controlla rilascio, elimina sessione; riapplica pulizia su avvio o aggiornamento | Non altera altri componenti che controllano il proxy; le credenziali temporanee non sopravvivono a un riavvio. Alla disinstallazione le impostazioni controllate dall'estensione non devono restare attive: verificare su Windows. |
| Popup originale con Connect/Disconnect | Il popup e il CSS/JS del CRX non sono inclusi. `popup.html`, `popup.js`, `style.css`: sezione “Tor via proxy esterno” nella **barra FILUM** con stato Connesso/Disconnesso, readback e avviso sul gestore; gli errori restano visibili dopo il readback. | Non equivale a Tor Browser né alle modalità PRIVATE/GHOST del fork Windows. |
| `js/stat.js`, welcome/uninstall URL, `w2i/`, pubblicità | Esclusi | FILUM non effettua chiamate statistiche o promozionali del CRX. |

### Stato e dati

- `chrome.storage.local.filumTorClientId`: ID casuale per il servizio, mantenuto nel profilo fino alla rimozione dell'estensione.
- `chrome.storage.session.filumTorSession`: host, credenziali e risultato della verifica; solo per la sessione del browser.
- Comandi `tor-connect` / `tor-disconnect` / `status`: serializzati nello stesso worker insieme ai controlli già presenti. La connessione contatta il servizio e Tor Project; la verifica periodica contatta soltanto Tor Project; la disconnessione e lo stato non fanno richieste esterne.
- All'avvio e all'aggiornamento, `clearFilumTorProxy` rilascia l'eventuale proxy controllato da FILUM in assenza di credenziali sessione affidabili. Se il browser nega il rilascio, la barra mostra errore e non dichiara lo stato spento come confermato.

## Registro delle modifiche

| Versione | Modifica | Test e limiti |
| --- | --- | --- |
| 0.5.2 | Smart Search fino a 50 candidati; dettagli in `docs/FILUM_CHROMIUM_CONTINUITY_2026-09-26.md`. | ZIP SHA-256 `c90c1323c7f5547f596fee10d3def066bf724681332989a73326baef84bf520d`. |
| 0.6.0 | Prima integrazione originale del meccanismo proxy del CRX in un'unica barra, senza popup, pubblicità o telemetria del CRX. Stato con verifica periodica e rilascio se Tor non è più confermato. File: `manifest.json`, `worker.js`, `popup.html`, `popup.js`, `style.css`, `test.cjs`, `README.md`. | Test statici/mock del set, autenticazione, `IsTor`, perdita della verifica, rollback e rilascio. Servizio GoodExtensions e navigazione reale **non ancora testati**: non dichiarare la build verificata su Windows. |
