# My IP.crx — analisi statica e integrazione FILUM

File fornito dall'utente: `My IP.crx`, SHA-256 `76a49fd8442288ad10c404d9cbeb2a2af9344cb0d3b7d0a5a2403eae431c86df`. Pacchetto CRX3, estensione MV3 versione 1.4.1. Analizzati `manifest.json`, `popup.html`, `popup.js` senza eseguirli.

| Parte originale | Comportamento osservato | Adattamento FILUM 0.6.5 |
| --- | --- | --- |
| Manifest | Popup separato e accesso a `https://www.codewithnodejs.com/` | Nessun popup o codice originale incluso. `manifest.json` permette `https://codewithnodejs.com/*` per l'endpoint effettivo nel JS. |
| `popup.js`, `checkurl` / `loadit` | GET a `https://codewithnodejs.com/api/ip-and-location/api.php`; risposta JSON con `ip`, `country`, `city` | `popup.js`, `refreshPublicIp` fa GET HTTPS diretto senza cache/credenziali, timeout 10 s, convalida IP e inserisce testo con `textContent`. All'apertura, ogni 20 s se pannello visibile, dopo cambio Tor. |
| `popup.html`, `parseJSON` | Mostra IP e posizione in popup; inserisce dati remoti con `innerHTML` | Solo IP pubblico nella barra FILUM. Niente HTML remoto né posizione. |
| `localStorage.lastchecks` | Registra gli ultimi cinque IP, luogo e data | Escluso: nessuna cronologia IP salvata. |
| Reload, animazione, link al creatore | Aggiornamento manuale e elementi del popup originale | Non inclusi. |

Il servizio esterno riceve l'IP e la richiesta quando la barra è visibile. Se non risponde, l'indicatore mostra “non disponibile” e non conserva un IP precedente. Il risultato identifica l'uscita osservata da quel servizio per la richiesta dell'estensione; non prova che tutte le pagine, i DNS o WebRTC seguano la stessa rotta. Non è stata eseguita una prova di navigazione reale su Chrome/Edge.