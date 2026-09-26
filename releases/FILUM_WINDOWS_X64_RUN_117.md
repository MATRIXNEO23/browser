# FILUM Windows x64 — build #117, checkpoint di ripartenza

Fotografia del 26 settembre 2026. Questa è la build del **browser Windows nativo basato su Gecko**, non l'estensione FILUM per Chrome/Edge. Questo documento è stato scritto successivamente alla compilazione: **non fa parte del commit sorgente che ha prodotto l'eseguibile**.

## Identità immutabile

| Elemento | Valore verificato |
| --- | --- |
| Repository | `MATRIXNEO23/browser` |
| Commit sorgente esatto | `3044309c6c72160d0423e76f19a202628285c93d` — “Fix addon enable and uninstall lifecycle” |
| Tag della build | `fork-3044309`, risolto al codice della #117 |
| Ramo di provenienza | `fix/tor-first-bootstrap` |
| Build e smoke Windows | GitHub Actions run `36206348167`, job `build` e `smoke-windows` entrambi `success`; job `release` nel normale workflow `skipped` |
| Artifact Actions finale | `Browser-Windows-x64-final`, ID `10893779557`, digest dello ZIP contenitore `sha256:fc6304bdfa49711ef2ff5468e94077c6283bae6c279df6471e3993989f094cf9`; scadenza indicata da Actions: 26 ottobre 2026 UTC |
| ZIP interno finale | `Browser-Windows-x64.zip`, SHA-256 `13e2b8583026cbf4d7a07cdb378124a9f11aec5db7f1e43d6c77de77bf65d52d` dal log dello smoke dopo l'applicazione dell'icona/identità Windows |
| Eseguibile finale | `Browser/browser.exe`, SHA-256 `7619adf588c57f40b241bb26938a6317b72f2218d2d63756a1477e2a038451bf`, 729.600 byte; identico nella #118 secondo `releases/FILUM_WINDOWS_X64_RUN_118.md` |
| Tor incluso | `Tor version 0.4.9.12 (git-78923280eed3eff6)` verificato nel job Windows |

