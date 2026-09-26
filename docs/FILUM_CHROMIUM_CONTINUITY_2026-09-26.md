# FILUM Chrome/Edge — passaggio di consegne, 26 settembre 2026

Questo documento riguarda **l'estensione separata per Chrome/Edge su Windows**. Il browser Windows basato su Firefox/Gecko ha stato, build, avvisi Defender e continuità propri in `docs/FILUM_WORK_CONTINUITY.md` e `releases/`. Non confondere i due prodotti e non applicare i privilegi del fork Firefox all'estensione Chromium.

## Ripartenza esatta

- Repository: `MATRIXNEO23/browser`; ramo di lavoro `port/chrome-edge-windows-ui`.
- HEAD locale prima di questo checkpoint: `8e89412` (`Raise Chromium Smart Search candidate limit to 50`). Il commit di questo documento viene dopo.
- Remoto `origin`: `https://github.com/MATRIXNEO23/browser.git`. Prima di questo checkpoint l'ultimo ref remoto noto del ramo era `9a12aabaf2ea7aa5a8970f7d64d6e4bf70bb4aeb` con lo stesso albero di `4f5b5a2`; **verificare il ref remoto di nuovo**. Il ramo locale non ha un upstream configurato.
- Un tentativo precedente di `git push` fu bloccato dall'auto-review come invio di codice a GitHub non sufficientemente autorizzato. Alberto ha ora chiesto esplicitamente di salvare lo stato nella repository. Se la pubblicazione resta bloccata, riportarlo e conservare il checkpoint locale; non affermare che il remoto sia aggiornato.
- Cartelle: `chromium-extension/` contiene l'add-on Manifest V3; `chrome-windows-theme/` è un pacchetto tema separato. Il tema cambia i colori della cornice, non la geometria delle barre. Caricamento non pacchettizzato in `edge://extensions` o `chrome://extensions`.
- Ultimo ZIP consegnato: `FILUM-Chrome-Edge-Windows-prototype-0.5.2.zip`, SHA-256 `c90c1323c7f5547f596fee10d3def066bf724681332989a73326baef84bf520d`, Library ID `libfile_12dc8cb605708191b68c5b4c083444d0`. Include `chromium-extension/` e `chrome-windows-theme/`; `test.cjs` è presente nella cartella dell'estensione. Il file ZIP non è commitato nel repository.
- **Prossima richiesta discussa, non ancora autorizzata come implementazione**: aggiungere un pulsante “Chiedi a Tavily” che passa il prompt dell'utente a Tavily Search Basic con `include_answer` e mostra risposta breve e fonti. Tavily Search Basic è indicata come 1 credito/richiesta; la funzione Research distinta ha costo variabile molto più alto. Non integrare OpenAI o far credere che Tavily sia ChatGPT. Prima di codificare, controllare i costi e il contratto API correnti.

## Build e commit del ramo

| Versione | Commit locale | ZIP SHA-256 | Cambiamento / evidenza |
| --- | --- | --- | --- |
| 0.2 | `4f5b5a2` | `96574ba9f5cf2e4db6f751ab3f4f5199d880d2317172c77c3f6b795fca566b30` | Nuova scheda FILUM, pannello laterale, NORMAL/TURBO, ADS, tema opzionale. Prototipo isolato. |
| 0.3 | `acf4d29` | `bf04779cf8e75b9cb1910fa3620b27b8e68aa1a7e7fc30acc5ae94d4f30f186e` | Home offline e prima SMART SEARCH. Alberto ha confermato visivamente la home in Edge, ma la ricerca non funzionava. |
| 0.4 | `7fbdb1a` | `013db4621d0005859e79e41d57992d00b1106525f48cd7869167b95fb6d4e9f5` | Porting delle opzioni Smart Search Firefox e Tavily. Screenshot utente: richiesta DuckDuckGo `HTTP 403`, stato Tavily `TAVILY_DEFAULT_DAILY_LIMIT is not defined`. Non usare come build funzionante. |
| 0.5 | `33b36fa` | `0657a1bb765abb11116a0ce3d175cdf485a65452334231031c83f1e0b12b1666` | Costante Tavily corretta; fallback in scheda DuckDuckGo temporanea tramite `chrome.scripting`. Non esiste ancora una prova utente che il fallback abbia risolto il 403. |
| 0.5.1 | `d840299` | `6a26034af9ed9f9683f53553f302c69ad8336a804dbc5f59da60014393a97535` | Tolto il limite di visualizzazione di 10 risultati. |
| 0.5.2 | `8e89412` | `c90c1323c7f5547f596fee10d3def066bf724681332989a73326baef84bf520d` | Limite di raccolta alzato da 30 a 50; **non** implementa paginazione, quindi il numero effettivo dipende dalla fonte. |

