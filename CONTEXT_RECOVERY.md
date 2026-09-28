# FILUM native browser — CONTEXT RECOVERY

Updated: 2026-09-28 (Europe/Rome). This file is the fast recovery index for the native Windows Gecko browser. The Chrome/Edge add-on is a separate project and must not be mixed into this work.

## Engagement rules

- Analyze only repository files and evidence supplied or explicitly linked by Alberto; do not invent code, APIs, files, or behavior.
- Before any code change, map the full transitive file/dependency chain and present the exact file-level plan. Wait for Alberto's explicit approval before writing code.
- Make only surgical changes to necessary lines; preserve unrelated bytes and behavior.
- If required source or test evidence is missing or ambiguous, stop and ask.
- After an approved code step, provide the exact Git checkpoint command and update this recovery file.

## Repository and build source identity

- Repository: `MATRIXNEO23/browser`.
- Native browser branch: `fix/tor-first-bootstrap`. Branch HEAD observed on 2026-09-28: `ad5dce7cb53c6a3d6b5270fc4e438fe27d248c3b`.
- Build workflow: `.github/workflows/build-windows.yml`, workflow name `build-windows-browser-fork`.
- Canonical per-build technical records: [`releases/FILUM_WINDOWS_X64_RUN_117.md`](https://github.com/MATRIXNEO23/browser/blob/fix/tor-first-bootstrap/releases/FILUM_WINDOWS_X64_RUN_117.md) and [`releases/FILUM_WINDOWS_X64_RUN_118.md`](https://github.com/MATRIXNEO23/browser/blob/fix/tor-first-bootstrap/releases/FILUM_WINDOWS_X64_RUN_118.md). Read these before analyzing either build.

| Build | Run | Source branch and commit | Persistent release ZIP SHA-256 |
| --- | --- | --- | --- |
| #117 | [36206348167](https://github.com/MATRIXNEO23/browser/actions/runs/36206348167) | `fix/tor-first-bootstrap`, `3044309c6c72160d0423e76f19a202628285c93d`; tag `fork-3044309` | `13e2b8583026cbf4d7a07cdb378124a9f11aec5db7f1e43d6c77de77bf65d52d` |
| #118 | [36208276499](https://github.com/MATRIXNEO23/browser/actions/runs/36208276499) | `fix/tor-first-bootstrap`, `77a1c1f65db6aeb9e9757d10e44a42d590b4ebce`; tag `fork-77a1c1f` | `78f2160d1014d5da89645b4c73bb414524d3c51e874293c558319fb1b34bc63b` |

Both runs completed successfully. Their Windows build and smoke jobs passed; the normal workflow release job was skipped. The permanent native releases and their checksum assets are documented in the two run manifests above.

## ZIPs stored on `main/releases`

- `releases/FILUM-Windows-x64-117.zip`: Git LFS object, payload size 161,828,205 bytes; LFS SHA-256/OID equals the #117 release ZIP SHA above.
- `releases/FILUM-Windows-x64-118.zip`: Git LFS object, payload size 161,828,383 bytes; LFS SHA-256/OID equals the #118 release ZIP SHA above.
- These are LFS pointer entries in Git; the 134-byte pointer size is not the payload size.

## GitHub Actions artifact references

| Build | Artifact | ID | Wrapper digest | Retention noted by Actions |
| --- | --- | --- | --- | --- |
| #117 | `Browser-Windows-x64-final` | `10893779557` | `sha256:fc6304bdfa49711ef2ff5468e94077c6283bae6c279df6471e3993989f094cf9` | 2026-10-26 UTC |
| #117 | `Browser-Windows-x64` | `10893759480` | `sha256:1d5ae65be335fd4cccd4d3bf74c6b8dc02675b56691e900dc80f3c38353df1c8` | 2026-10-03 UTC |
| #118 | `Browser-Windows-x64-final` | `10894398075` | `sha256:8d62890d04e3ac845db34a67690c36fc16bd2adb1b1570002dea428d853e6e0d` | 2026-10-26 UTC |
| #118 | `Browser-Windows-x64` | `10894372737` | `sha256:13ea4fc93b9018c607a9012a093ded9f8059092066d897da0faf14c4e568a718` | 2026-10-03 UTC |

Action artifact digests are for the downloaded ZIP wrappers. They are not interchangeable with the inner installable ZIP SHA-256 values above or with the SHA-256 of `browser.exe` (`7619adf588c57f40b241bb26938a6317b72f2218d2d63756a1477e2a038451bf`).

## Known differences and evidence limits

- #117 source is commit `3044309...`; #118 source is commit `77a1c1f...`. The run manifests say `browser.exe` is byte-identical, but the complete ZIPs/configurations differ.
- #117 uses `about:newtab` with a profile-generated extension UUID. #118 pins the packaged startup page to `moz-extension://5db2d283-fbda-489c-9f1f-f77a0a674080/newtab.html` with a matching mapping.
- #118's recorded changed files include `distribution/policies.json`, `fork/branding/pref/firefox-branding.js`, `extension/sidebar.js`, and `scripts/validate-product.py`; inspect the exact source commit before relying on those notes.
- User-reported state to investigate: Tor exit appears to be a Tor node; DNS and HTTP-header tests report no leak; WIMIA/WebRTC and location tests report TRUE. These reports have not been independently reproduced in this checkpoint.

## Source map status and next step

- No source code was inspected or changed in creating this file; the complete transitive dependency graph for WebRTC/location settings is not mapped yet.
- The build reports name relevant source files including `extension/sidebar.js`, `extension/experiment-apis/browserControl.js`, `extension/background.js`, `distribution/policies.json`, and the branding preference file. Treat these as file leads, not as a verified call graph.
- Next: at the exact selected source commit (#117 or #118), inspect the repository tree and the concrete files that set Tor/proxy/DNS, WebRTC, geolocation, and Control Center state. Map every direct and transitive link before proposing any code change.
- Do not change code until the file-level plan is shown and Alberto explicitly approves it.

## Task in attesa — leak WebRTC e localizzazione

- Scope richiesto da Alberto: sola analisi, nessun codice finché non vengono forniti i file e non viene approvato un piano concreto.
- Stato riferito dall'utente, non riprodotto qui: uscita Tor su nodo Tor; test DNS e Header senza leak; test WIMIA/WebRTC e Localizzazione (Loc) positivi per leak.
- I run #117/#118 e le rispettive source SHA sono già registrati sopra. Specificare quale build è stata usata nel test WIMIA/Loc e allegare output/screenshot redatti (senza IP o coordinate personali non necessari).
- Prima dell'analisi servono: al commit scelto l'albero file; `fork/UPSTREAM.json`; `.github/workflows/build-windows.yml`; `scripts/apply-fork-overlay.py`; `distribution/policies.json`; `fork/branding/pref/firefox-branding.js`; `extension/sidebar.html`, `extension/sidebar.js`, `extension/sidebar.css`, `extension/background.js`, `extension/experiment-apis/browserControl.js`; gli schemi/API/helper effettivamente importati o referenziati da questi file; e ogni generatore `user.js`/`prefs.js` presente. Verificare ogni percorso all'albero del commit, senza presumere che esista.
- Da `docs/FILUM_WORK_CONTINUITY.md` e dai manifest build risultano come piste, non come grafo verificato, il Firefox ESR upstream pin, l'overlay, i controlli privilegiati Tor/DNS/WebRTC e la sidebar.
- Piano: fissare il build testato; classificare ESR+overlay dal pin e workflow; tracciare il grafo UI → messaggi → API privilegiata → preferenze/servizi Gecko; controllare separatamente i percorsi WebRTC e geolocalizzazione e le interazioni con proxy Tor/DNS; poi restituire mappa, evidenze e proposta minima senza codice, attendendo approvazione.

## Analisi completata — WebRTC e localizzazione (2026-09-28)

- Revisioni esaminate in sola lettura: #117 `3044309c6c72160d0423e76f19a202628285c93d` e #118 `77a1c1f65db6aeb9e9757d10e44a42d590b4ebce`. L'utente non ha ancora indicato quale fosse installata durante il test WIMIA/Loc; quindi non è possibile fissare la build testata.
- `fork/UPSTREAM.json` punta a `mozilla-firefox/firefox.git`, branch `esr153`, commit `effb626ff45cbaa0bd3a4bbabc66fe2eb2380338`; il workflow fetch/checkout verifica l'esatto commit, quindi i build sono source build ESR con overlay FILUM, non un binario Gecko committato integralmente qui.
- `.github/workflows/build-windows.yml` invoca `scripts/apply-fork-overlay.py`, copia branding e core extension nel sorgente Firefox, copia `distribution/policies.json` nel package e crea l'eseguibile Windows. L'overlay crea/patcha i file chrome UI e integra l'extension; non sono presenti patch Gecko `.patch`/`.diff`, né generatori `user.js` o `prefs.js` nell'albero analizzato. Le due revisioni hanno lo stesso overlay e API privilegiata; `distribution/policies.json`, branding e `extension/sidebar.js` hanno revisioni diverse, ma non alterano la logica WebRTC/Tor qui mappata.
- WebRTC cross-file chain: `extension/sidebar.html` mode buttons → `extension/sidebar.js` `selectMode()`/`runtime.sendMessage({type:'set-mode', mode})` → `extension/background.js` listener e `applyRuntimePrivacy()` → WebExtensions `browser.privacy.network.peerConnectionEnabled` e `webRTCIPHandlingPolicy`. `extension/manifest.json` registra `experiment_apis.browserControl`, il quale collega `extension/experiment-apis/browserControl.json` a `extension/experiment-apis/browserControl.js`; `applyMode()` imposta altre preferenze Gecko ma non WebRTC. La UI diagnostics legge lo stato effettivo tramite `extension/diagnostics.js`.
- In `extension/background.js` linee 304, 318, 332 WebRTC è abilitato rispettivamente in NORMAL, TURBO e PRIVATE; linee 346-347 lo disabilitano in GHOST. Linea 388 `getModeHealth()` si aspetta WebRTC attivo fuori da GHOST/Tor. `extension/diagnostics.js` linea 100 usa la stessa attesa. Il ramo Tor in `background.js` linee 557-579 configura il proxy SOCKS5 su 127.0.0.1:19050 con `proxyDNS:true`, disabilita DoH e imposta/verifica WebRTC disabilitato; il controllo Tor non richiede di modificare l'API Tor né il proxy/DNS per una proposta di spegnimento WebRTC globale.
- Proposta WebRTC da sottoporre ad approvazione, non implementata: in `extension/background.js` impostare `peerConnectionEnabled=false` anche in NORMAL/TURBO/PRIVATE; allineare `getModeHealth()` alla condizione sempre disabilitata (linea 388); in `extension/diagnostics.js` linea 100 verificare `false`; aggiornare il self-test `extension/sidebar.js` per controllare lo stato in ogni modalità. Verificare anche `scripts/audit-functional.cjs` aggiungendo una copertura della privacy modalità. Nessuna prova consente di promettere che un test WIMIA specifico dia FALSE senza identificarne build e semantica; il report WIMIA dell'utente resta non riprodotto.
- Localizzazione: ricerca nell'albero del commit non trova `geolocation`, `geo.enabled` o API/setting di posizione in `sidebar.html`, `sidebar.js`, `background.js`, schema/implementazione BrowserControl, manifest, policies, prefs branding o albero script. Nessuna correzione riga-per-riga è supportata dai file presenti. Non inventare una preferenza Gecko o policy.
- Prossimo passo bloccato da due informazioni: (1) build installata per il test (117 o 118); (2) URL/nome esatto del test Loc e quale risultato mostra (permesso/accesso alla Geolocation API, coordinate, o posizione dedotta da IP), con screenshot/output oscurato. Dopo questi dati si può fissare il baseline e, su richiesta di conferma, proporre modifiche concrete. Nessun codice è stato cambiato o generato in questa analisi.
## Verifica successiva: build #117 e Loc Test (2026-09-28)

- Alberto ha fissato il test su build #117 (`3044309c6c72160d0423e76f19a202628285c93d`) e ha chiesto che qualsiasi implementazione resti ferma finché non conferma il piano WebRTC e la conclusione Loc.
- `distribution/policies.json` e `fork/branding/pref/firefox-branding.js` del commit #117 non impostano `privacy.resistFingerprinting`. `extension/background.js` lo gestisce a runtime: false in NORMAL/TURBO (righe 300/314), true in PRIVATE/GHOST (328/342). `extension/experiment-apis/browserControl.js:getModeDiagnostics()` legge il valore effettivo della pref (`privacy.resistFingerprinting`) alla riga 464. Tor non lo cambia.
- Alla revisione upstream fissata `effb626ff45cbaa0bd3a4bbabc66fe2eb2380338`, il test Gecko `browser/components/resistfingerprinting/test/browser/browser_timezone.js` verifica che RFP esponga timezone `Atlantic/Reykjavik` con offset UTC. In `toolkit/components/resistfingerprinting/nsRFPService.cpp`, lo spoof di JS locale è `en-US` solo dopo consenso esplicito (pref `privacy.spoof_english == 2`); non è automaticamente garantito da RFP.
- La pagina pubblica `https://whatismyipaddress.com/proxy-check` descrive i propri risultati come test di rilevamento proxy e avverte di possibili falsi positivi. Il chiarimento nel forum ufficiale WhatIsMyIPAddress afferma che `Loc Test` interroga provider di geolocalizzazione dell'IP, alcuni dei quali forniscono indicatori proxy; `TRUE` indica un segnale usato per classificare il proxy. Pertanto `Loc TRUE` con egress Tor non prova un leak della posizione reale e non identifica timezone, lingua o Geolocation API. Nessuna modifica Loc browser è proposta.
- Proposta WebRTC da sottoporre ora a conferma finale: `extension/background.js` righe 304, 318, 332 (`peerConnectionEnabled` true → false); riga 388 (`getModeHealth` deve aspettarsi sempre false); `extension/diagnostics.js` riga 100 deve aspettarsi false; `extension/sidebar.js` nel self-test modalità righe 678-692 deve leggere e includere `peerConnectionEnabled` nella verifica di ogni modalità; `scripts/audit-functional.cjs` deve aggiungere una verifica di scrittura/lettura disabilitata durante i cambi modalità nel test attorno alle righe 180-223. Nessuna modifica prevista a Tor, proxy SOCKS5, DNS, header, schema/implementazione BrowserControl, manifest, policies o branding.
- Stato: nessun codice modificato; analisi Loc completata. In attesa della conferma finale di Alberto sul piano WebRTC e sulla conclusione che il risultato Loc del test indicato non prova un leak della posizione reale.