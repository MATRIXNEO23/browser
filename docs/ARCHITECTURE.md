# Architettura

## 1. Prodotto

Il prodotto è un **browser standalone**. Gecko/Firefox ESR è il motore web, non il prodotto visibile.

```text
Browser.exe
   |
   +-- profilo unico del browser
   |
   +-- Gecko/Firefox ESR runtime
   |
   +-- Browser Control Core
         |
         +-- UI/Sidebar
         +-- Mode Controller
         +-- Resource Controller
         +-- Privacy Controller
         +-- ADS Controller
         +-- SMART SEARCH
         +-- Browser Library
         +-- Network Controller
```

Non esiste selezione di profilo/modalità prima dell'avvio.

## 2. UI

La UI propria comprende:

- nuova scheda personalizzata;
- sidebar a scomparsa;
- tema dark;
- barra preferiti sottile;
- SMART SEARCH;
- Libreria;
- Addon manager;
- modalità live;
- ADS;
- rete;
- stato background/RAM.

## 3. Modalità live

Tutte le modalità vengono applicate nel browser già aperto.

### NORMAL

- dati persistenti;
- protezione tracking di base;
- WebRTC compatibile;
- massimo 3 background.

### TURBO

- massimo 3 background;
- tab oltre il budget scaricate;
- tab background inattive ~90 s scaricate anche se sotto il budget;
- network prediction/prefetch ridotti;
- autoplay limitato dalle preferenze del runtime;
- ADS indipendente.

### PRIVATE

- cookie/storage più restrittivi;
- anti-fingerprinting;
- WebRTC limitato;
- massimo 3 background.

### GHOST

- cookie trattati come sessione;
- anti-fingerprinting forte;
- referrer ridotto;
- WebRTC disabilitato;
- registrazione locale dell'intervallo/host visitati durante la fase;
- all'uscita: pulizia mirata di cookie, IndexedDB, localStorage, service worker, cronologia e form data prodotti durante la fase, dove supportato;
- massimo 3 background.

GHOST non equivale a Tor Browser.

## 4. Resource Controller

Budget globale:

```text
foreground: 1
background_active_max: 3
rest: discard/unload quando possibile
```

Priorità:

1. foreground;
2. audio/video;
3. pinned;
4. background più recenti;
5. resto scaricato.

Le tab selezionate in finestre non focalizzate possono essere non scaricabili dal motore; il controller segnala il degrado invece di nasconderlo.

## 5. SMART SEARCH

Pipeline:

```text
query
  -> motore web
  -> <= ~30 candidati
  -> deduplica
  -> ranking locale titolo/snippet/dominio
  -> top 5: lettura HTML limitata
  -> reranking
  -> top risultati spiegati
```

Nessun LLM remoto necessario.

## 6. Rete

Controlli live:

- DIRECT;
- SYSTEM / VPN;
- SOCKS5 con DNS attraverso proxy.

Una VPN di sistema resta gestita da Windows; il browser non finge di implementare una VPN propria.

## 7. Dati browser

Il Browser Control Core espone pagine proprie per:

- cronologia;
- preferiti;
- download;
- addon.

Il password manager e le funzionalità di sicurezza native del motore restano disponibili come infrastruttura browser.

## 8. Privacy

Strategia:

- niente fingerprint casuale;
- riduzione/normalizzazione dell'entropia;
- cookie partitioning;
- tracking protection;
- WebRTC protection;
- referrer reduction in modalità forti;
- GHOST con pulizia effimera;
- niente telemetria del progetto.

## 9. Build

Il runtime viene incluso nella distribuzione Windows.

Una build è consegnata solo quando:

- CI PASS;
- ZIP persistito come GitHub Release;
- SHA-256 pubblicato;
- commit sorgente esatto registrato.
