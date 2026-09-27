# FILUM Chromium — analisi del primo CRX candidato, 27 settembre 2026

## Identità e perimetro

- File fornito da Alberto: `Browser Tor.crx`, 325.735 byte; SHA-256 `e5c7eefd379776b0e994ee3882c3e597416a4b064500c82247decdda1f7a3330`.
- CRX3 con archivio ZIP interno; 119 voci, circa 498.660 byte estratti. Manifest V3, versione `9.0.1`, autore dichiarato `GOODEXTENSIONS Team`.
- Analisi statica del pacchetto fornito. Nessuna esecuzione del codice, nessuna connessione al suo server, nessuna verifica runtime della rotta di rete. Il CRX di terzi non viene copiato nel progetto FILUM; non è emersa una licenza di riutilizzo dei sorgenti nel pacchetto.

## Comportamento osservato nel codice

| Parte | Evidenza nel CRX | Conseguenza |
| --- | --- | --- |
| Connessione | `js/popup.js` richiede `https://goodextensions.mooo.com/ext/tor-browser/torconfig.php?cid=...` | Il server esterno fornisce indirizzo e credenziali del proxy; il servizio è una dipendenza del produttore. |
| Instradamento | `js/functions.js` imposta un PAC che restituisce `HTTPS <tor_settings.url>:443` | Configura un proxy HTTPS remoto. Nel pacchetto non sono presenti `tor.exe`, avvio del demone Tor o una verifica dei circuiti Tor. Il nome dell'estensione non dimostra che il traffico percorra Tor. |
| Autenticazione | `js/background.js` risponde alle richieste di autenticazione del proxy con credenziali ricevute dal popup | La rotta dipende da credenziali restituite dal servizio remoto. |
| Spegnimento | `js/functions.js` imposta un nuovo PAC `DIRECT`; `js/background.js` prova lo stesso anche durante `onSuspend` | Non usa `chrome.proxy.settings.clear()` per rilasciare il controllo delle impostazioni. Il callback di sospensione del service worker non costituisce una garanzia di ripristino. |
| Contatti aggiuntivi | `js/stat.js` contatta `stat.goodextensions.mooo.com`; `js/background.js` apre la pagina di benvenuto e imposta URL di disinstallazione; `popup.html` contiene link pubblicitari | Componenti estranei a una funzione locale di Tor. |
| Permessi | `proxy`, `webRequest`, `webRequestAuthProvider`, `storage` e host HTTP/HTTPS globali | Aumento sostanziale dei permessi rispetto all'add-on FILUM attuale. |

## Decisione di integrazione

**Non incorporare il codice o il proxy di questo CRX nella barra FILUM.** La richiesta dell'utente è una funzione Tor controllabile dalla barra, senza residui dopo la rimozione. Il CRX offre invece un proxy HTTPS gestito da terzi, senza prova che sia Tor, e introduce una dipendenza remota, tracciamento/marketing e gestione fragile del ripristino.

Una integrazione originale può usare `chrome.proxy` per un SOCKS5 **locale** avviato da un companion Tor verificato, con stato reale, verifica di uscita e rilascio del controllo tramite `chrome.proxy.settings.clear()` quando spento. Non chiamarla navigazione anonima equivalente a Tor Browser: Chrome/Edge conserva superfici di identificazione come WebRTC, fingerprint, cookie e cache. Il companion, il suo ciclo di vita e la verifica su Windows non esistono nel prototipo 0.5.2: prima di abilitare un pulsante “Tor” serve progettare e testare quella parte. Non modificare la rete di sistema né importare l'endpoint del CRX.

## Fonti esterne consultate

- Chrome Extensions `chrome.proxy`: https://developer.chrome.com/docs/extensions/reference/api/proxy
- Tor Project, uso di Tor con altri browser: https://support.torproject.org/tor-browser/security/using-tor-with-other-browsers/
- Formato CRX3: https://chromium.googlesource.com/chromium/src/+/lkgr/components/crx_file/README.md

## Stato del checkpoint

Analisi completata; nessun porting di codice o nuovo permesso nel manifest. In attesa di decidere se FILUM debba gestire un companion Tor locale o soltanto collegarsi a un Tor già avviato sul PC. La scelta cambia installazione, disinstallazione e UX della barra.