Tutti gli ZIP sopra erano presenti nello scratch al checkpoint; quelli dalla 0.3 alla 0.5.2 sono stati consegnati come file Library. Gli SHA sono calcolati sullo ZIP locale. Le verifiche eseguite sulle ultime versioni erano sintassi JS, JSON manifest, `git diff --check` e integrità ZIP; **nessun test runtime Chrome/Edge automatizzato e nessuna chiamata reale Tavily**. Eseguire anche `node chromium-extension/test.cjs`: copre NORMAL/TURBO/ADS con mock, non ricerca o Tor.

## Stato funzionale 0.5.2: cosa esiste realmente

1. `manifest.json` sovrascrive la nuova scheda con `newtab.html`. HTML/CSS/JS sono locali e si aprono offline. Il pulsante **Cerca** usa `chrome.search.query` e quindi il motore predefinito; digitare nella barra degli indirizzi rimane competenza di Chrome/Edge. Il pulsante **SMART SEARCH** apre `smart-search.html?q=...`. L'utente ha visto questa UI installata in Edge.
2. La SMART SEARCH tenta una POST a `https://html.duckduckgo.com/html/`. Se rifiutata o senza candidati, il worker apre una scheda in background a `https://duckduckgo.com/?q=...`, attende il caricamento, legge selettori di risultati tramite `chrome.scripting.executeScript`, poi chiude la scheda. Il fallback non è stato confermato da un test reale su Edge dopo il 403 osservato. Un cambio markup o una pagina anti-bot può lasciare zero risultati; in quel caso compare un link per aprire la ricerca direttamente.
3. `smart-search.js` raccoglie fino a 50 candidati da una pagina e li mostra tutti. Non scarica pagina 2: **50 è un tetto, non una promessa di 50 risultati**. Deduplica per URL e scarta nodi pubblicitari riconoscibili, non tutti gli annunci possibili.
4. Ranking locale: match dei termini nel titolo/snippet/dominio; frasi esatte aumentano il punteggio; `+termine` dà bonus se presente e penalità se assente, ma **non è un vincolo rigido**; `-termine` esclude se trovato nei dati indicizzati. “Preferisci fonti dirette”, “Penalizza shopping”, “Penalizza social” aggiungono/sottraggono punti usando liste di indizi, non controlli semantici o esclusioni. “Nascondi link sospetti” elimina URL con username/password, punycode, IP letterale o dominio insolitamente complesso; non rileva notizie false o malware.
5. Il pulsante “Segna come fake · escludi sito” inserisce il dominio e sottodomini in una blocklist `chrome.storage.local`, aggiorna la lista e filtra le ricerche future. È una decisione dell'utente, **non** una classificazione di verità. La denominazione merita revisione. “Approfondisci i migliori 5” richiede permesso opzionale su siti HTTP/HTTPS e tenta fetch di pagine per ricalcolare il punteggio. Può fallire per accesso, formato o rete; il contatore `deepRead` attuale conta tentativi, anche se la pagina non è stata realmente letta.
6. Tavily: chiave `tvly-...` salvata in `chrome.storage.local` nel profilo browser, removibile dalla pagina; non è inclusa nel codice. Il pulsante dedicato richiede esplicitamente una `POST https://api.tavily.com/search` con `search_depth: basic`, `max_results: 10`, `include_answer: false`, `auto_parameters: false` e nessun retry automatico. Una richiesta base viene contabilizzata localmente prima dell'invio per non ripetere una spesa incerta; limite iniziale 33 al giorno modificabile 1–1000 e cap locale 1000 per mese. I contatori sono locali, non il saldo Tavily. Il pulsante gratuito non chiama Tavily. Tavily può anche essere la sola fonte se DuckDuckGo fallisce. L'API live non è stata testata nel ramo Chromium.
7. Pannello laterale FILUM: NORMAL/TURBO, ADS ON/OFF con readback e scarico schede in background. `TURBO` conserva fino a 3 schede non attive, con priorità a fissate/audio/protette; NORMAL non ricarica immediatamente schede già scaricate. Tor, DNS, PRIVATE, GHOST e barra nativa Firefox non sono realizzati in Chrome/Edge. L'UI di rete li segnala non disponibili. Un Tor companion portabile e DNS interni Chromium erano discussi, **non implementati**. Non affermare parità con il fork Firefox o anonimato Tor.
8. Il tema è separato e opzionale; la home dell'estensione e il tema possono convivere. Per mostrarla all'avvio, Chrome/Edge va configurato dall'utente per aprire una nuova scheda. Disinstallare l'estensione rimuove il suo storage; non sono scritte impostazioni di rete di sistema o file fuori dalla cartella dell'add-on da questo prototipo.

