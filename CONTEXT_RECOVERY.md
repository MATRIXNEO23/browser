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
## Completamento fix WebRTC — 2026-09-28

- Build baseline fissata su #117 / source `3044309c6c72160d0423e76f19a202628285c93d`. La conclusione Loc è confermata: nessun codice Loc modificato; `Loc Test: TRUE` del Proxy Check segnala classificazione del public egress IP, non prova esposizione posizione reale.
- Modifiche applicate chirurgicamente sulla branch `fix/tor-first-bootstrap`: `extension/background.js` imposta `peerConnectionEnabled=false` in NORMAL/TURBO/PRIVATE e `getModeHealth()` si aspetta sempre false; `extension/diagnostics.js` si aspetta WebRTC disabilitato; `extension/sidebar.js` self-test legge `peerConnectionEnabled` in ogni passaggio modalità e fallisce se non è false; `scripts/audit-functional.cjs` esegue `applyRuntimePrivacy()` del sorgente per tutte e quattro le modalità e asserisce una scrittura `false` in ognuna.
- Tor startup/restore, SOCKS5 `127.0.0.1:19050`, proxy DNS, secure DNS e header settings non sono stati modificati. Confronto di recovery: la sezione Tor start/restore/stop di `extension/background.js` è byte-identica al baseline; gli altri file tornano byte per byte al baseline rimuovendo solo i cambi richiesti.
- Source commit per file: `extension/background.js` → `8b272d750f5982d2701db98e3edcde04ea216d6d`; `extension/diagnostics.js` → `8e19c32b7ac4f1131bb7a1352e4aee4d068a3383`; `extension/sidebar.js` → `171192771d8b84bdd3b48c22887b99c797feba81`; `scripts/audit-functional.cjs` → `e7143f4839a7d89acc764dce09168f4567eef8a4` (HEAD prima di questo aggiornamento recovery).
- Verifica locale in workspace temporaneo dei file letti dalla branch: `node --check` su `background.js`, `diagnostics.js`, `sidebar.js`, `audit-functional.cjs` PASS; `node scripts/audit-functional.cjs` PASS con output `GHOST/Tor/modes/theme/site blocklist, search race, Tavily quota, transitions and sidebar states: PASS`. Self-test browser Windows e WIMIA live non eseguiti; serve una nuova build Windows e test runtime per dichiarare WIMIA FALSE.
- Prossimi step autorizzati per continuità: ottenere/buildare il pacchetto aggiornato e verificare WIMIA mentre Tor è attivo; dopo la verifica, analizzare l'implementazione esistente prima di proporre ampliamenti: DNS UI/API attuali (Cloudflare, Google, Quad9, custom), rete (system/direct/SOCKS5 e Tor), blocklist `extension/rules/ads-basic.json`; poi definire la proposta separata per OpenDNS/AdGuard/FoxDNS, profili proxy/VPN e phishing. Non iniziare queste feature prima del loro piano preciso e approvazione esplicita.
- Questo aggiornamento recovery registra il risultato; il commit GitHub risultante è il checkpoint documentale successivo al checkpoint sorgente `e7143f4839a7d89acc764dce09168f4567eef8a4`.


## Step 1 completato — provider DoH (2026-09-28)

- Sul branch `fix/tor-first-bootstrap`, base `4106e0cc533aa285af0061a30f26098ba83ed7f7`, aggiunti i preset OpenDNS (`https://doh.opendns.com/dns-query`) e AdGuard Standard (`https://dns.adguard-dns.com/dns-query`) in `extension/sidebar.js` e le opzioni corrispondenti in `extension/sidebar.html`.
- La logica esistente `providerFor()`, il messaggio `set-secure-dns` e l'API privilegiata `setSecureDns()` restano invariati; entrambi gli URL sono HTTPS e usano il percorso esistente.
- Verifica statica prevista: presenza dei due mapping e delle due opzioni nella select. Verifica in browser/build Windows non eseguibile in questo workspace.
- Nessuna modifica a Tor, proxy, ruleset ads o logica DNS esistente. Step 2 non iniziato; attendere la conferma di Alberto.


## Step 2 completato — Protezione Malware URLhaus (2026-09-28)

