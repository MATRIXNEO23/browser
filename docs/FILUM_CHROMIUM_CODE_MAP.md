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
| `chromium-extension/popup.js` / `popup.html` / `style.css` | Barra laterale FILUM, pulsanti e stati leggibili | Comandi Tor al worker via `chrome.runtime.sendMessage`; Home apre una scheda, ⚙ configura l'URL in `chrome.storage.local.searchHomeUrl`. |
| `chromium-extension/test.cjs` | Test con API simulate su modalità, ADS, autenticazione proxy, conferma Tor e rilascio | Non prova servizio remoto, DNS/WebRTC o runtime Chrome/Edge. |
| `chrome-windows-theme/` | Tema facoltativo separato | Non fa parte dell'estensione funzionale. |

## Modulo Tor tramite servizio del CRX ricevuto

`Browser Tor.crx` v9.0.1, SHA-256 `e5c7eefd379776b0e994ee3882c3e597416a4b064500c82247decdda1f7a3330`, è stato analizzato staticamente in `docs/FILUM_CHROMIUM_BROWSER_TOR_CRX_AUDIT_2026-09-27.md`. FILUM **non copia file, librerie, pubblicità o script statistici** di terzi: implementa il protocollo osservato e dipende dal servizio remoto. Alberto riferisce che l'add-on originale ha raggiunto la rete Tor nel suo test; il nuovo codice FILUM non è stato ancora provato sul suo Windows.

| Codice originale osservato | Adattamento FILUM 0.6.0 | Limite o verifica |
| --- | --- | --- |
| `js/popup.js` richiede `torconfig.php?cid=...` | `worker.js`: `getTorClientId`, `limitedFetch`, `validateTorConfig`, `connectFilumTor` richiedono la configurazione solo dopo click e validano host/credenziali | Invia un ID casuale stabile al gestore; se il servizio cambia schema o non accetta FILUM, la connessione fallisce. Nessun contatto automatico all'avvio. |
| `js/functions.js` usa `chrome.proxy.settings.set` con PAC `HTTPS host:443` | `worker.js`: `connectFilumTor` applica lo stesso tipo di rotta HTTPS al profilo regolare, controlla `levelOfControl` e non aggiunge fallback `DIRECT` | Il proxy è gestito da GoodExtensions. In caso di errore di verifica FILUM prova a rilasciare subito il controllo. Non cambia il proxy di Windows. |
| `js/background.js` usa `onAuthRequired` | `worker.js`: listener `onAuthRequired` con `asyncBlocking`, limitato alle sfide proxy dell'host configurato, credenziali in `chrome.storage.session`, un solo tentativo per request ID | Richiede permessi globali webRequestAuthProvider; l'autenticazione reale va verificata su Chrome/Edge. |
| Nessun test di uscita prima di mostrare “On” | `worker.js`: `verifyTorEgress` interroga `check.torproject.org/api/ip`, richiede `IsTor === true`; l'allarme `filum-tor-check` ricontrolla circa ogni minuto. `torStatus` espone stato/IP solo se la verifica è recente (90 secondi). Da 0.6.3 `tor-refresh` riverifica all'apertura della barra e ogni 30 secondi finché visibile, mostrando “Tor …” durante la prova; se fallisce, FILUM rilascia il proxy. | Controlla quelle richieste, non tutte le possibili perdite DNS, WebRTC, cookie o fingerprint. Un browser sospeso può ritardare l'allarme. |
| `torOff` imposta PAC `DIRECT` e `onSuspend` tenta lo stesso | `worker.js`: `clearFilumTorProxy` usa `chrome.proxy.settings.clear`, controlla rilascio, elimina sessione; riapplica pulizia su avvio o aggiornamento | Non altera altri componenti che controllano il proxy; le credenziali temporanee non sopravvivono a un riavvio. Alla disinstallazione le impostazioni controllate dall'estensione non devono restare attive: verificare su Windows. |
| Popup originale con Connect/Disconnect | Il popup e il CSS/JS del CRX non sono inclusi. `popup.html`, `popup.js`, `style.css`: unico tasto Tor ON/OFF nella **barra FILUM**, con bordo azzurro quando l'uscita è verificata e arancione negli altri casi; click per connettere/disconnettere, stato riletto dal worker, errore visibile solo quando necessario. | Il colore ON conferma la verifica recente del servizio Tor Project, non le protezioni DNS/fingerprint di Tor Browser. |
| `js/stat.js`, welcome/uninstall URL, `w2i/`, pubblicità | Esclusi | FILUM non effettua chiamate statistiche o promozionali del CRX. |

