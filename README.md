# Browser

Browser personale standalone per Windows, orientato a **leggerezza, privacy e controllo locale**, pensato anche per hardware datato.

## Prodotto

Questo repository costruisce un **browser completo e distribuibile**, non una semplice estensione.

La base di rendering è Gecko/Firefox per mantenere:
- compatibilità con addon Firefox/WebExtensions;
- cronologia, preferiti, download, password e profili;
- sandbox e compatibilità web mature.

Il pacchetto finale deve includere il runtime browser, le policy, i profili, il tema, il launcher e i componenti interni necessari. L'utente non deve installare manualmente l'estensione di progetto.

## Funzioni V1

- UI dark.
- Finestre e schede normali.
- Cronologia, preferiti, download e password.
- Addon Firefox normali.
- Pulsante ADS ON/OFF integrato.
- Modalità:
  - **NORMAL** — compatibilità e persistenza normali.
  - **TURBO** — riduzione aggressiva di CPU, RAM e traffico.
  - **PRIVATE** — isolamento e anti-tracking rafforzati.
  - **GHOST** — profilo separato, minima persistenza e protezioni privacy più aggressive.
- Limite globale di massimo **3 attività background** in NORMAL e massimo **2** in TURBO/PRIVATE/GHOST.
- Sospensione/scaricamento dalla RAM delle schede eccedenti quando Gecko lo consente.
- Nessuna telemetria proprietaria.

## Architettura

```text
Browser.exe
   |
   +-- runtime Gecko/Firefox incluso
   |
   +-- distribution/
   |     +-- policies
   |     +-- configurazione
   |
   +-- profili NORMAL/TURBO/PRIVATE/GHOST
   |
   +-- componente interno
         +-- gestione tab/RAM
         +-- ADS ON/OFF
         +-- tema/UI
         +-- diagnostica
```

La cartella `extension/` contiene **un componente interno del browser**. Non è il prodotto finale e non deve essere installato separatamente dall'utente.

## Privacy

Non viene promessa "invisibilità" assoluta. L'obiettivo è ridurre in modo misurabile tracking, fingerprinting, storage cross-site e dispersione di metadati senza creare fingerprint casuali e troppo unici.

GHOST non viene dichiarata equivalente a Tor Browser.

## Target

- Windows 10/11 64 bit.
- Hardware di riferimento: Intel Core i3 di vecchia generazione.
- Priorità: avvio rapido, poca RAM, poco lavoro in background.

Vedi [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
