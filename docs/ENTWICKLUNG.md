# BibleZ – Entwicklung

Monorepo (pnpm) für die BibleZ-App (Web, iOS, Android). Das Anki-Add-on
„Bible Memorizer“ liegt in einem eigenen Repo:
[zefanja/bible-memorizer](https://github.com/zefanja/bible-memorizer). Der
Notiztyp in `packages/core/src/anki/notetype.ts` ist eine Kopie aus dessen
`src/model.py` (Version 1.5) und muss bei Änderungen dort mitgezogen werden.

```
packages/core   Logik ohne UI: Abschnitte, Stufen-Engine, FSRS, Anki-Export, SQLite-Store
apps/client     React + Vite (Web/PWA), Capacitor für iOS/Android
tools/          anki_verify.py – prüft Exporte mit dem echten Anki
docs/planung    Produkt-Steckbrief
```

## Loslegen

```bash
pnpm install
```

Bibeltexte erzeugen (lädt beim ersten Mal ~55 MB Quellen nach `.cache/bibles`,
prüft die SHA-256-Summen und schreibt `apps/client/public/bibles/`):

```bash
pnpm bibles
```

```bash
pnpm dev
```

Dann `http://localhost:5173/` öffnen. Die Daten liegen im Browser
(SQLite via sql.js, gespeichert in IndexedDB).

## Tests

```bash
pnpm --filter @biblez/core test
```

Browser-Test (baut die App und klickt sie in Chromium durch):

```bash
pnpm --filter @biblez/client build && node apps/client/e2e/smoke.mjs
```

Anki-Kompatibilität (braucht das Python-Paket `anki`, z. B. in `.venv`):

```bash
pnpm verify:anki
```

`verify:anki` erzeugt eine Beispiel-`.apkg` mit 30 Tagen simuliertem
Lernverlauf, importiert sie in eine frische Anki-Sammlung mit FSRS und
vergleicht jede Karte: Zustand, Fälligkeit, Stabilität, Schwierigkeit,
Verlauf, ausgesetzte Stufen, Duplikate bei erneutem Import.

## iOS und Android (Capacitor)

Die Konfiguration liegt in `apps/client/capacitor.config.ts`. Die nativen
Projekte werden auf einem Rechner mit Xcode bzw. Android Studio erzeugt:

```bash
cd apps/client && pnpm build && npx cap add ios && npx cap add android
```

```bash
npx cap sync && npx cap open ios
```

## Bibeltexte

| ID | Übersetzung | Quelle | Lizenz |
|----|-------------|--------|--------|
| `lut1912` | Luther 1912 | seven1m/open-bibles (OSIS) | gemeinfrei |
| `sch1951` | Schlachter 1951 | scrollmapper/bible_databases (JSON) | gemeinfrei |
| `elb1905` | Elberfelder 1905 (unrevidiert) | scrollmapper/bible_databases (JSON) | gemeinfrei |
| `kjv` | King James Version | seven1m/open-bibles (OSIS) | gemeinfrei, außer UK (Crown Copyright) |
| `bsb` | Berean Standard Bible | seven1m/open-bibles (USFX) | gemeinfrei (CC0, seit 2023) |
| `web` | World English Bible | seven1m/open-bibles (USFX) | gemeinfrei |

Quellen sind auf einen Commit festgelegt und per SHA-256 geprüft
(`packages/core/scripts/build-bibles.ts`). Eine weitere Übersetzung = ein
Eintrag in `SOURCES`, sofern ihr Format (OSIS, USFX, scrollmapper-JSON)
schon unterstützt wird. Die erzeugten Dateien werden nicht eingecheckt.

## Wichtige Regeln im Code

- **Jede geplante Karte = eine Anki-Karte.** Neue Übungsformen sind
  Antwortmodi, keine neuen Karten.
- **Wiederholungen werden nur angehängt.** Der Kartenzustand wird immer aus
  dem Verlauf berechnet (`replay`), nie direkt gespeichert.
- **Eine Stufe nach der anderen:** Stufe n+1 wird am Folgetag aktiv, sobald
  Stufe n eine Stabilität ≥ 7 Tage hat; Stufe n ruht dann.
- **Anki-IDs (Notiz, Karte, GUID) werden einmal vergeben und nie geändert**,
  damit wiederholte Exporte keine Duplikate erzeugen.
