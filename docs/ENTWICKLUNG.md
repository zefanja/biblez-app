# BibleZ – Entwicklung

Monorepo (pnpm) für die BibleZ-App (Web, iOS, Android). Das Anki-Plugin in
`src/` und das alte Web-Tool in `app/` bleiben unverändert daneben.

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

Anki-Kompatibilität (braucht `pip install anki`):

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

## Wichtige Regeln im Code

- **Jede geplante Karte = eine Anki-Karte.** Neue Übungsformen sind
  Antwortmodi, keine neuen Karten.
- **Wiederholungen werden nur angehängt.** Der Kartenzustand wird immer aus
  dem Verlauf berechnet (`replay`), nie direkt gespeichert.
- **Eine Stufe nach der anderen:** Stufe n+1 wird am Folgetag aktiv, sobald
  Stufe n eine Stabilität ≥ 7 Tage hat; Stufe n ruht dann.
- **Anki-IDs (Notiz, Karte, GUID) werden einmal vergeben und nie geändert**,
  damit wiederholte Exporte keine Duplikate erzeugen.
