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
- CI #125 (`36508630329`) sul commit `07c69f3eda4a460388dd7dc2df505068541a39ae`: build PASS; lo smoke FILUM/Tor, incluso egress `IsTor=true`, PASS; il test Marionette trova `library.html` ma fallisce perché il WebDriver content sandbox non espone `browser.runtime`/`browser.storage`. Proxy Auth e Logger non sono stati eseguiti. L'errore è stato verificato nei log del job `109217162647`.
- Correzione locale successiva limitata a `scripts/test-runtime-marionette.cjs`: probe e chiamate alle API estensione passano al sandbox Marionette `system`, con diagnostica dei tipi globali se il probe fallisce. Mozilla documenta `system` come sandbox con system principal e privilegi elevati (Firefox Source Docs, `marionette_driver`); da convalidare sul runtime Windows CI. Nessun codice runtime FILUM o workflow modificato.
- Controlli locali dopo la correzione: `git diff --check`, `node --check scripts/test-runtime-marionette.cjs`, `node --check extension/background.js` e `node scripts/audit-functional.cjs` PASS. Non costituiscono verifica runtime Marionette.
- Prossimo step: checkpointare e aggiornare solo `ci/runtime-marionette-47690`, poi trigger CI su quel branch e analizzare il probe nel log prima di dichiarare esito Proxy Auth o Logger. `main` e release restano intatti.
- CI #126 (`36517561421`) sul commit `1f1c0c9ad20ed4272d75e48da3babacf58e05a0f`: build PASS; smoke FILUM/Tor ed egress `IsTor=true` PASS; Marionette ha trovato la pagina e raggiunto Proxy Auth e Logger, ma entrambi sono falliti con `Permission denied to pass object to exported function`. Il sandbox `system` espone le API ma gli oggetti creati dal sandbox Marionette non sono passabili direttamente alle funzioni WebExtension.
- Correzione locale dell'harness: limitare il bridge alle API usate dal test (`runtime.sendMessage`, `storage.local.get/set`, `proxy.settings.get`) e convertire input/output JSON attraverso il realm della pagina estensione per evitare il passaggio di oggetti tra compartment. Nessuna modifica a `background.js`, `sidebar.js` o workflow. Esito Gecko ancora da verificare.
- CI #127 (`36518408290`) sul commit `80d877354d82a1f61a4b57dd92fe9f448ce7a91a`: build PASS; smoke core/Tor ed egress `IsTor=true` PASS; logger Gecko PASS (201 eventi di test, schema valido e rotazione FIFO agli ultimi 200). Proxy Auth FAIL: `setSocksAuthProxy()` applica `socks=host:port`, ma `matchesRestoredProxy()` rifiuta la verifica perché confronta chiavi assenti nell'oggetto atteso (`http`, `ssl`, porte, FTP) con valori stringa vuota restituiti da Gecko. L'eccezione avviene prima del salvataggio `socks_auth_profile` e della registrazione del listener, quindi l'autenticazione non viene testata. Evidenza dai log smoke: impostazioni riportano `proxyType=manual`, SOCKS versione 5 e host/porta del mock; messaggio `Impostazione proxy SOCKS5 non confermata.`.
- Blocco di ambito: la richiesta attiva limita i cambi ai test/workflow e vieta modifiche runtime. Non correggere `extension/background.js` senza nuova conferma. Prossimo passo: chiedere se l'utente autorizza un fix chirurgico del confronto di proxy runtime; se sì, prima mappare test e dipendenze cross-file e presentare proposta prima del codice. Nessun merge in `main` o release.

## Fix verifica Proxy Auth dopo CI #127 (2026-09-29)

