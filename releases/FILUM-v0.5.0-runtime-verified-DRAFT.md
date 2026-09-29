# FILUM Browser v0.5.0-runtime-verified — Release Notes (bozza)

**Stato:** bozza; tag e GitHub Release non creati.

**Base di codice integrata:** `f2433d12572daf8fa78b7671b0087ff6dd6ee08c`. Il commit di release va fissato al `main` HEAD dopo il checkpoint di questa bozza e ricostruito/testato esattamente.

**Versione manifest estensione:** `0.4.1` (immutata; il tag proposto non cambia la versione incorporata nel prodotto).

## Sicurezza e privacy

- **Tor:** il test Windows/Gecko della CI #136 ha verificato l'egress Tor (`IsTor=true`) e il ripristino del proxy di sistema dopo l'arresto di Tor.
- **Proxy SOCKS5 autenticato:** il self-test Windows ha verificato profilo sintetico in storage e listener di autenticazione registrato. Non è stato eseguito un handshake SOCKS5 reale con credenziali accettate e rifiutate.
- **Registro sicurezza:** eventi sanitizzati in `browser.storage.local`, con limite FIFO di 200 voci. La CI #136 ha verificato eventi recenti e schema minimo; la rotazione è coperta dall'audit Node/VM, non da Gecko runtime.
- **Anti-fingerprinting:** WebRTC disabilitato in tutte le modalità; `privacy.resistFingerprinting` attivo in PRIVATE e GHOST secondo la logica e i test funzionali del progetto.
- **DNS e protezione web:** aggiunti OpenDNS e AdGuard Standard al selettore DoH; presente un ruleset URLhaus separato dal blocco annunci.

## Prestazioni e stabilità

- **Pulizia cache e schede:** l'azione manuale svuota la cache e scarta le schede inattive idonee; l'ingresso in TURBO esegue la stessa pulizia una volta per transizione. L'audit funzionale verifica ordine e condizioni; non misura RAM fisica liberata.
- **Diagnostica:** il self-test del pannello riporta controlli sanitizzati per configurazione Proxy Auth e attività del logger.

## Correzioni

- Normalizzato il confronto dei campi proxy opzionali restituiti da Gecko, trattando assenza e stringa vuota in modo coerente senza loggare credenziali.
- La bozza non attribuisce un fix specifico a `WSAEADDRINUSE`: nel codice e nelle verifiche esaminati non è stata trovata evidenza concreta sufficiente per dichiararlo.

## Note tecniche e copertura

- CI #136: [run 36565342438](https://github.com/MATRIXNEO23/browser/actions/runs/36565342438), BUILD e `smoke-windows` PASS sul commit `91f72243ca8b752ff8eca0702cd4acb477df2a89` del branch `ci/runtime-marionette-47690`; release job saltato.
- Il tree di quel commit (`cf33635319df4afa1b6943f29506db8866b99b90`) differisce dal tree dell'HEAD `main` candidato (`e3a9aabba3f8ac29130e9cf987774b21bf6ee6a1`). Non è ancora stata eseguita una build Windows dell'esatto commit `main` candidato.
- Il workflow non contiene uno stadio di firma Authenticode; Windows può quindi mostrare un avviso per editore non verificato.
- Restano fuori dalla copertura runtime Gecko l'handshake SOCKS5 reale e la rotazione FIFO del logger. Le relative limitazioni sono accettate per questa bozza, ma non vanno descritte come test end-to-end superati.

## Versionamento e pubblicazione

- Tag semantico proposto: `v0.5.0-runtime-verified` (non creato).
- `releases/README.md` prescrive per le release native il tag canonico `fork-<short commit sha>`; per la base attuale sarebbe `fork-f2433d1`. Il checkpoint di questa bozza cambierà HEAD: ricalcolare il tag canonico dal commit finale. Decidere se il tag semantico sarà aggiuntivo o sostituirà formalmente la convenzione canonica prima del tagging.
- La policy di release richiede un artifact Windows e `SHA256SUMS.txt` prodotti e verificati per il commit sorgente esatto. L'artifact della CI #136 è riferito al commit `91f7224`, non all'HEAD `f2433d1`.
- Prima della pubblicazione occorre eseguire e superare la build/smoke Windows sull'HEAD finale scelto; quindi allegare l'artifact e il relativo checksum al tag/release corrispondente.
