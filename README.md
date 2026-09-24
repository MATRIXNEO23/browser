# Browser

Browser personale per Windows orientato a **leggerezza, privacy e controllo locale**, pensato anche per hardware datato.

## Obiettivi V1

- Motore Gecko/Firefox per compatibilità WebExtensions e buona efficienza.
- Interfaccia dark.
- Navigazione normale con cronologia, preferiti, download, password e profili.
- Add-on Firefox standard.
- Pulsante indipendente per blocco pubblicità/tracker.
- Modalità:
  - **NORMAL** — compatibilità e persistenza normali.
  - **TURBO** — riduzione aggressiva di traffico, CPU e RAM.
  - **PRIVATE** — isolamento e anti-tracking rafforzati.
  - **GHOST** — sessione separata e non persistente, protezioni privacy più aggressive.
- Limite globale di **massimo 3 schede/finestre attive in background**; le altre vengono sospese/scaricate dalla RAM quando possibile.
- Nessuna telemetria proprietaria del progetto.

## Principio privacy

L'obiettivo non è promettere "invisibilità" assoluta, che non è tecnicamente possibile. Il browser deve invece ridurre in modo misurabile tracking, storage cross-site, fingerprinting e dispersione di metadati senza introdurre combinazioni troppo uniche.

La modalità GHOST non viene presentata come equivalente a Tor Browser. Un eventuale percorso Tor dovrà usare un profilo separato e rispettare i limiti di fingerprinting propri di Tor.

## Target iniziale

- Windows 10/11 64 bit.
- Hardware di riferimento: PC con CPU Intel Core i3 di vecchia generazione.
- Priorità: avvio rapido, consumo contenuto di RAM, sospensione tab, minimo lavoro in background.

## Strategia di sviluppo

Non si duplica l'intero sorgente Mozilla nella repository in questa fase. La V1 viene costruita come distribuzione/configurazione controllata sopra Gecko/Firefox, con componenti nostri per profili, modalità, policy, UI e diagnostica delle risorse. Questo permette iterazioni molto più rapide e una base testabile.

Vedi [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) e [config/defaults.json](config/defaults.json).