- L'autorizzazione successiva al blocco di ambito in CI #127 consente un fix chirurgico solo in `extension/background.js`, dentro `matchesRestoredProxy()`.
- Il confronto ora mantiene stretti `proxyType`, `socks`, `socksVersion` e `proxyDNS`. Per i campi opzionali, solo `undefined`, `null` e stringa vuota sono normalizzati come assenza; valori significativi, inclusi numerici come `0`, restano distinti. Questo copre la differenza Gecko osservata tra chiavi omesse e stringhe vuote senza stampare o modificare credenziali.
- Dipendenze: `setSocksAuthProxy()` usa il comparatore per verificare il proxy prima di salvare/riattivare l'autenticazione; `restoreTorNetwork()` lo usa per confermare il ripristino del proxy dopo Tor. Nessuna modifica ai due flussi, al listener `proxy.onRequest` o allo storage credenziali.
- L'harness `scripts/test-runtime-marionette.cjs` resta invariato: contiene già il test runtime con credenziali sintetiche valide e invalide tramite server SOCKS5 locali e non stampa i segreti.
- Verifiche locali: `node --check extension/background.js`, `node --check scripts/test-runtime-marionette.cjs`, `node scripts/audit-functional.cjs`, prova isolata dei casi del comparatore e `git diff --check` PASS. La prova locale non sostituisce l'esecuzione Windows/Gecko.
- Stato CI: fix pronto per checkpoint e trigger solo sul branch `ci/runtime-marionette-47690`; esito runtime Proxy Auth e non-regressione Tor ancora pendenti. Non dichiarare il branch pronto per merge finché la nuova CI non conferma build, smoke/Tor e autenticazione valida/invalida.
- Il precedente vincolo di non modificare runtime era riferito alla fase precedente; questa nota lo aggiorna in base all'autorizzazione esplicita successiva. `main` e release restano intatti.
- CI #128 (`36520509591`) sul commit `1163b0476fc4460442febf771d05aac725435ed8`: build Windows PASS; smoke core/Tor PASS (inclusi `tor-egress` con `IsTor=true` e `tor-stop` con ripristino proxy system). Lo step Marionette è fallito prima dei test Proxy Auth/Logger con `FILUM extension page APIs are unavailable`; entrambi non eseguiti. Il comparatore aggiornato è quindi compilato e lo smoke Tor di base resta verde, ma la conferma runtime di SOCKS5 valido/invalido è bloccata dal contesto API dell'harness. Il log indica il probe API mancante ma non identifica ancora perché la pagina trovata non esponga `browser.runtime`/`browser.storage`. Nessuna regressione Tor è stata osservata nel percorso smoke eseguito, ma il ripristino di un profilo SOCKS manuale non è coperto da questo esito.
- Stato: commit `1163b0476fc4460442febf771d05aac725435ed8` non pronto per merge. Prossimo passo: analizzare/fissare il problema di contesto API Marionette con una modifica separata autorizzata al solo harness, poi ripetere CI sul branch isolato per eseguire davvero credenziali valide e invalide; `main` e release restano intatti.
- CI #128 Marionette: nel log il probe ha consentito di trovare una pagina di estensione, ma la successiva chiamata asincrona non ha trovato le API e ha restituito solo `FILUM extension page APIs are unavailable`; i test Proxy Auth e Logger non sono partiti. Il codice del test e il resto dell'albero erano identici alla CI #127, dove Logger era passato; il rapporto tra il probe sincrono e il bridge asincrono resta da confermare.
- Correzione harness successiva (commit in preparazione): sia il probe sia il bridge cercano un riferimento che esponga realmente `runtime` e `storage` fra `browser` globale, `window.browser` e `window.wrappedJSObject.browser`, invece di scegliere un solo riferimento prima di verificarlo. Se nessuno è valido, l'errore riporta soltanto i nomi dei riferimenti e booleani di disponibilità, senza dati sensibili. Codice runtime FILUM invariato.
- Verifiche locali dopo la modifica harness: `node --check scripts/test-runtime-marionette.cjs`, `node --check extension/background.js`, `node scripts/audit-functional.cjs` e `git diff --check` PASS. La correzione non è ancora verificata su Windows/Gecko.
- Prossimo passo: checkpointare sul solo `ci/runtime-marionette-47690` e rilanciare CI #129. Verificare che il test raggiunga SOCKS5 auth valida/invalida e Logger; fino ad allora il fix di `matchesRestoredProxy()` resta non convalidato runtime e il branch non è pronto per merge.
- CI #129 (`36522561664`) sul commit `e8dddc4dc3589d1a0b83910e1ee037825a65574a`: build Windows PASS; smoke core/Tor PASS (inclusi `tor-egress` con `IsTor=true`, `tor-stop` e controlli modalità/UI); il test Marionette ha trovato il profilo ma Proxy Auth e Logger sono entrambi falliti prima delle chiamate API, perché il bridge `WebDriver:ExecuteAsyncScript` non esponeva `browser.runtime`/`browser.storage` in alcuno dei riferimenti provati. La run #127 aveva invece eseguito il Logger Gecko con esito PASS usando il probe sincrono; la differenza sincrono/asincrono è l'evidenza concreta per la nuova modifica dell'harness, non una causa già verificata a livello Gecko.
- Correzione harness locale successiva, limitata a `scripts/test-runtime-marionette.cjs`: sostituire il bridge `ExecuteAsyncScript` con `ExecuteScript` sincrono, avviare la Promise API nel contesto che il probe ha dimostrato funzionante, serializzare l'esito in una proprietà temporanea della pagina e leggerla/rimuoverla tramite polling sincrono con timeout. Nessuna modifica runtime né del workflow; i valori di test restano sintetici.
- Verifiche locali della correzione: `node --check scripts/test-runtime-marionette.cjs`, `node --check extension/background.js`, `node scripts/audit-functional.cjs` e `git diff --check` PASS. Il bridge sincrono/asincrono deve ancora essere verificato in Windows/Gecko; non dichiarare Proxy Auth o Logger validati dal run #129.
- Prossimo passo: checkpointare la correzione harness e questa nota sul solo `ci/runtime-marionette-47690`, avviare una nuova CI, quindi verificare i log per `PASS: SOCKS5 auth accepted valid credentials and rejected invalid credentials.`, `PASS: Gecko storage contains valid logger events...`, Tor egress/restore. `main` e release restano intatti.
- CI #130 (`36523792606`) sul commit `6d93d42d93b0d1469494edccea78753960217e3b`: build Windows PASS e smoke core/Tor PASS, inclusi `tor-egress` (`IsTor=true`) e ripristino proxy in `tor-stop`. Marionette ha trovato la pagina dell'estensione e il bridge sincrono ha superato il probe API, ma i test Proxy Auth e Logger si sono fermati perché il valore restituito da `runtime.sendMessage` è arrivato come `undefined`; quindi #130 non conferma gli effetti runtime delle due feature.
- Correzione harness locale dopo #130, limitata a `scripts/test-runtime-marionette.cjs`: rimosse le assunzioni sulla forma della risposta `sendMessage`; Proxy Auth viene verificato tramite profilo salvato e handshake SOCKS valido/invalido, Logger tramite valore modalità persistito ed eventi letti dallo storage. Codice runtime e workflow invariati.
- Verifiche locali di questa correzione: `node --check scripts/test-runtime-marionette.cjs`, `node --check extension/background.js`, `node scripts/audit-functional.cjs` e `git diff --check` PASS. La verifica Windows/Gecko resta pendente.
- Prossimo passo: checkpointare harness e recovery sul solo `ci/runtime-marionette-47690`, avviare la CI successiva e verificare gli assert basati sugli effetti osservabili. `main` e release restano intatti.
- CI #131 (`36525138238`) sul commit `7412cf692508377a61c8c66bc52fda09024235c6`: build Windows PASS; smoke core/Tor PASS, inclusi `tor-egress` (`IsTor=true`) e ripristino proxy in `tor-stop`; Marionette ha raggiunto i test, ma Proxy Auth ha fallito la verifica del profilo salvato e Logger ha ricevuto `undefined` da `storage.local.get`. Gli assert `deepEqual` del profilo stampavano i valori credenziali fittizi nel log di errore; la correzione locale li sostituisce con confronti booleani che non mostrano i valori.
- CI #132 (`36526583502`) sul commit `01c954871b0d68b810a054bb20a88af3b87793b0`: build Windows PASS; smoke core/Tor PASS (`tor-egress` `IsTor=true`, `tor-stop` ripristina il proxy); Marionette non ha trovato le API nel sandbox `default`, quindi Proxy Auth e Logger non sono stati eseguiti. Nessuna regressione Tor osservata.
- Correzione locale aggiornata: confronto dei commit mostra che #127 (`80d877354d82a1f61a4b57dd92fe9f448ce7a91`), dove il Logger passò, usava `ExecuteAsyncScript` nel sandbox `system`, selezione diretta `browser`/`page.browser` e il probe originale. Le varianti di discovery a candidati introdotte successivamente coincidono con le run che non trovavano le API. Ripristinato quel bridge noto, mantenendo il controllo delle credenziali via assert booleani senza valori in output. La causa è un'evidenza correlata dal confronto dei commit e deve ancora essere riconfermata runtime.
- Verifiche locali dopo la correzione: `node --check scripts/test-runtime-marionette.cjs`, `node --check extension/background.js`, `node scripts/audit-functional.cjs` e `git diff --check` PASS. Nessuna modifica a runtime FILUM o workflow.
- Prossimo passo: checkpointare harness e recovery sul solo `ci/runtime-marionette-47690` e avviare una CI successiva. Verificare che i log non contengano credenziali e controllare Proxy Auth, Logger e Tor; `main` e release restano intatti.
- CI #133 (`36527677374`), commit `e79ba8ea034ed13abe37c3e06bc641cce203cf3a`: build Windows PASS; smoke core/Tor ha superato self-test, Tor egress (`IsTor=true`) e ripristino proxy (`tor-stop`). Lo smoke runtime Marionette FAIL: trova la pagina moz-extension, ma le chiamate `ExecuteAsyncScript` del bridge ricevono `FILUM extension page APIs are unavailable`; Proxy Auth e Logger non arrivano agli assert e restano non verificati. Nessuna credenziale è stata esposta nei log filtrati. Evidenza tecnica: il probe sincrono in `waitForExtensionPage` trova le API, mentre il bridge asincrono successivo non le vede; differenza da risolvere nel solo harness prima di una nuova CI. `main` e release invariati.
- Prossimo passo: correggere o diagnosticare la differenza di contesto tra probe `ExecuteScript` e chiamate `ExecuteAsyncScript` nel harness Marionette; non dichiarare il fix `matchesRestoredProxy()` né il test runtime Proxy Auth/Logger convalidati fino a PASS degli assert specifici.
- Correzione harness in corso dopo #133, limitata a `scripts/test-runtime-marionette.cjs`: il bridge asincrono prova in ordine i riferimenti `browser` già usati nei probe Marionette (`global.browser`, `window.browser`, `window.wrappedJSObject.browser`, `page.browser`), selezionando solo un candidato con `runtime` e `storage`. In caso di indisponibilità riporta solo nome del riferimento e booleano `ready`; nessun dato utente o credenziale. Codice runtime e workflow invariati.
- CI #135 (`36559205290`) sul commit `0bee45ce391d45f40afa49f2d392b8a6a9284ce1`, branch `ci/runtime-marionette-47690`: build Windows PASS; core e smoke Tor PASS, incluso egress `IsTor=true` e ripristino proxy; runtime Marionette FAIL. Il probe asincrono ha restituito `ready=false` per `global.browser`, `window.browser`, `window.wrappedJSObject.browser` e `page.browser`; Proxy Auth e Logger non hanno raggiunto gli assert e restano NON verificati. Nessuna credenziale è stata esposta nel log filtrato. Il problema resta la differenza di contesto tra `ExecuteScript` sincrono (probe API presente) e `ExecuteAsyncScript` (nessun riferimento API disponibile).
- Run #134 (`36559000654`) è stato avviato per errore dal form GitHub Actions con il branch predefinito `main` e commit `c4c0c99f4987e0aa4d6c0241a72ef9f8e1f49c12`; è stata richiesta subito la cancellazione e GitHub ha concluso il run con `cancelled`. Non ha modificato branch o file. Nessun ulteriore run va avviato finché il bridge Marionette non ha una strategia verificabile e la branch selezionata non è confermata prima dell'invio.
- Stato: fix Proxy Auth `matchesRestoredProxy()` e test runtime Logger/SOCKS5 NON convalidati in Gecko. Non ripetere la stessa strategia di bridge o lanciare CI alla cieca; il prossimo lavoro richiede una diversa modalità d'accesso al contesto dell'estensione, mantenendo immutati runtime e workflow. `main` e release non sono stati modificati.

