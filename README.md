# Browser

Browser personale standalone per Windows, orientato a leggerezza, privacy e controllo locale.

## Identità del prodotto

Questo progetto costruisce **un browser completo**, non un'estensione da installare sopra Firefox.

Gecko/Firefox ESR viene usato come motore web per compatibilità con siti e addon, ma interfaccia, nuova scheda, controlli, modalità, Smart Search, gestione risorse, privacy e comportamento sono definiti dal progetto.

Il browser si apre direttamente. Non esiste più alcun selettore di modalità prima dell'avvio.

## Modalità live

Le modalità si cambiano mentre il browser è aperto:

- **NORMAL** — sessione persistente e massima compatibilità.
- **TURBO** — stesso browser, ma con scaricamento più aggressivo delle tab inattive e riduzione del lavoro in background.
- **PRIVATE** — tracking/cookie/fingerprinting/WebRTC più restrittivi.
- **GHOST** — fase di navigazione effimera; cookie/storage/cronologia creati durante la fase vengono ripuliti quando si esce dalla modalità, dove tecnicamente supportato.

GHOST non viene presentata come equivalente a Tor Browser e non promette invisibilità assoluta.

## Funzioni integrate

- UI dark e compatta.
- Sidebar impostazioni a scomparsa.
- Nuova scheda personalizzata.
- Schede e finestre multiple.
- Massimo **3 attività background globali**.
- Scaricamento automatico dalla RAM delle tab eccedenti.
- In TURBO, scaricamento anche delle tab background inattive da circa 90 secondi.
- Barra preferiti sottile.
- Cronologia.
- Preferiti.
- Download.
- Password manager del motore.
- Addon Firefox/WebExtensions.
- Pagina addon installati.
- Collegamento diretto al catalogo addon.
- ADS ON/OFF indipendente dalle modalità.
- Blocco richieste pubblicitarie leggero integrato.
- SMART SEARCH con ranking locale e approfondimento limitato dei risultati migliori.
- Rete selezionabile: DIRECT / SYSTEM-VPN / SOCKS5.
- Protezioni cookie/storage, tracking, fingerprint e WebRTC.
- Nessuna telemetria proprietaria.

## Ricerca

La nuova scheda offre:

- ricerca web normale;
- SMART SEARCH.

SMART SEARCH usa il motore web solo per raccogliere un insieme limitato di candidati e poi li riordina localmente in base alla richiesta dell'utente.

## Prestazioni

Target iniziale:

- Windows x64;
- vecchi Core i3;
- poca RAM;
- minimo lavoro in background.

Non viene usato Electron e non viene incluso un secondo motore web.

## Build

Le build Windows consegnabili vengono:

1. compilate da GitHub Actions;
2. validate sintatticamente;
3. pubblicate come GitHub Release;
4. accompagnate da SHA-256.

Gli artifact temporanei di Actions non sono considerati storage canonico.

Vedi:

- [Requisiti canonici](docs/CANONICAL_PRODUCT_REQUIREMENTS.md)
- [Architettura](docs/ARCHITECTURE.md)