Il workflow aggiunto nel commit `e6939da41c50f44be25824a552ab16290af64d0a` scarica l'artifact validato, verifica `SHA256SUMS.txt` e crea la release `fork-3044309` con lo ZIP interno e il file checksum, usando `--target 3044309c6c72160d0423e76f19a202628285c93d`. Il tag esiste ed espone il sorgente della #117. Il 26 settembre 2026, l'API Releases ha confermato che la release pubblicata conserva fisicamente [`Browser-Windows-x64.zip`](https://github.com/MATRIXNEO23/browser/releases/download/fork-3044309/Browser-Windows-x64.zip), asset ID `589602334`, 161.828.205 byte, digest GitHub `sha256:13e2b8583026cbf4d7a07cdb378124a9f11aec5db7f1e43d6c77de77bf65d52d`, uguale alla copia locale; è presente anche `SHA256SUMS.txt`, asset ID `589602332`. Il link all'artifact Actions è temporaneo e non va scambiato per il file nella release.

**Hash diversi indicano oggetti diversi.** Il digest `fc6304...` è dello ZIP contenitore di Actions, `13e2b858...` del vero pacchetto installabile, `7619ad...` del solo `browser.exe`. La copia locale rinominata “final ok” vista nella conversazione aveva un altro hash: non attribuirle automaticamente l'identità della #117 ufficiale.

## Perché esiste la #117 e cosa contiene

La build precedente aveva il problema segnalato da Alberto: dopo aver disattivato un add-on nella pagina personalizzata, mancava un percorso funzionante per riattivarlo e la disinstallazione non riusciva. In #117 `extension/addons.js` non usa più `browser.management.setEnabled()` o `management.uninstall()` per queste azioni. Passa attraverso l'API privilegiata `browserControl`, che usa `AddonManager` di Gecko:

- `setAddonEnabled(id, enabled)` controlla `PERM_CAN_ENABLE` o `PERM_CAN_DISABLE`, esegue l'azione e rilegge `isActive`; impedisce di disattivare il core FILUM.
- `uninstallAddon(id)` controlla `PERM_CAN_UNINSTALL`, rimuove e rilegge lo stato; impedisce di rimuovere il core FILUM.
- La pagina mantiene visibili gli add-on disattivati, offre **Attiva**, chiede conferma prima di **Rimuovi**, aggiorna sugli eventi di ciclo di vita e mostra gli errori.
- `scripts/audit-addons.cjs` testa in modo simulato attivo → disattivato → attivo → rimosso; è aggiunto al gate del workflow. Lo schema dell'API privilegiata, il product gate e il codice della pagina sono nello stesso commit `3044309`.

Questa è una build completa del fork FILUM: interfaccia e nuova scheda approvate, sidebar, NORMAL/TURBO/PRIVATE/GHOST, ADS, DNS, rete/proxy, Tor integrato, diagnostica, preferiti e pagine interne. Per il significato e i limiti delle modalità leggere `docs/CANONICAL_PRODUCT_REQUIREMENTS.md`, `docs/ARCHITECTURE.md` e `docs/FILUM_FUNCTIONAL_AUDIT_2026-09-25.md` **alla revisione `3044309`**, evitando di attribuire alla #117 modifiche successive.

**Pagina iniziale della #117:** le preferenze puntano alla destinazione stabile `about:newtab`; in un profilo nuovo il browser la risolve a `moz-extension://<UUID generato dal profilo>/newtab.html`. Il log dello smoke mostrava `moz-extension://a2bb9afb-e489-461f-973f-3defc8ca10db/newtab.html` per quel profilo temporaneo. L'UUID non è una costante di prodotto. La #117 **non** include il fissaggio successivo a `moz-extension://5db2d283-fbda-489c-9f1f-f77a0a674080/newtab.html` della #118.

## Evidenza di validazione e suoi limiti

Nel run `36206348167`, il product gate, la build nativa Windows, l'assemblaggio, il controllo checksum, l'identità Windows, il core incluso, `tor.exe --version` e lo smoke runtime sono passati. Il report del browser registra `passed=true`, **41 check, zero errori**. Include tre cicli GHOST → NORMAL e gli altri cambi modalità, ADS, HTTPS-only, DNS personalizzato e preset Cloudflare, aspetto, RAM/accelerazione, DIRECT/SYSTEM/SOCKS5, Tor al 100% in circa 13,3 secondi sul runner, WebRTC spento nel cambio modalità, SOCKS5 con proxy DNS, egress Tor Project `HTTP 200; IsTor=true`, stop e ripristino proxy. I launcher Smart Search, add-on installati/catalogo, libreria, diagnostica e pagine interne hanno aperto gli URL previsti.

La verifica dei launcher controlla l'URL della scheda, **non ogni funzione della pagina aperta**. `audit-addons.cjs` è un test simulato: il run Windows non prova l'intero ciclo installa/disattiva/riattiva/rimuovi di un add-on di terze parti sul PC di Alberto. Il Tor del runner arrivato al 100% non prova lo stesso tempo o instradamento sulla rete di Alberto. I profili esistenti possono avere preferenze di avvio proprie.

## Differenza precisa dalla #118

La #118 è compilata da `77a1c1f65db6aeb9e9757d10e44a42d590b4ebce`, **un commit sorgente dopo la #117**. Il confronto dei commit mostra modifiche a `distribution/policies.json`, `fork/branding/pref/firefox-branding.js`, `extension/sidebar.js`, `scripts/validate-product.py` e alla documentazione. La #118 imposta e valida la pagina iniziale `moz-extension://5db2d283-fbda-489c-9f1f-f77a0a674080/newtab.html` con una mappatura UUID coerente. L'eseguibile `browser.exe` ha lo stesso SHA-256 nelle due build, ma **gli ZIP e i loro file di configurazione non sono equivalenti**. La #118 ha ZIP SHA-256 `78f2160d1014d5da89645b4c73bb414524d3c51e874293c558319fb1b34bc63b`. Per tornare davvero alla #117 partire dal tag/commit #117, non modificare la cartella estratta della #118 supponendo che sia identica.

## Sicurezza e copie locali

Alberto ha osservato sul suo PC una classificazione Microsoft Defender `Trojan:Win32/Bearfoos.B!ml` su copie di `browser.exe`; la causa non è stata stabilita. Il fatto che #117 e #118 abbiano lo stesso hash eseguibile, che il CI sia verde o che una copia ripristinata non sia stata bloccata subito **non equivale a dichiarare il file sicuro**. Un distinto avviso HTML/Redirector riguardava la cache web. Sono state discusse firma di test locale e copie ripristinate dalla quarantena; non sono un requisito o una modifica del sorgente/release #117. Vedi il rapporto #118 per l'analisi conservata. Non incorporare certificati o eccezioni antivirus in una modifica alla #117 senza richiesta esplicita.

## Come ripartire esattamente dalla #117

1. Recuperare il repository e verificare che `fork-3044309` punti a `3044309c6c72160d0423e76f19a202628285c93d`.
2. Creare **un ramo nuovo** dal tag: `git switch -c work/from-filum-117 fork-3044309`. Non spostare il tag, non modificare la release originale e non partire da `main`, #118 o dall'add-on Chrome.
3. Leggere a quel commit `docs/FILUM_WORK_CONTINUITY.md`, `docs/FILUM_FUNCTIONAL_AUDIT_2026-09-25.md`, `docs/CANONICAL_PRODUCT_REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `extension/addons.js`, `extension/experiment-apis/browserControl.js`, `extension/sidebar.js`, `distribution/policies.json` e `.github/workflows/build-windows.yml`.
4. Verificare l'asset ZIP ufficiale contro `13e2b858...65d52d` e il suo `SHA256SUMS.txt` prima di usarlo come riferimento. Se non è disponibile, ricostruirlo dal commit fissato e confrontare separatamente il risultato: una rebuild può cambiare i byte del pacchetto.
5. Prima di dichiarare riuscita una modifica, eseguire i gate di sorgente (`scripts/validate-product.py`, `scripts/audit-wiring.py`, `scripts/audit-functional.cjs`, `scripts/audit-addons.cjs`), poi una build Windows e smoke adeguato alla funzione toccata. I test statici e simulati da soli non convalidano Gecko sul PC dell'utente.
6. Per la pagina iniziale decidere esplicitamente se preservare il comportamento `about:newtab` della #117 o importare la scelta a UUID fisso della #118. Sono due stati diversi e nessuno va applicato implicitamente.

Questo rapporto si aggiunge al ramo di documentazione corrente. L'unico riferimento da usare per ricostruire byte e comportamento della **sorgente #117** resta `3044309c6c72160d0423e76f19a202628285c93d` / `fork-3044309`.