## Diagnostica interna self-test — 2026-09-29

- Branch attivo: `ci/runtime-marionette-47690`; commit diagnostica checkpointato: `91f72243ca8b752ff8eca0702cd4acb477df2a89` (parent remoto `dd5db0c7e064f6bfb5a099d317f328d0fc67f919`).
- Integrato nel self-test esistente un controllo Proxy Auth sanitizzato: usa solo credenziali sintetiche, verifica i byte associati alla chiave storage senza recuperarne i valori e chiede al background se il listener `proxy.onRequest` risulta registrato, attivo e non sospeso da Tor. Se trova già un profilo auth, non lo sovrascrive. Il controllo verifica configurazione/registrazione del listener, NON un handshake SOCKS5 riuscito con server remoto.
- Integrato il controllo Logger: attende un evento prodotto durante il self-test, controlla timestamp, event type ed esito, e include nel report solo booleani/conteggio. Non serializza né stampa eventi o credenziali.
- Aggiunto in `background.js` il messaggio diagnostico `get-proxy-auth-status`, che restituisce solo `hasListener`.
- Rimosso dal workflow Windows l'avvio del server Marionette e la chiamata al bridge che falliva in CI #135. I controlli aggiunti entrano nel report `filum.selftest.controls` esistente e il gate già presente legge `passed`/`checks`.
- Verifiche locali: `node --check` su `background.js` e `sidebar.js`, `node scripts/audit-functional.cjs`, `python scripts/validate-product.py`, parsing YAML del workflow e `git diff --check` PASS.
- CI #136 (`36565342438`), commit `91f72243ca8b752ff8eca0702cd4acb477df2a89`, branch `ci/runtime-marionette-47690`: BUILD PASS e smoke-windows PASS; release job SKIPPED. Report runtime: `proxy-auth-configured=true` (`listener=true`), `security-logger-runtime=true` (`count=23`), `tor-egress` PASS (`IsTor=true`) e `tor-stop` PASS con ripristino del proxy `system`. Nessuna credenziale è stata stampata. Artifact `Browser-Windows-x64-final`: ID `11032222051`, wrapper SHA-256 `6fe2a94b993e96703ddaea41047e3cb7f43c647574245204ce4ed286722da24e`; ZIP finale SHA-256 `3bb352065af626693275e0c9b3334de6594e80fb68903eaf3b9caf1e607c609f`.
- Limite di copertura: il controllo Proxy Auth dimostra profilo sintetico configurato e listener registrato, non un handshake SOCKS5 accettato/rifiutato. Il controllo Logger valida la presenza di eventi recenti e schema minimo con 23 eventi, non la rotazione FIFO nel runtime Gecko. I test Node/VM coprono separatamente la rotazione.
- Stato: runtime self-test Windows/Gecko PASS per i controlli sopra; non dichiarare verificati gli handshake SOCKS5 validi/invalidi né la FIFO Gecko. `main` e release non sono stati modificati.
- Prossimo passo: nessun nuovo trigger necessario per questa verifica. Conservare i riferimenti del run #136 e, prima di dichiarare Proxy Auth end-to-end convalidato, aggiungere un test runtime che esegua davvero uno scambio SOCKS5 autenticato; mantenere separata la verifica FIFO VM già passata. Non lanciare run da `main`.

## Valutazione pre-merge CI #136 — 2026-09-29

- Alberto accetta l'esito CI #136 come PASS per la build Windows, lo smoke test e i controlli runtime effettivamente eseguiti: configurazione Proxy Auth con listener registrato, Security Logger con eventi recenti validi, egress Tor e ripristino proxy dopo Tor.
- Limiti residui esplicitamente accettati per la Release: il self-test non esegue un handshake SOCKS5 con credenziali valide e non valide; la rotazione FIFO del logger è verificata dall'audit Node/VM, non in Gecko runtime. Gli avvisi CI su Node e sulla migrazione `ubuntu-latest` non bloccano questa valutazione.
- Stato del branch `ci/runtime-marionette-47690`: **Ready for Merge to Main**, in base all'accettazione esplicita dei limiti sopra. Il merge non è ancora stato eseguito e richiede la conferma finale di Alberto.
- Nessun tag di release è stato creato. Dopo l'eventuale merge, identificare e preparare i metadati del prossimo tag di release; non pubblicare né taggare senza autorizzazione esplicita.
- `main` e la release restano invariati in questa fase.

## Merge su main — 2026-09-29

