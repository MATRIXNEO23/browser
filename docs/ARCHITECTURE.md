# Architettura V1

## Motore

La V1 usa Gecko/Firefox come runtime web. Non viene creato un motore HTML/JS proprietario.

Motivi principali: compatibilità WebExtensions, cronologia/preferiti/download/password/profili maturi, privacy configurabile e possibilità di ottenere una V1 leggera senza mantenere un fork gigantesco.

## Livelli

```text
UI / Control Center
        |
Mode Controller
NORMAL | TURBO | PRIVATE | GHOST
        |
Resource Controller ---- Ad/Tracker Controller
        |                         |
Profile / Session Layer ---- Privacy Layer
        |                         |
        +----------- Gecko -------+
                     |
               Network / DNS
```

## Modalità

### NORMAL
- cronologia e sessioni persistenti;
- cookie e login normali con protezioni di base;
- massimo 3 attività background;
- addon abilitati normalmente.

### TURBO
- massimo 2 attività background;
- sospensione aggressiva delle schede inattive;
- autoplay disabilitato;
- prefetch/preload ridotti;
- blocco ads/tracker consigliato ON.

### PRIVATE
- massimo 2 attività background;
- isolamento storage/cookie rafforzato;
- protezioni anti-tracking rafforzate;
- WebRTC e referrer configurati in modo prudente.

### GHOST
- profilo separato;
- sessione non persistente per impostazione predefinita;
- anti-fingerprinting più aggressivo;
- nessuna condivisione di cookie/cache/sessioni con NORMAL;
- massimo 2 attività background.

GHOST non viene dichiarata equivalente a Tor Browser.

## Gestione schede e finestre

Il limite è globale e considera tab e finestre.

Priorità:
1. contenuto in primo piano;
2. audio/video attivo;
3. upload/download in corso;
4. tab recenti fino al limite di background;
5. resto sospeso/scaricato.

Default: NORMAL 3 background; TURBO 2; PRIVATE 2; GHOST 2.

## Blocco pubblicità

Il controllo ADS è indipendente dalla modalità. Stati iniziali: OFF e ON. La V1 deve essere compatibile con uBlock Origin; un'integrazione nativa del motore filtri verrà valutata solo dopo benchmark CPU/RAM.

## Fingerprinting

Non randomizzare indiscriminatamente User-Agent, GPU, Canvas, font, timezone e dimensioni finestra. La strategia è ridurre API ad alta entropia, partizionare storage, minimizzare leak WebRTC, usare protezioni coerenti e mantenere GHOST separato.

## Prestazioni

Target: Core i3 di vecchia generazione.

Regole: pochi processi contenuto, niente feed/news nella nuova scheda, niente preload aggressivo, autoplay off in TURBO, tab inattive candidate a unload, diagnostica RAM/CPU nel Control Center.

## Roadmap

- M0 bootstrap: struttura, configurazione canonica, launcher Windows, profili base.
- M1 lifecycle tabs: limite background, eccezioni audio/download/pinned, contatore attività.
- M2 mode controller: NORMAL/TURBO/PRIVATE/GHOST.
- M3 privacy/adblock: ADS, DNS sicuro, WebRTC/referrer/storage policies, test fingerprinting.
- M4 UI: tema dark, toolbar compatta, indicatori modalità/ADS/RAM/CPU.
- M5 benchmark: cold start, RAM 1/5/10/20 tab, CPU idle, compatibilità addon e siti pesanti.
