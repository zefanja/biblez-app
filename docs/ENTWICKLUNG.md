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
pnpm e2e
```

Alles auf einmal (Typen, Unit-Tests, Browser-Test):

```bash
pnpm check
```

Anki-Kompatibilität (einmalig `python3 -m venv .venv && .venv/bin/pip install anki`):

```bash
pnpm verify:anki
```

`verify:anki` erzeugt eine Beispiel-`.apkg` mit 30 Tagen simuliertem
Lernverlauf, importiert sie in eine frische Anki-Sammlung mit FSRS und
vergleicht jede Karte: Zustand, Fälligkeit, Stabilität, Schwierigkeit,
Verlauf, ausgesetzte Stufen, Duplikate bei erneutem Import.

## Android

Das native Projekt liegt in `apps/client/android/` (Capacitor 7, minSdk 23,
targetSdk 35, App-ID `de.biblez.app`). Voraussetzungen: JDK 21 und das
Android SDK (Plattform 35, Build-Tools 34/35) – in der Cloud-Umgebung
„BibleZ" installiert das Setup-Skript beides nach `/opt/android-sdk`.

Debug-APK bauen (Web-Build → `cap sync` → Gradle):

```bash
pnpm android:apk
```

Ergebnis: `apps/client/android/app/build/outputs/apk/debug/app-debug.apk`
(≈14 MB, mit Debug-Schlüssel signiert, alle sechs Bibelübersetzungen enthalten).

### Release (signiert)

Einmalig auf **deinem eigenen Rechner** den Upload-Schlüssel erzeugen. Das
Skript fragt ein Passwort ab, legt `~/.biblez/biblez-upload.jks` an und
schreibt `apps/client/android/keystore.properties` (git-ignoriert):

```bash
pnpm android:keystore
```

Danach App Bundle (Google Play) und APK (direkte Installation) bauen:

```bash
pnpm android:release
```

Ergebnis in `dist-android/`: `BibleZ-<version>.aab` und `.apk`; das Skript
zeigt Zertifikat und SHA-256 der Signatur. Ohne Schlüssel entsteht ein
unsignierter Build mit Warnung.

- **Google Play App Signing** verwenden: Google verwaltet den eigentlichen
  App-Signaturschlüssel, unser Schlüssel ist nur der *Upload-Schlüssel* und
  kann bei Verlust über die Play Console zurückgesetzt werden.
- `.jks` und Passwort sicher aufbewahren (Passwortmanager) – **nie** ins Repo.
- Für eine Build-Pipeline statt der Datei Umgebungsvariablen setzen:
  `BIBLEZ_KEYSTORE_FILE`, `BIBLEZ_KEYSTORE_PASSWORD`, `BIBLEZ_KEY_ALIAS`,
  `BIBLEZ_KEY_PASSWORD`; optional `BIBLEZ_VERSION_CODE`.
- Version: `version` in der Root-`package.json` (1.2.3 → versionCode 10203).

### Teilen

Anki-Export und Backup öffnen in der App das System-Teilen-Menü
(`@capacitor/share`, Datei im App-Cache über `@capacitor/filesystem`) – von
dort direkt an AnkiDroid, Drive, Mail … Im mobilen Browser wird die Web
Share API genutzt, am Desktop heruntergeladen (`apps/client/src/share.ts`).

Noch offen: natives SQLite statt IndexedDB, lokale Erinnerungen.

## App-Icon

Motiv „Spross im Herzen“ (Ps 119,11 + Lk 8,11). Master-Grafiken in
`design/icon/`:

| Datei | Zweck |
|-------|-------|
| `icon-full.svg` | iOS, Play Store, PWA, alte Android-Launcher – Herz so groß wie möglich |
| `icon-foreground.svg` | Android adaptive Icon (108 dp, Herz im 66-dp-Sicherheitskreis) |
| `icon-monochrome.svg` | Android 13+ Themed Icon |
| `icon-maskable.svg` | PWA maskable (80-%-Sicherheitskreis) |
| `favicon.svg` | Browser-Tab, abgerundete Kachel |

Nach einer Änderung alle PNGs neu erzeugen (Android-Launcher, Splash, Web,
Store-Grafiken in `design/icon/out/`):

```bash
pnpm icons
```

## iOS

Braucht einen Mac mit Xcode:

```bash
cd apps/client && npx cap add ios && npx cap open ios
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