- Il branch `ci/runtime-marionette-47690`, incluso il checkpoint recovery `26bbd77`, è integrato in `main` con un merge commit a due genitori, a partire dal `main` remoto `c4c0c99f4987e0aa4d6c0241a72ef9f8e1f49c12` e dal checkpoint branch pubblicato `7ebab0d2368cf939e30cad7a6ed1e21911521826`.
- Il solo conflitto era `distribution/policies.json`. È stata mantenuta la configurazione del branch Gecko verificato da CI #136: homepage `moz-extension://5db2d283-fbda-489c-9f1f-f77a0a674080/newtab.html` e mapping UUID coerente per `resource-controller@matrixneo23.browser`.
- Verifiche sul merge locale: `python scripts/validate-product.py`, `node --check extension/background.js`, `node --check extension/sidebar.js`, `node scripts/audit-functional.cjs`, parsing JSON della policy, parsing YAML di `.github/workflows/build-windows.yml`, `git diff --check` e scansione dei marcatori di conflitto: PASS. Nessun conflitto residuo; `background.js`, `sidebar.js` e workflow CI sono integrati.
- Stato: merge pubblicato su `main`. Nessun tag di release creato. Limiti Proxy Auth e FIFO Gecko descritti nella sezione CI #136 precedente restano accettati per la Release e invariati.

## Preparazione Release — 2026-09-29

- Stato `main`: **Stable / Release Candidate** per decisione di Alberto; merge del codice su `f2433d12572daf8fa78b7671b0087ff6dd6ee08c`. Il checkpoint delle note/recovery creerà un nuovo HEAD, che andrà fissato come target della build e del tag.
- Tag semantico proposto `v0.5.0-runtime-verified`: NON creato. Il manifest estensione resta `0.4.1`; il tag da solo non aggiorna la versione del prodotto.
- Convenzione esistente in `releases/README.md`: il tag canonico delle release native è `fork-<short commit sha>` (`fork-f2433d1` per la base pre-documentazione). Ricalcolare il tag dal nuovo HEAD dopo il checkpoint. Va deciso se mantenere anche il tag semantico come alias oppure cambiare la convenzione prima del tagging.
- La CI #136 (`36565342438`) ha testato il commit `91f72243ca8b752ff8eca0702cd4acb477df2a89`, tree `cf33635319df4afa1b6943f29506db8866b99b90`; l'HEAD `main` ha tree `e3a9aabba3f8ac29130e9cf987774b21bf6ee6a1`. Non dichiarare l'HEAD `main` buildato/verificato su Windows finché non passa una nuova build/smoke sul commit esatto scelto per la release.
- Limiti accettati per la bozza: nessun handshake SOCKS5 reale con credenziali valide/invalidi; FIFO del logger coperta da audit VM ma non da runtime Gecko. Il report di note è in `releases/FILUM-v0.5.0-runtime-verified-DRAFT.md`.
- Nessun tag o GitHub Release creato. Prossimi prerequisiti prima della pubblicazione: scegliere convenzione tag e target di versione; buildare/testare l'HEAD finale; verificare artifact e `SHA256SUMS.txt`; solo dopo creare il tag annotato e la release.


## Release v0.5.0-runtime-verified — RELEASED (2026-09-29)