- Codice checkpoint: commit `abf2f7ab2194026ba113f5ae52a7c04e667e6897` sul branch `fix/tor-first-bootstrap`, discendente dallo Step 1 `8a227255f4ceeb6f560f0368add20b64885aaf68`.
- Inventario cross-file: `extension/sidebar.html` espone il pulsante `#urlhaus-malware`; `extension/sidebar.js` invia `set-urlhaus-malware` e mostra lo stato restituito; `extension/background.js` applica e verifica il ruleset `urlhaus_malware_basic`, e lo include in `get-status`; `extension/manifest.json` registra il ruleset disabilitato per default; `extension/rules/urlhaus-malware.json` contiene le regole statiche; `scripts/audit-functional.cjs` verifica rendering, validazione, aggiornamento e indipendenza da `ads_basic`.
- Le cinque regole sono state prese dalla prima pagina del feed [URLhaus text_recent](https://urlhaus.abuse.ch/downloads/text_recent/) verificata il 2026-09-28: `http://183.23.131.96:46756/bin.sh`, `http://175.165.85.24:57314/bin.sh`, `http://120.84.213.252:59517/i`, `http://222.127.251.169:51916/i`, `http://108.168.10.70:35934/i`. Ogni filtro usa schema HTTP, host/IP, porta e percorso specifici; non usa domini placeholder né blocca l'intero host. È uno snapshot statico e non si aggiorna automaticamente.
- Il ruleset è dichiarato disabilitato nel manifest. L'interfaccia legge lo stato corrente da `getEnabledRulesets()`; il background registra anche la scelta in `browser.storage.local`. Nessuna modifica a Tor, proxy SOCKS5, DNS, Header o ADS.
- Verifiche: `node --check` su `background.js`, `sidebar.js` e `audit-functional.cjs` PASS; `node scripts/audit-functional.cjs` PASS. La validazione di prodotto completa non è stata eseguita perché il test usava uno staging isolato con i soli file coinvolti nell'audit, non un checkout completo. Nessuna verifica in browser/build Windows è stata eseguita.
- Prossimo step: Step 3 Proxy VPN con credenziali embeddate, non iniziato. Attendere la conferma esplicita dell'utente prima di analizzare o modificare il codice di proxy.



## Step 3 — analisi pre-implementazione (2026-09-28)

- Stato: nessuna modifica di codice effettuata. Branch `fix/tor-first-bootstrap`; HEAD verificato prima di questa nota: `d2625d16aa1b55ae9cff9468aca694b00123ce68`.
- File letti: `extension/sidebar.html`, `extension/sidebar.js`, `extension/background.js`, `extension/manifest.json`, `extension/experiment-apis/browserControl.js`.
- Flusso esistente: `sidebar.html` espone `#network-mode` e `#socks-fields` con `#socks-host`/`#socks-port`; il listener `applyNetworkButton` in `sidebar.js` applica direttamente `browser.proxy.settings.set()`. Non esistono `getProxyConfig()` né un messaggio `set-proxy`. L'API privilegiata `browserControl.js` non gestisce questo proxy.
- Backup Tor: `setTorEnabled()` in `background.js` salva il risultato corrente di `browser.proxy.settings.get()` in `torPreviousProxy`; lo spegnimento usa `restoreTorNetwork()` per ripristinare quell'oggetto. Il proxy SOCKS corrente in queste impostazioni è rappresentato come host:porta.
- Incompatibilità della proposta ricevuta: `proxy.settings` definisce `socks` come stringa di indirizzo SOCKS e non accetta l'URL `socks5://user:pass@host:port` né un oggetto ritornato da `parseSocksUrl()`. La documentazione Mozilla descrive username/password SOCKS in `proxy.ProxyInfo`, restituito da `proxy.onRequest`; `webRequest.onAuthRequired` non gestisce l'autenticazione SOCKS. Riferimenti: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/settings ; https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/ProxyInfo ; https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onAuthRequired
- Conflitto di ripristino: cancellare le credenziali all'avvio Tor impedirebbe ripristinare un profilo SOCKS autenticato, perché `torPreviousProxy` contiene le sole impostazioni del browser e non le credenziali fornite separatamente a `proxy.onRequest`. Le alternative sono conservarle nel backup fino allo stop Tor oppure cancellarle e richiedere l'inserimento nuovamente al termine di Tor.
- La decisione è stata confermata: usare `proxy.onRequest` e conservare il profilo SOCKS autenticato in `browser.storage.local` durante Tor, deregistrando l'handler e riattivandolo dopo il ripristino.


## Step 3 completato — SOCKS5 autenticato e coordinamento Tor (2026-09-28)

- Source checkpoint sulla branch `fix/tor-first-bootstrap`: `623ddec8940a103968e6a6047d2a6b40ad32eff7` (discende da `f380d24ab411afbde8b5559e4c63be0f9b18a962`).
- Catena cross-file: `extension/sidebar.html` aggiunge i campi `#socks-user` e `#socks-pass` dentro `#socks-fields`; `extension/sidebar.js` legge/salva il profilo in vista e inoltra l'applicazione tramite `set-proxy-auth` oppure `set-network-proxy`; `extension/background.js` serializza entrambi i comandi con il ciclo Tor, imposta/verifica `browser.proxy.settings`, conserva il profilo autenticato in `socks_auth_profile` e registra `browser.proxy.onRequest` che restituisce un `ProxyInfo` SOCKS5 con username/password solo quando host e porta correnti corrispondono al profilo.
- Flusso Tor: all'inizio di ogni transizione Tor l'handler auth viene deregistrato e `torAuthSuspended` blocca richieste concorrenti; il backup Tor esistente continua a salvare solo le impostazioni SOCKS host:porta. Il profilo resta in storage per decisione esplicita dell'utente. Dopo uno stop Tor riuscito, una rollback completa o il recupero stale all'avvio, l'handler viene riattivato solo se il proxy ripristinato corrisponde al profilo. Il percorso di riparazione/restart Tor mantiene l'handler sospeso per tutta la sequenza.
- La modalità Direct o System e il SOCKS senza credenziali rimuovono il listener e cancellano il profilo auth dopo la conferma delle nuove impostazioni. Username e password devono essere forniti insieme. Tor continua a usare l'endpoint dinamico fornito da BrowserControl (SOCKS su `127.0.0.1:19050` nel flusso del progetto); non sono state modificate le impostazioni DNS/Header o l'implementazione di BrowserControl. Nessuna modifica necessaria a manifest o CSS: i permessi proxy/`<all_urls>` e gli stili input/griglia esistono già.
- Il listener legge le credenziali da storage quando valuta una richiesta, invece di tenere il profilo in una variabile globale. Le credenziali sono conservate in `browser.storage.local` durante Tor come richiesto; l'API non consente di garantire la cancellazione fisica delle stringhe già create nella memoria del runtime.
- Test in staging isolato con i file interessati: `node --check extension/background.js`, `node --check extension/sidebar.js`, `node --check scripts/audit-functional.cjs` e `node scripts/audit-functional.cjs` PASS. L'audit copre credenziali complete/incomplete, ProxyInfo, rimozione/riattivazione handler, profilo conservato e repair/restart Tor. Non eseguiti test su browser Windows, proxy SOCKS autenticato reale o build installabile; il supporto del server proxy reale resta da verificare in runtime.
- Step 3.5 completato: il launcher PRIVATE e l'audit RFP sono stati allineati nel checkpoint sorgente `3f414b448ad1757a788c28d037c66f0f89ef253f`. Il prossimo step indicato è Step 4 — Fix Libera RAM; attendere la proposta/approvazione prevista prima del codice.
- Comando di checkpoint equivalente per un checkout locale: `git add extension/sidebar.html extension/sidebar.js extension/background.js scripts/audit-functional.cjs CONTEXT_RECOVERY.md && git commit -m "feat: support authenticated SOCKS5 with Tor-safe lifecycle"`. Il commit sorgente è già registrato al SHA riportato sopra.


## Step 3.5 completato — Allineamento Anti-Fingerprinting (2026-09-28)

- Baseline: Step 3 accettato al commit `623ddec8940a103968e6a6047d2a6b40ad32eff7`; HEAD precedente `767e2d4987b976df822357f1a3b78e09de770e45` sulla branch `fix/tor-first-bootstrap`.
- Source checkpoint Step 3.5: `3f414b448ad1757a788c28d037c66f0f89ef253f` — `test: align launcher RFP with extension logic and add audit coverage`.
- Modifiche chirurgiche: `scripts/launch.ps1` aggiunge `user_pref("privacy.resistFingerprinting", true);` nel ramo `PRIVATE`; `scripts/audit-functional.cjs` cattura le scritture della pref eseguite da `applyRuntimePrivacy()` e verifica NORMAL/TURBO=false, PRIVATE/GHOST=true. L'audit controlla anche che il ramo PRIVATE del launcher contenga la preferenza attesa.
- Integrità cross-file: nessuna modifica a `extension/background.js`, `extension/experiment-apis/browserControl.js`, `extension/diagnostics.js` o `extension/sidebar.js`. La selezione runtime RFP era già implementata e verificata in quei file. I test preesistenti per proxy auth, Tor e URLhaus restano nella stessa suite.
- Verifiche: `node --check scripts/audit-functional.cjs` PASS; `node scripts/audit-functional.cjs` PASS, inclusi i test esistenti e i nuovi assert RFP. L'audit verifica staticamente la configurazione PRIVATE in `launch.ps1`; `pwsh` non è disponibile nell'ambiente, quindi la generazione reale di `user.js` non è stata eseguita.
- Prossimo step: Step 4 — Fix Libera RAM. Nessun codice Step 4 è stato modificato o proposto in questa consegna; attendere la definizione e approvazione del piano chirurgico.
- Comando di checkpoint equivalente in una checkout locale: `git add scripts/launch.ps1 scripts/audit-functional.cjs CONTEXT_RECOVERY.md && git commit -m "test: align launcher RFP with extension logic and add audit coverage"`. Il commit sorgente è già registrato allo SHA sopra; l'aggiornamento recovery è un commit documentale successivo.


## Step 4 — Fix Libera RAM e cleanup TURBO (2026-09-28)

- Baseline: `fix/tor-first-bootstrap` at `3e5f49b1c684ccf5c0296aff9ab34a45e1d6e7dd`.
- Source inspection found `browsingData` already present in `extension/manifest.json`; no manifest change is needed. `enforceBackgroundLimit()` is preserved and writes `status.discardedNow` to `browser.storage.local`, but returns no value.
- Manual `enforce-now` now awaits `browser.browsingData.removeCache({ since: 0 })`, runs the existing tab enforcement, then returns its `status.discardedNow` as `discarded`. The sidebar reports `Cache svuotata + X schede scartate` through its existing panel status.
- On a `set-mode` transition, cache clearing is gated by `message.mode === 'TURBO' && previousMode !== 'TURBO'` and is placed before the existing `enforceBackgroundLimit()` call. The existing queue, rollback, and tab-discard logic remain in place. Tor, proxy, DNS, and header code were not changed.
- Verification run in an isolated staging tree from this branch: `node --check extension/background.js`, `node --check extension/sidebar.js`, `node --check scripts/audit-functional.cjs`, and `node scripts/audit-functional.cjs` PASS. A temporary focused VM check also passed for manual cache-clear-before-discard, returned discarded count, and cache clear only on entry to TURBO. The committed functional audit does not directly exercise `enforce-now` or cache clearing; no Gecko/Windows runtime test was run.
- Cache clearing is not a measurement of physical RAM. The numeric feedback is the existing `status.discardedNow` value persisted by the awaited tab-enforcement function.
- Next: verify the browser UI and cache/TURBO behavior in a Windows build. Source checkpoint: `6aee776f0e09c71f5fef1a2dc92923f0698b76ba`.
- Equivalent local checkpoint command: `git add extension/background.js extension/sidebar.js CONTEXT_RECOVERY.md && git commit -m "fix: clear browser cache during RAM enforcement and TURBO entry"`.


## Step 4.1 — audit removeCache (2026-09-28)

- Aggiunto in `scripts/audit-functional.cjs` un test isolato VM con spy su `browser.browsingData.removeCache` e stub di `enforceBackgroundLimit()`. Nessuna API browsingData reale viene invocata.
- Il test verifica l'ordine cache → enforcement e il conteggio restituito per `enforce-now`; verifica cleanup soltanto all'ingresso TURBO, non quando TURBO è già attivo e non nelle altre transizioni. Ripristina lo spy e lo stub in `finally`.
- Verifiche locali in staging: `node --check scripts/audit-functional.cjs` e `node scripts/audit-functional.cjs` PASS. Verifica runtime browser/Windows ancora pendente; attendere un trigger CI manuale, senza modificare `main` o il workflow.
- Checkpoint test: `e69ed872353e1ee49612b154988c1d2b9609e1e2`; comando equivalente: `git add scripts/audit-functional.cjs CONTEXT_RECOVERY.md && git commit -m "test: add removeCache invocation verification for Step 4"`.
- Prossimo step: attendere il trigger CI manuale per il test runtime Step 4.


## Step 5 — Registro locale azioni di sicurezza (2026-09-29)

- Implementato in `extension/background.js` un logger FIFO con chiave `security_audit_log`, massimo 200 eventi e scrittura fire-and-forget serializzata.
- Il logger accetta solo `TOR_ENABLE`, `TOR_DISABLE`, `CACHE_CLEAR`, `MODE_CHANGE`; limita esito a `SUCCESS`/`ERROR`, modalità a NORMAL/TURBO/PRIVATE/GHOST e metadati a `discarded` intero non negativo. Non registra URL, credenziali, host proxy o fingerprint. Modalità omessa per gli eventi Tor e `enforce-now`, perché non disponibile senza letture aggiuntive bloccanti.
- Tor è registrato attorno al comando esistente `set-tor` dentro `queueControlTransition`, senza modificare il lifecycle interno o i retry. Errori originali vengono rilanciati.
- `enforce-now` registra l’esito e il conteggio reale `status.discardedNow`; nel catch registra ERROR e rilancia l’errore originale.
- `set-mode` registra MODE_CHANGE solo se la verifica finale `modeHealth.ok` è true. L’ingresso effettivo in TURBO registra anche CACHE_CLEAR; la lettura del conteggio è fire-and-forget e non influenza il cambio modalità.
- Stato corrente: Step 5 implementato e coperto da audit Node/VM deterministico. Verifica runtime Windows dello Step 4 in attesa del trigger CI manuale.
- Verifiche logger: `node --check extension/background.js` PASS; test VM ad hoc su FIFO, rotazione, whitelist e isolamento errori PASS. L’audit permanente è stato aggiunto nel checkpoint Step 5.1 `3e4d0e99aa6d2ee6fe363a66d2c164343f44e11f`; `node --check scripts/audit-functional.cjs` e `node scripts/audit-functional.cjs` PASS in staging isolato.
- Baseline branch prima dello Step 5: `e87eae3ebc74edc5bc66868d3e228a46f5bdc37a`.
- Checkpoint sorgente: `abae0032cacd5810347a7698e5571920c814c857`. Il recovery viene aggiornato nel commit documentale successivo.


## Step 5.1 — audit logger deterministico (2026-09-29)

- Checkpoint test audit: `3e4d0e99aa6d2ee6fe363a66d2c164343f44e11f` (`test: add deterministic audit coverage for security logger`).
- Aggiunti in `scripts/audit-functional.cjs` test VM isolati che caricano il segmento reale del logger da `extension/background.js`, con storage mockato e scritture controllate da Promise differite, senza timer o storage reale.
- Copertura: eventi e risultati fuori whitelist scartati; modalità e metadata non validi omessi; 205 scritture serializzate con FIFO cap a 200; errore storage su B tra A riuscito e C riuscito senza bloccare la coda; assert statico che nessun trigger attenda `logSecurityEvent`.
- Nessun file runtime modificato. I test non verificano persistenza Gecko dopo riavvio né permessi/policy runtime.
- La verifica runtime Windows dello Step 4 resta pendente, in attesa del trigger CI manuale. Nessuna modifica a `main` o al workflow.


## Integrazione test runtime Marionette — in verifica (2026-09-29)

- Base analizzata: commit FILUM `47690f975c3fc0b248f030a0a71fe9458ece50d7`, isolato nel branch `ci/runtime-marionette-47690`.
- Il workflow `.github/workflows/build-windows.yml` scarica l'artefatto e termina il browser nello stesso step PowerShell; perciò il test Marionette è eseguito nello step smoke esistente, prima del `finally` che chiude `browser.exe`. Il job fa checkout del commit del workflow per rendere disponibile l'harness.
- Lo smoke avvia Marionette su porta dinamica (`marionette.port=0`, `--marionette`), legge `MarionetteActivePort` dal profilo temporaneo e verifica che la porta loopback sia posseduta dall'eseguibile browser associato a quel profilo prima di passarla all'harness.
- `scripts/test-runtime-marionette.cjs` implementa il framing Marionette TCP, individua la pagina `moz-extension:` già aperta con le API dell'estensione e mantiene quella pagina attiva per i messaggi runtime. Il test SOCKS5 usa una scheda separata e server SOCKS/HTTP locali: credenziali valide devono raggiungere l'endpoint di test, quelle errate devono essere respinte. Ripristina il proxy diretto.
- Il test logger genera 201 eventi tramite transizioni NORMAL/TURBO, legge `security_audit_log` dalla storage reale del profilo, controlla schema/assenza credenziali e confronta la sequenza per verificare che restino gli ultimi 200 eventi in ordine FIFO.
- Nessun file runtime dell'estensione è modificato. Credenziali di test sintetiche; nessuna credenziale viene stampata. Nessuna dipendenza npm aggiunta.
- Verifiche locali finora: `node --check scripts/test-runtime-marionette.cjs`, `node --check extension/background.js`, `node scripts/audit-functional.cjs`, parsing YAML e `git diff --check` PASS. L'harness non è stato eseguito contro un Browser Windows/Gecko locale; l'esito runtime è pendente CI.
- CI #120 sul commit remoto `966a849cb0db189ef495cd32c801bae1613ba455`: job `build` PASS; job `smoke-windows` FAIL prima dell'avvio del browser e prima del test Marionette. Il checkout del repository dopo il download dell'artefatto ha ripulito la cartella `artifact`, quindi lo step successivo non ha trovato `artifact/Browser-Windows-x64.zip`.
- Correzione commit locale `073147cfeb6c8166f5e35b15de91a44c21a39460` / remoto `593a1f974f23abf50c07cc251ec4fc7f47a924b7`: checkout del repository prima del download dell'artefatto. CI #121: job `build` PASS; checksum, identity, core e verifica Tor PASS; il test Marionette è stato raggiunto ma ha fallito perché WebDriver rifiuta la navigazione a `about:newtab` (`unsupported operation`).
- Adattamento harness locale `d7fa82c26989f809d22a833c67fac67e6f00555c`, remoto `40976e1a285194839922d90fbdf661efabf3759e`: la pagina FILUM viene cercata tra gli handle esistenti e il test SOCKS5 opera in un tab separato. CI #122 (`36505827129`) sul commit remoto `40976e1a…`: job `build` PASS; smoke ha completato checksum, identità, core, Tor e self-test FILUM; lo step Marionette è FAIL perché non individua la pagina dell'estensione con le API tra gli 11 handle WebDriver esaminati. Il messaggio di errore non riportava URL né errori per handle, quindi il motivo specifico resta da accertare.
- Prossima modifica isolata: aggiungere diagnostica per ciascun handle (URL, errore di switch/URL lookup e risultato del probe API), senza modificare il codice runtime, così il prossimo log individua il blocco esatto. Verifiche locali per l'adattamento diagnostico: `node --check scripts/test-runtime-marionette.cjs`, `node --check extension/background.js`, `node scripts/audit-functional.cjs` e `git diff --check` PASS.
- Stato: runtime Marionette ancora FAIL; proxy SOCKS5 autenticato e persistenza Logger Gecko NON sono stati verificati perché il test non ha ottenuto un contesto pagina dell'estensione. Nessuna modifica a `main`; tutti i test runtime restano sul branch isolato `ci/runtime-marionette-47690`.
- Dopo il checkpoint e l'aggiornamento del branch isolato, triggerare un'altra CI e ispezionare il dettaglio diagnostico prima di dichiarare esito sui test Proxy Auth/Logger.
- CI #123 (`36506859386`) sul commit remoto `0e5c7e72f794650eca15ec13690fc668200f072f`: build PASS; smoke ha superato core, Tor e self-test FILUM, poi il test Marionette è fallito prima dei test Proxy Auth/Logger con `url.startsWith is not a function`. La causa era il wrapper `{value: URL}` restituito da `WebDriver:GetCurrentURL`, mentre l'harness lo trattava come stringa.
- Correzione locale corrente: normalizzare la risposta di `WebDriver:GetCurrentURL` estraendo `.value` quando il comando restituisce un oggetto, e registrare la risposta inattesa come diagnostica. Nessun codice runtime FILUM modificato. Eseguire i controlli locali, checkpointare questa correzione e rilanciare CI solo sul branch isolato per ottenere i dettagli URL/API e proseguire i test runtime.
- CI #124 (`36507813009`) sul commit `a850cde20388c0ca1061afd0846793a01472db64`: build PASS; Marionette ha trovato la pagina FILUM e si è connesso. Il test Proxy Auth ha fallito in `setSocksAuthProxy()` con `Impostazione proxy SOCKS5 non confermata`; Logger non era eseguito perché il runner interrompeva la suite al primo errore. Il test non dimostra ancora l'autenticazione valida/invalida. Prossima modifica esclusivamente all'harness: riportare `browser.proxy.settings.get()` dopo il rifiuto del comando e continuare al test Logger raccogliendo entrambi gli esiti; nessuna modifica al runtime FILUM.