## Preferenze e richieste dell'utente

- Vuole un add-on installabile da chiunque su Chrome/Edge Windows, con cartella portabile e senza residui quando disinstallato. Tor/DNS richiedono un progetto separato e non devono essere finti.
- Desidera interfaccia FILUM cyber/circuiti e home disponibile senza Internet; vista e gradita nel test Edge. Il browser predefinito mostrato negli screenshot è Edge.
- Vuole SMART SEARCH realmente funzionante, con opzioni, fino a 50 risultati se disponibili. Ha chiesto se i filtri siano veri: la spiegazione trasparente sopra va preservata, senza presentarli come IA.
- Vuole forse una ricerca intelligente tramite prompt **con la chiave Tavily che già usa**, non con la sessione ChatGPT né con una chiave OpenAI. Sono state spiegate due possibilità: `include_answer` su Tavily Search Basic (risposta breve) e Tavily Research (rapporto più profondo, costo molto superiore). La conversazione è arrivata al costo; non è stato ancora chiesto esplicitamente di implementare una delle due.
- Non chiedergli di incollare chiavi API in chat. Per la distribuzione pubblica valutare la protezione della chiave; nel prototipo Tavily è una chiave inserita da ciascun utente nel proprio profilo.

## Verifica e prossime mosse

1. Verificare branch/HEAD e se questo checkpoint è sul remoto. Leggere `chromium-extension/README.md`, `manifest.json`, `smart-search.js`, `worker.js` e questo documento prima di modifiche.
2. Se l'utente richiede “Chiedi a Tavily”, usare **una sola chiamata esplicita** Basic con `include_answer` e mostrare testo + fonti; confermare da documentazione attuale se tale parametro mantiene il costo di 1 credito. Preservare limiti locali e nessun consumo automatico. Considerare risposta vuota, query lunghe, errore API, costo visualizzato e chiave rimovibile. Non introdurre endpoint Research per errore.
3. Prima di dichiarare la ricerca funzionante, fare uno smoke su Edge/Chrome Windows: apertura home offline, ricerca no-key, fallback dopo 403, filtri, Tavily con chiave volontaria, risultato e consumo effettivo. Se non disponibile, dichiarare la lacuna.
4. Se si richiedono 50 risultati **reali**, implementare paginazione/scroll della fonte con deduplica e limite di chiamate, poi testare; alzare solo il cap non basta.
5. Correggere in una revisione separata le etichette `+obbligatorio`, “Segna come fake” e “pagine approfondite” per riflettere il comportamento vero o rendere il comportamento effettivamente corrispondente.
6. Non aggiornare la release Firefox/Gecko né la sua continuità per semplici modifiche a questa estensione.

## Recupero per una nuova istanza

Prompt suggerito: “Riprendi FILUM Chrome/Edge da `MATRIXNEO23/browser`, ramo `port/chrome-edge-windows-ui`. Leggi integralmente `docs/FILUM_CHROMIUM_CONTINUITY_2026-09-26.md` e verifica il HEAD remoto, quindi continua dall'ultima richiesta dell'utente. Mantieni separati il fork Windows Firefox e il prototipo Chromium. La build consegnata è 0.5.2; Tavily `include_answer` è solo discusso, non implementato. Non dichiarare funzionanti le API non testate in Edge.”