- Stato: **RELEASED v0.5.0-runtime-verified**.
- Commit baseline verificato e taggato: `65a27a0347dd03fb42dc460baacbb75371c2a086`.
- Tag canonico: [`fork-65a27a0`](https://github.com/MATRIXNEO23/browser/tree/fork-65a27a0).
- Tag semantico: [`v0.5.0-runtime-verified`](https://github.com/MATRIXNEO23/browser/tree/v0.5.0-runtime-verified).
- Verifica tag: entrambi i tag annotati sono pubblicati su GitHub; la risoluzione dei tag annotati (`^{commit}`) conferma il commit baseline indicato sopra.
- CI di riferimento: [run #137](https://github.com/MATRIXNEO23/browser/actions/runs/36574970232), `workflow_dispatch` su `main`; commit esatto `65a27a0347dd03fb42dc460baacbb75371c2a086`; conclusione **success**. Build Windows e `smoke-windows` PASS. Il job `release` originale risultò `skipped`; la pubblicazione è stata completata separatamente dalla [run #36583644883](https://github.com/MATRIXNEO23/browser/actions/runs/36583644883), conclusa **success**.
- Evidenze smoke: bootstrap Tor 100%, egress `IsTor=true`, ripristino proxy dopo Tor; self-test modalità e controlli sidebar PASS, inclusi WebRTC disabilitato e controllo Free RAM; diagnostica Proxy Auth `listener=true`; Security Logger attivo con `count=23`.
- GitHub Release pubblicata: [FILUM Browser v0.5.0-runtime-verified](https://github.com/MATRIXNEO23/browser/releases/tag/fork-65a27a0), sul tag canonico `fork-65a27a0`; il tag semantico `v0.5.0-runtime-verified` resta alias dello stesso commit.
- Asset persistenti verificati via Releases API: `Browser-Windows-x64.zip` (161,834,834 byte, SHA-256 `4b3cdfa5b1cc7812cbc40f87aba27b3e0e24decd75fdca11cdf0339ae792b4e5`) e `SHA256SUMS.txt` (91 byte). La workflow di pubblicazione ha verificato il checksum del payload e il puntamento di entrambi i tag al commit di sorgente.
- Tentativo di promozione intermedia #36583205185 fallito prima della pubblicazione perché il patch smoke confrontava hash sidebar appartenenti a revisioni diverse. Il pacchetto finale #137 è stato poi pubblicato direttamente dopo validazione checksum e corrispondenza del commit/tag; nessun asset della release è stato sovrascritto con il pacchetto fallito.
- Limiti di copertura accettati: il controllo Proxy Auth conferma configurazione/listener, ma non un handshake SOCKS5 reale con credenziali valide e invalide. La rotazione FIFO del logger è verificata dall'audit Node/VM, non in Gecko runtime. Il conteggio runtime e lo schema minimo del logger sono stati verificati nel self-test.
- Avvisi CI non bloccanti: deprecazioni Node.js 20 e warning Node relativi a `punycode`/`url.parse()`. Nessun claim sul fix `WSAEADDRINUSE` è incluso nelle note di release.
- La sezione “Preparazione Release” precedente è superata da questo stato finale; i limiti di copertura restano parte della documentazione della release.

### Roadmap Futura

- Update System.
- Android Porting Study.
- Advanced Fingerprinting Script-Level.

## RFP coordinato con Tor — checkpoint CI #138

- Il fix aggiorna `privacy.resistFingerprinting` in base alla modalità e allo stato Tor; RFP resta attivo per PRIVATE/GHOST e mentre Tor è attivo o in avvio. Il controllo modalità confronta il valore effettivo con la stessa regola combinata.
- In avvio Tor il profilo privacy viene applicato prima del bootstrap; dopo lo stop confermato viene ripristinato il valore previsto dalla modalità corrente. Restano invariati proxy, DNS, WebRTC e UI.
- Verifiche locali sul checkout: `node --check extension/background.js`, `node scripts/audit-functional.cjs`, `python scripts/validate-product.py` e controllo diff whitespace: PASS.
- CI #138 (`36596957599`) sul commit `03b92653f168977335e45c325c4c7595b92069e0`: gate prodotto e compilazione Windows PASS; packaging FAIL con HTTP 404 sul bundle Tor `15.0.23`, quindi lo smoke Windows è stato saltato e la verifica runtime RFP resta pendente.

## Tor Bundle — ripristino CI #139

- Causa: l'URL del Tor Expert Bundle `15.0.23` non è più presente nell'indice ufficiale corrente.
- Aggiornamento preparato: bundle Windows x86_64 `15.0.24` (Tor `0.4.9.13`), URL ufficiale `https://dist.torproject.org/torbrowser/15.0.24/tor-expert-bundle-windows-x86_64-15.0.24.tar.gz`, SHA-256 `e9dc6ccc93cd6afa507193f4de284d6424233ff5102155cd2c94b259e8a22b65`.
- Riferimenti allineati in `.github/workflows/build-windows.yml` e `scripts/validate-product.py`. `build/RELEASE_TRIGGER` aggiornato con base `03b92653f168977335e45c325c4c7595b92069e0` e motivo `tor_bundle_15_0_24_fix_ci_139`.
- Stato: **Ready for Retry CI #139**. La verifica runtime RFP/Tor dipende dal completamento del nuovo build e dello smoke Windows.


## Nota informativa anti-fingerprinting — 2026-10-01

- Aggiunta in `extension/sidebar.html` sotto i controlli diagnostici una nota che chiarisce che FILUM usa RFP nativo Gecko e che la firma Canvas può variare con il rendering hardware Windows; non promette equivalenza con Tor Browser.
- Modifica solo informativa: nessun cambiamento runtime o ai test del fingerprint.
- Commit UI: `d31c36415a9358aa6c915eabf79722072a3917ec`.

## CI #141 — verifica Windows e Tor — 2026-10-01

- Run: [#141](https://github.com/MATRIXNEO23/browser/actions/runs/36882120139), source commit `d97ea9dae5377eea3f4388050312c6817627ae50`.
- Esito: `build` e `smoke-windows` PASS; `release` skipped. Lo smoke ha verificato il bundle Tor e l'avvio runtime, ma non aveva test specifici per FPI, WASM o HTTP/3.

## Hardening GHOST-only — checkpoint v0.5.2

- Portata su `main` la modifica del checkpoint locale `38b94c1`: bridge `browserControl.applyGhostHardening(boolean)`, snapshot persistente e rollback delle preferenze, applicazione solo in GHOST e diagnostica delle preferenze.
- Su `main` la base è `715115ffd9f03ef54ad9a5d24d0c0a21f7eca784`; il cherry-pick locale del checkpoint ha richiesto di preservare le sezioni recovery più recenti relative a CI #141.
- Il workflow Windows parte solo se cambia `build/RELEASE_TRIGGER`; il test runtime esistente non avviava Tor in GHOST. Per questa verifica il self-test viene esteso per avviare Tor con FPI attivo, controllare le preferenze, passare a NORMAL con Tor attivo e verificare il ripristino, quindi ripristinare GHOST e fermare Tor.
- Prima del push sono passati gli audit funzionali/prodotto, i controlli sintattici e `git diff --check`; la verifica runtime è stata poi eseguita dalla CI #142.
- La modifica preesistente a `releases/FILUM-Windows-x64-117.zip` resta esclusa dal commit e dal push.

## CI #142 — runtime GHOST/FPI e bootstrap Tor — 2026-10-01

- Run: [#142](https://github.com/MATRIXNEO23/browser/actions/runs/36897308327), evento `push`, commit sorgente `f42c9c6151a4e41dd3ea8ad3a8270d596de5fca6` su `main`.
- Esito: `build` **success**, `smoke-windows` **success**, `release` **skipped** (workflow disabilitato). La run ha costruito e avviato il pacchetto Windows; non ha pubblicato una GitHub Release.
- Il self-test runtime Windows ha letto in GHOST: cookie behavior `1`, FPI `true`, WASM `false`, HTTP/3 `false`, Alt-Svc `false`.
- Tor è stato avviato mentre GHOST/FPI era attivo: bootstrap al 100% in circa 14,8 secondi; egress verificato con HTTP 200 e `IsTor=true`.
- Con Tor ancora attivo, GHOST → NORMAL ha ripristinato i valori normali rilevati prima del test (cookie behavior `5`, FPI `false`, WASM `true`, HTTP/3 `true`, Alt-Svc `true`). Il rientro in GHOST ha riapplicato l'hardening; dopo l'arresto Tor, l'uscita da GHOST ha nuovamente ripristinato quei valori. Tutti questi check sono PASS nel report self-test Windows.
- Ambito delle evidenze: verifica runtime riuscita su questa build e sul runner Windows della CI. Non dimostra anonimato assoluto o garantito, non verifica il diniego della geolocalizzazione e non prova l'assenza di altri vettori di fingerprinting o di incompatibilità su ogni sito.
- `v0.5.2-stable` non è ancora una release formale: il job `release` è skipped e questa run non ha creato né pubblicato un tag o una release.
- Asset finale smoke: artifact ID `11180491586`, SHA-256 del payload Windows `7ff3daf7f060e87bc4b3f684198d2290af5acbc67ec8abfaba60bef0ed4fb615`.

## Contatore sessione Ads/Malware — preparazione CI #143 (2026-10-01)

- Riutilizzati i ruleset già presenti: `ads_basic` (`extension/rules/ads-basic.json`) e `urlhaus_malware_basic` (`extension/rules/urlhaus-malware.json`). Non cambiano i loro ID, percorsi, regole, toggle o stato predefinito.
- Aggiunto alla sidebar un contatore volatile di sessione, aggiornato dal refresh esistente ogni 5 secondi. Il background incrementa solo sui match dei due ruleset e non scrive il conteggio in storage o nel security audit log.
- L'API Gecko `declarativeNetRequest.onRuleMatchedDebug` / `getMatchedRules` è per testing/debug. In Firefox richiede il permesso `declarativeNetRequestFeedback` e la preferenza `extensions.dnr.feedback=true`. Il background prova la disponibilità all'avvio; quando la preferenza/API non è attiva la sidebar mostra “conteggio non disponibile”, mai uno zero che potrebbe essere scambiato per un conteggio verificato. Riferimento Mozilla: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest#testing
- Audit funzionale aggiornato per verificare conteggi Ads+URLhaus, esclusione di ruleset estranei, reset all'inizializzazione, fallback non disponibile e rendering numerico/sidebar.
- `build/RELEASE_TRIGGER` aggiornato da `b0c7023` per richiedere la build Windows e lo smoke runtime della CI #143; nessuna release formale richiesta.
- Verifiche locali: `node --check` per background/sidebar/audit, `node scripts/audit-functional.cjs` e `git diff --check` PASS.
- CI #143 (`36929369891`), commit `c7a7142eaa3f0f0feb4f13ecba97186369787d24`: job `build` e `smoke-windows` **success**, `release` **skipped**. Il runtime smoke ha verificato modalità GHOST, hardening nativo, bootstrap Tor con FPI, egress Tor e ripristino delle preferenze.
- Limiti della CI #143: il runner era Windows Server 2025 (`10.0.26100`); non ha eseguito BrowserLeaks, test di stabilità Canvas o catture ClientHello/JA3. La misurazione runtime Canvas/TLS su Windows 10 resta da eseguire in un ambiente disponibile.
- La modifica utente preesistente a `releases/FILUM-Windows-x64-117.zip` resta esclusa.

## Smart Toggle Ads per scheda — v0.5.4 (2026-10-02)

- `urlhaus_malware_basic` è abilitato di default accanto ad `ads_basic`; i due controlli esistenti restano indipendenti e possono ancora disabilitare i rispettivi ruleset.
- Aggiunta in sidebar l’azione “Sblocca sito / Riattiva blocco”, con hostname corrente e stato visibile. L’eccezione viene applicata solo alla scheda attiva e al dominio visualizzato, poi la scheda viene ricaricata.
- Il background usa `declarativeNetRequest.updateSessionRules()` con un’azione `allow` di priorità 1000 e condizioni `tabIds` + `initiatorDomains`. Un aggiornamento è serializzato e ogni chiamata DNR è atomica; la mappa effimera viene aggiornata solo dopo conferma dell’API.
- Le eccezioni non sono persistite. Le regole riservate residue vengono rimosse all’avvio dell’estensione; quelle associate a una scheda vengono eliminate su `tabs.onRemoved`. Il toggle non cambia modalità, Tor, RFP o preferenze di rete.
- Audit funzionale: copre URLhaus attivo per default, abilitazione/disabilitazione dei ruleset, priorità e condizioni della regola, isolamento da un’altra scheda dello stesso dominio, doppio click concorrente, rifiuto di dominio cambiato, update DNR fallito, reinserimento, cleanup all’avvio e chiusura scheda, stato UI.
- Verifiche locali: `node --check` su background/sidebar/audit, `node scripts/audit-functional.cjs`, `python3 scripts/validate-product.py`, `python3 scripts/audit-wiring.py` e `git diff --check`.
- Il test è Node/VM e non sostituisce una verifica runtime Gecko/Windows. Non avvia una nuova CI e non viene eseguito alcun push in questo checkpoint.
- La modifica utente preesistente a `releases/FILUM-Windows-x64-117.zip` resta esclusa dal commit.

## CI #144 — validazione Smart Toggle v0.5.4 (2026-10-02)

- Il checkpoint locale `b8818550038c046bbb859feb01721cbe8906c3b9` è stato pubblicato su `main` con commit remoto `737c99cb0b25e021c41eff1e86aa97b9dc7e045d`; gli alberi Git coincidono (`30bb9ba42714dfe778eec6feb72524497c1b09df`). Il push Git diretto non era autenticato, quindi il commit equivalente è stato creato tramite GitHub API. La run è stata avviata con `workflow_dispatch`.
- Run: [#144](https://github.com/MATRIXNEO23/browser/actions/runs/37021931611), `workflow_dispatch` su `main`, commit `737c99cb0b25e021c41eff1e86aa97b9dc7e045d`.
- Esito: `build` **success**, `smoke-windows` **success**, `release` **skipped** (job disabilitato). Product gate, compilazione Windows, packaging, checksum, registrazione del core, verifica bundle Tor e avvio runtime PASS.
- Nel self-test Windows: modalità e hardening GHOST PASS; Tor bootstrap 100% in circa 17,9 secondi; egress `HTTP 200; IsTor=true`; ripristino NORMAL/GHOST e WebRTC PASS. Runner: Windows Server 2025 (`10.0.26100`).
- Limite specifico Smart Toggle: il self-test Windows non ha cliccato il nuovo toggle né verificato `tabs.onRemoved`; DNR statico era presente durante lo smoke, ma il comportamento interattivo e il cleanup sono stati verificati dall’audit funzionale Node/VM, non da Gecko runtime. CI #144 conferma build e runtime generale/Tor, non una prova end-to-end del toggle.
- Artifact runtime finale: ID `11233977929`, digest ZIP artifact `15bce3b1989fd8f89312e73bb562b44000439ee66fa9040b8c5ec6c733878bd6`.
- La modifica utente preesistente a `releases/FILUM-Windows-x64-117.zip` resta esclusa.

## Chiusura ciclo v0.5.4-stable (2026-10-02)

- Stato operativo accettato: **v0.5.4-stable**, in stabilizzazione e in attesa di feedback sullo Smart Toggle o di nuove direttive. Nessun coding o rilascio formale richiesto in questa fase.
- Evidenze: CI #144 `build` e `smoke-windows` PASS; audit locale Node/VM PASS per scope tab/dominio, atomicità, concorrenza e cleanup. Il limite di copertura Gecko end-to-end del toggle resta quello annotato sopra.
- `release` rimane disabilitato/skipped: questo stato non equivale a una release formale pubblicata.

## GHOST JavaScript OFF globale — implementazione locale (2026-10-03)

- Aggiunto `javascript.enabled` alla mappa dello snapshot persistente `filum.ghostHardening.snapshot` in `extension/experiment-apis/browserControl.js`; ingresso in GHOST lo imposta a `false`, uscita ripristina il valore originario, rollback include la preferenza.
- Il bridge espone `setGhostJavascriptEnabled()` nello schema `extension/experiment-apis/browserControl.json` e riporta lo stato effettivo tramite `getModeDiagnostics()`. Il background serializza il toggle, lo rifiuta fuori da GHOST e ricarica la scheda attiva solo per URL HTTP(S), evitando di ricaricare la UI dell’estensione.
- La sidebar mostra il toggle solo in GHOST e un avviso quando JS è riattivato. Riselezionare GHOST non riapplica l’hardening e preserva l’override; riavviare il browser mentre GHOST resta selezionata riapplica JS OFF. Se l’uscita da GHOST fallisce, il rollback ripristina anche lo stato JS effettivo precedente.
- Aggiornati `extension/diagnostics.js`, `scripts/audit-functional.cjs`, il self-test Windows integrato in `extension/sidebar.js` e `scripts/test-runtime-marionette.cjs`. Il self-test UI verifica che il controllo resti visibile/interattivo quando JS è OFF, che si possa riattivare/disattivare JS, che la riselezione GHOST preservi l’override e che l’uscita ripristini lo snapshot. Il runtime Marionette copre inoltre ingresso/uscita e ripristino.
- Aggiornato `build/RELEASE_TRIGGER` con motivo `ghost_global_javascript_off_windows_runtime_test_2026_10_03`; il workflow esegue build e smoke Windows, mentre il job `release` resta disabilitato.
- Verifiche locali PASS: `node --check` per browserControl, background, sidebar, diagnostics, audit e Marionette; parsing JSON dello schema bridge; `node scripts/audit-functional.cjs`; `python3 scripts/validate-product.py`; `python3 scripts/audit-wiring.py`; `git diff --check`. Il self-test Windows non è stato eseguito in questo ambiente.
- File coinvolti: `extension/experiment-apis/browserControl.js`, `extension/experiment-apis/browserControl.json`, `extension/background.js`, `extension/sidebar.html`, `extension/sidebar.css`, `extension/sidebar.js`, `extension/diagnostics.js`, `scripts/audit-functional.cjs`, `scripts/test-runtime-marionette.cjs`, `build/RELEASE_TRIGGER`, questo file.
- La modifica utente preesistente a `releases/FILUM-Windows-x64-117.zip` resta esclusa da staging e commit.

### CI #145 — build Windows e test runtime JavaScript GHOST (2026-10-03)

- Commit testato su `main`: `c14d20afd02cfcc1b280a2573f36ba871836d33d`. Run [#145](https://github.com/MATRIXNEO23/browser/actions/runs/37090354985): `build` **success**, `smoke-windows` **success**, `release` **skipped**.
- Il self-test Windows ha verificato PASS per `ghost-javascript-toggle-visible-while-off`, attivazione e disattivazione dalla sidebar, mantenimento dell’override dopo la riselezione GHOST e ripristino delle preferenze native uscendo da GHOST. Ha verificato inoltre Tor bootstrap al 100%, compatibilità FPI/cookie/WASM/HTTP3/Alt-Svc, egress `HTTP 200; IsTor=true` e transizioni modalità.
- Runner: Windows Server 2025 (`10.0.26100`). Il test conferma l’interattività del pannello FILUM con JavaScript disattivato sul runner CI; non è una prova su Windows 10 locale.
- Artefatto finale scaricabile: `Browser-Windows-x64-final`, ID `11262198195`, dimensione 161,315,908 byte, digest ZIP artefatto `sha256:40f657b22a7dc3eb741c86fc8295d0267c9b378191812a175ae83b5354819e17`, scadenza 2026-11-02 UTC. SHA-256 del pacchetto browser verificato dal job: `b1809200be7ea5c563baf1a46eb8a9e3af1066beac175b4c8b6fcf2befc29ec7`.
- Nessuna release formale pubblicata; il job `release` è rimasto disabilitato/skipped. Lo ZIP utente locale è stato escluso dal commit e dal pacchetto.

## FILUM Policy Engine — implementazione iniziale (2026-10-03)

- Base remota verificata prima delle modifiche: `main` a `b9e95d35dcfd7e3c77618400f057689ba2479f7c`; albero iniziale uguale al worktree isolato. Le modifiche locali preesistenti agli ZIP FILUM restano fuori da questo worktree e non sono incluse.
- Aggiunto `extension/policy-engine.js`: quattro preset (`normal`, `protected`, `strong`, `maximum`) più override manuali globali per JavaScript, Canvas/RFP, WebGL, WebRTC, tracking e cookie. Precedenza implementata: override globale > preset; il livello predefinito deriva dalla modalità legacy. Tor resta separato e forza WebRTC bloccato; con Tor attivo RFP/Canvas resta protetto.
- La pagina `privacy-settings.html` espone preset e selettori indipendenti, collegata dalla sidebar. JavaScript/WebGL/RFP sono impostati dal bridge privilegiato con snapshot e rollback atomico delle preferenze native; WebRTC, tracking e cookie usano `browser.privacy` e vengono letti nuovamente per la diagnostica. Gli override per sito sono esplicitamente segnati non supportati in questa build. Canvas usa la preferenza RFP, che ha effetti più ampi del solo Canvas.
- La vecchia azione JavaScript della sidebar GHOST scrive lo stesso override globale del Policy Engine. Il report diagnostico distingue `PASS` da lettura non verificata; `network.cookie.noPersistentStorage` non viene presentato come prova di effetto runtime.
- Verifiche locali PASS: sintassi JS/JSON, test mirato del resolver (preset, precedenza, reset, Tor), test VM del rollback bridge, `scripts/audit-functional.cjs`, `scripts/audit-addons.cjs`, `scripts/audit-toolbar.cjs`, `scripts/validate-product.py`, `scripts/audit-wiring.py`, `git diff --check`.
- La verifica decisiva Gecko/Windows e il test dei quattro livelli + Tor sono ancora in attesa della nuova build CI. `build/RELEASE_TRIGGER` è aggiornato; il job `release` resta disattivato in attesa di un'autorizzazione esplicita alla pubblicazione.
- Limite noto per il report Windows: il job usa Windows Server 2025; non equivale a un test locale su Windows 10. La parte Canvas è readback della preferenza RFP, non una prova di hash o di comportamento pixel-per-pixel.

## Updater Gecko e audit pacchetto Windows (2026-10-03)

- Recovery completato prima dell'audit; repository e dipendenze verificate sul checkout FILUM e sul Gecko pinned `effb626ff45cbaa0bd3a4bbabc66fe2eb2380338`.
- La build FILUM è un archivio portabile; il workflow non installa servizi Windows né registra task pianificati. La policy Firefox enterprise `DisableAppUpdate: true` è stata aggiunta a `distribution/policies.json` per disabilitare gli aggiornamenti applicativi Firefox e la relativa UI senza modificare gli aggiornamenti delle estensioni o dei system add-on Gecko.
- L'archivio Windows #118 contiene `updater.exe`, `updater.ini`, `update-settings.ini`, `maintenanceservice.exe` e `maintenanceservice_installer.exe`. Sono componenti del percorso Mozilla app updater; `updater.exe` è distinto dal runtime Gecko. Non rimossi in questo checkpoint: prima si valida la policy nel pacchetto e si decide separatamente l'eventuale updater FILUM. Le funzioni di system add-on/add-on update non sono state disabilitate.
- Audit file Windows e motivazioni di conservazione: `docs/FILUM_WINDOWS_UPDATE_PACKAGE_AUDIT_2026-10-03.md`. Non è stato rimosso alcun file; runtime Gecko, NSS/certificati, Tor, metadata package/recovery e built-in addon restano intatti.
- `scripts/validate-product.py` e il passaggio di assemblaggio del workflow ora rifiutano policy che disabilitino `ExtensionUpdate` o `DisableSystemAddonUpdate`; build e smoke Windows per il checkpoint combinato sono ancora da eseguire.
- Nessuna pubblicazione release autorizzata in questa fase; il job release resta disattivato/skipped fino a direttiva esplicita.

## Menu nativo Firefox — audit mirato 2026-10-03

- Recovery del nuovo ciclo completato sul repository `MATRIXNEO23/browser`: il worktree isolato `codex/filum-privacy-policy` parte da `5fc0acca08b108006fb7e0b372e37e77d45229ac`; il suo albero corrisponde al commit remoto main `98c1f4d9b1ae1e76f2ab9fdaf9cefd073f8b1612`. CI #146 e artifact Windows ID `11279394810` erano verificati PASS prima di queste modifiche. Nessun file ZIP utente è stato toccato; `scodinzolina-conntinuity` è rimasto fuori scope.
- Correzione vincolante dell'utente: una richiesta sul menu nativo Firefox va implementata e provata nel menu nativo; modificare la sidebar FILUM non soddisfa il requisito.
- Ispezionato il file upstream `browser/base/content/appmenu-viewcache.inc.xhtml` al commit Gecko fissato `effb626ff45cbaa0bd3a4bbabc66fe2eb2380338`. Classificati e preservati i comandi core (schede, preferiti, cronologia, download, password, addon, impostazioni, aiuto/uscita), gli strumenti avanzati, l'account/sync e i controlli di recovery. Rimossi dal menu nativo solo i tre comandi non supportati di finestre/chat AI.
- Modifiche locali non ancora pubblicate: `fork/browser-chrome.css`, `scripts/apply-fork-overlay.py`, `packaging/Start-FILUM.cmd`, `packaging/README-PORTABLE.txt`, `scripts/test-portable-host.ps1`, `.github/workflows/build-windows.yml`, `scripts/validate-product.py`, più report e continuità. La build overlay verifica gli ID della sorgente pinned e rifiuta di nascondere comandi core; il self-test chrome apre `#appMenu-popup` e verifica computed visibility reale; il gate Windows attende `PASS:NATIVE_MENU_PASS`.
- Nuovo blocker portabilità verificato: l'archivio #146 non includeva un launcher e lo smoke usava un profilo `%RUNNER_TEMP%`. Il launcher relativo mette profilo e TEMP/TMP accanto alla cartella; il test Windows ora avvia da lì, controlla i file profilo, sposta la cartella A→B, la riapre e confronta percorsi Windows/registry/servizi/task noti.
- Verifiche locali PASS: Python compile e `node --check` sul controller chrome iniettato; `python3 scripts/validate-product.py`; fixture positiva/negativa per il guard del menu nativo; parsing YAML workflow; `git diff --check`. Windows PowerShell non è disponibile localmente.
- Stato runtime: Windows CI ancora da eseguire, quindi menu e portabilità non sono dichiarati verificati nel browser. Prossimo test decisivo: build/smoke Windows dal commit contenente queste modifiche, controllo log `Native Firefox app menu self-test` e esito `Portable profile A-to-B move: PASS` insieme a eventuali residui host.
- Report dettagliati: `docs/FILUM_NATIVE_MENU_AUDIT_2026-10-03.md` e `docs/FILUM_PORTABILITY_AUDIT_2026-10-03.md`. Override per sito e prova di rimozione updater non sono completati.

## Continuazione esecuzione prompt — 2026-10-03

- La mappatura delle preferenze per sito è documentata in `docs/FILUM_SITE_PRIVACY_SCOPE_2026-10-03.md`: Smart Toggle DNR per tab/dominio; eccezione tracking nativa per origin; JavaScript/Canvas-RFP/WebGL/WebRTC restano globali o mode-scoped nella build attuale; cookie per origin resta UNKNOWN. Nessuna granularità non verificata viene dichiarata.
- Revisione archivio Windows #118: rimuovere nel solo ZIP finale `updater.exe`, `updater.ini`, `update-settings.ini`, `maintenanceservice.exe`, `maintenanceservice_installer.exe` e `default-browser-agent.exe`. La policy `DisableAppUpdate` è attiva; le policy di aggiornamento extension e system add-on restano abilitate. Il runtime Gecko, NSS/certificati, metadata/recovery, Tor e built-in addon sono preservati.
- La fase di assemblaggio verifica l'assenza dei sei file e il workflow Windows controlla anche policy; il test host confronta percorsi Windows noti, registro, servizi e task e fallisce sui delta non classificati. CI #147 ha rilevato metadati di avvio Gecko sotto Mozilla/Firefox e chiavi HKCU; nessun profilo di navigazione esterno risultava. Il classificatore è stato ristretto a quei residui esatti. CI #148 si è fermata per una stringa di validazione statica troppo restrittiva; la correzione è nel commit `5bc7c327`. In CI #149 il build e menu/updater/runtime smoke sono passati, ma l'host audit ha trovato il profilo ephemeral `MozillaBackgroundTask-...-defaultagent`; il test terminava con `Stop-Process -Force`, probabilmente interrompendo il cleanup nativo. Il workflow ora chiude Gecko in modo graceful, attende l'uscita dei processi/task e verifica che il profilo ephemeral venga rimosso; la causa resta da confermare nel prossimo run. Non è stato prodotto ZIP finale in #149. È un audit mirato, non un monitor forense globale.
- La build portabile usa `packaging/Start-FILUM.cmd`, con profilo e TEMP/TMP vicini alla cartella. Il test Windows dovrà inizializzare il profilo, spostare la directory A→B, riaprirla e verificare i dati persistenti.
- Dopo i test la CI elimina il profilo/temp di prova, riporta il pacchetto testato nel percorso di staging, ricrea lo ZIP scaricabile dai file che hanno superato lo smoke e ricalcola `SHA256SUMS.txt`; non carica più l'archivio precedente allo smoke.
- Check locali aggiornati PASS: product gate, Python compile, `node --check` controller chrome, YAML parse, `git diff --check`. Runtime Windows non ancora eseguito; PowerShell non è disponibile nel runner Linux. Il tree della modifica è su `main` con commit `ae36b78`; nessuna release pubblicata.


## Continuation checkpoint — native Firefox menu and portable Windows ZIP (2026-10-03)

- Current remote main includes commits through bcbb90a839332f0583298ec6b4ebb2f10a0aa69a.
- CI #150 (37151771099, source 5620a09ec7446ee37b03cae1f14578eccc3cf9a0): native Firefox app menu assertion PASS; Windows build/runtime, bundled Tor, Tor egress, and absence of Mozilla updater executables PASS. Portable profile A-to-B reopened the moved package and preserved its sentinel, but the step failed afterward because it incorrectly expected Gecko's defaultagent background-task profile to be temporary and deleted.
- Verified against Gecko source: defaultagent is explicitly exempt from ephemeral task profiles and uses a persistent profile for the Windows Default Browser Agent. DisableDefaultBrowserAgent: true is already in FILUM policy; extension and system add-on update paths stay enabled. Do not remove general background-task, Gecko, recovery, NSS/certificate, or addon-update code to solve this test assumption.
- Corrective test changes: classify only the exact defaultagent profile root plus known crashes, datareporting, datareporting\glean, and datareporting\glean\tmp directories. Unexpected files/directories beneath it still fail. Removed the impossible auto-delete wait. The host audit continues rejecting new user browsing profiles, unknown registry changes, and service/task changes.
- The Windows workflow now supports a manual reuse_build_run_id input, allowing smoke/portable checks to reuse run #150 build artifact 11284546033 rather than rebuilding Gecko. No final ZIP was uploaded by #150. Dispatch the workflow with input 37151771099; then verify Portable profile A-to-B move: PASS, final ZIP SHA-256, and artifact upload before giving a download link. Keep release job disabled.