### Stato e dati

- `chrome.storage.local.filumTorClientId`: ID casuale per il servizio, mantenuto nel profilo fino alla rimozione dell'estensione.
- `chrome.storage.session.filumTorSession`: host, credenziali e risultato della verifica; solo per la sessione del browser.
- Comandi `tor-connect` / `tor-disconnect` / `status`: serializzati nello stesso worker insieme ai controlli già presenti. La connessione contatta il servizio e Tor Project; la verifica periodica contatta soltanto Tor Project; la disconnessione e lo stato non fanno richieste esterne.
- `tor-refresh` contatta Tor Project se il proxy FILUM risulta attivo; il pannello lo invoca all'apertura, quando torna visibile e ogni 30 secondi se visibile. Un errore di verifica disconnette; la barra non mostra ON durante la prova.
- All'avvio e all'aggiornamento, `clearFilumTorProxy` rilascia l'eventuale proxy controllato da FILUM in assenza di credenziali sessione affidabili. Se il browser nega il rilascio, la barra mostra errore e non dichiara lo stato spento come confermato.

## Registro delle modifiche

| Versione | Modifica | Test e limiti |
| --- | --- | --- |
| 0.5.2 | Smart Search fino a 50 candidati; dettagli in `docs/FILUM_CHROMIUM_CONTINUITY_2026-09-26.md`. | ZIP SHA-256 `c90c1323c7f5547f596fee10d3def066bf724681332989a73326baef84bf520d`. |
| 0.6.0 | Prima integrazione originale del meccanismo proxy del CRX in un'unica barra, senza popup, pubblicità o telemetria del CRX. Stato con verifica periodica e rilascio se Tor non è più confermato. File: `manifest.json`, `worker.js`, `popup.html`, `popup.js`, `style.css`, `test.cjs`, `README.md`. | Test statici/mock del set, autenticazione, `IsTor`, perdita della verifica, rollback e rilascio. Servizio GoodExtensions e navigazione reale **non ancora testati**: non dichiarare la build verificata su Windows. |
| 0.6.1 | `popup.html`, `popup.js`, `style.css`: un solo tasto Tor ON/OFF; bordo azzurro soltanto con uscita Tor verificata, arancione altrimenti; descrizioni e sottotitolo della barra rimossi. Il tasto è disabilitato durante il comando; errore o verifica scaduta mostrati sotto il tasto. | `node chromium-extension/test.cjs`, verifica statica UI; controllo visivo in Chrome ancora da eseguire. La rete Tor e la protezione complessiva non sono determinate dal solo colore. |
| 0.6.2 | `popup.html`, `popup.js`, `style.css`: tasto Tor più piccolo; Home apre l'indirizzo del motore di ricerca in una scheda; ⚙ mostra campo URL, Salva e Predefinito. Default `https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/`, preferenza nel profilo tramite `chrome.storage.local.searchHomeUrl`. Accettati solo URL HTTP/HTTPS senza credenziali. `manifest.json` incrementa versione. | Il link `.onion` necessita di instradamento Tor funzionante: aprirlo con Tor OFF non attiva automaticamente il proxy. Nessuna modifica al motore di ricerca predefinito di Chrome o alla home locale FILUM. Test di controllo e ZIP; navigazione reale da provare in Chrome. |
| 0.6.3 | `worker.js` aggiunge `refreshTorStatus` / messaggio `tor-refresh`; `popup.js` mostra stato in verifica, poi ON solo dopo nuovo `IsTor`, ricontrolla ogni 30 secondi quando visibile; `test.cjs` simula vecchio ON con uscita Tor persa. `popup.html` e `style.css` sostituiscono la scritta Home con un'icona di casetta accessibile. | Se la verifica fallisce il proxy viene rilasciato. La conferma vale per il momento del test e non garantisce che ogni sito o protocollo passi per Tor; prova reale su Chrome ancora necessaria. |