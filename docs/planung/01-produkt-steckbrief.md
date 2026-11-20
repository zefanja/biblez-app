# Bible Memorizer App – Produkt-Steckbrief

Status: **Entwurf v0.1** · Stand: 2026-11-20

Dieses Dokument hält die bisherigen Entscheidungen fest, leitet daraus das
Lernkonzept, das Datenmodell und den MVP-Umfang ab und listet die offenen Fragen.

---

## 0. Entscheidungen bisher

| # | Frage | Entscheidung |
|---|-------|--------------|
| E1 | Einzelverse oder ganze Kapitel? | **Beides**, der Nutzer entscheidet pro Sammlung |
| E2 | Allein oder in Gruppen? | **Allein**; Gruppen kommen später, das Datenmodell bereitet sie vor |
| E3 | Woher kommen die Bibeltexte? | **Nur frei verfügbare Übersetzungen** plus **eigene Texte einfügen** |
| E4 | Anki-Kompatibilität | **Export auf Knopfdruck, mit Lernverlauf** |

---

## 1. Vision

> Bibelverse und ganze Abschnitte auswendig lernen, so einfach wie eine
> Wetter-App zu bedienen und so wirksam wie Anki mit FSRS. Die eigenen Daten
> kann man jederzeit mitnehmen.

**Ausdrücklich keine Ziele (vorerst):**
- Bibel-Lese-App, Kommentare oder Andachten
- Live-Sync mit Anki/AnkiWeb (dafür gibt es keine offizielle Schnittstelle)
- Geschützte Übersetzungen ohne Lizenz
- Werbung oder Tracking

---

## 2. Zielgruppen

| Persona | Beschreibung | Was sie braucht |
|---------|--------------|-----------------|
| **Einsteigerin „Lena"** | Will pro Woche einen Vers lernen, hat Anki nie benutzt | Ohne Anmeldung loslegen, einen Vers auswählen, in 2 Minuten das erste Erfolgserlebnis, tägliche Erinnerung |
| **Kapitel-Lerner „Markus"** | Lernt Psalm 23, Römer 8, die Bergpredigt | Lange Abschnitte bequem anlegen, Recite-Modus, Überblick über den Fortschritt pro Vers |
| **Anki-Umsteiger „Jonas"** | Nutzt das Plugin schon, will unterwegs am Handy lernen | Export (und später Import) mit Verlauf, FSRS-Einstellungen, 4 Bewertungsknöpfe optional |

---

## 3. Begriffe (gemeinsame Sprache für Design und Code)

| Begriff | Bedeutung | Entspricht in Anki |
|---------|-----------|--------------------|
| **Sammlung** | Ein Vers oder ein Abschnitt (z. B. „Joh 3,16" oder „Psalm 23") mit Titel und Übersetzung | Deck bzw. Titel-Feld |
| **Abschnitt** (Segment) | Eine lernbare Einheit: ein Vers oder ein Versteil (7a, 7b …) | Notiz |
| **Kartentyp** | *Was* gefragt wird (Hilfestufe) | Kartenvorlage (Card 1–4) |
| **Antwortmodus** | *Wie* geantwortet wird (aufdecken, tippen, später sprechen) | gibt es in Anki nicht, nur in der App |
| **Karte** | Abschnitt × Kartentyp, die Einheit, die FSRS plant | Karte |
| **Wiederholung** | Ein Lernereignis (Zeitpunkt, Bewertung, Dauer, Modus) | revlog-Eintrag |

**Grundsatz:** Jede Einheit, die die App plant, entspricht genau einer
Anki-Karte. Neue Übungsformen kommen deshalb als neuer **Antwortmodus**
dazu, nicht als neue Karte. So bleibt der Export immer verlustfrei.

---

## 4. Lernkonzept

### 4.1 Hilfestufen (aus dem Plugin übernommen)

| Stufe | Kartentyp | Vorderseite | Anki |
|-------|-----------|-------------|------|
| 1 | Wortenden ausgeblendet | Kontext + `Im Anfan_ wa_ da_ Wor_` | Card 1 |
| 2 | Anfangsbuchstaben | Kontext + `I A w d W` | Card 2 |
| 3 | Nur Kontext / Stelle | Kontext (vorherige Verse) bzw. bei Einzelversen nur die Stelle | Card 4 |
| (opt.) | Übersicht | Tabelle mit den Anfangsbuchstaben des ganzen Abschnitts (ab 5 Versen) | Card 3 |

Bei einer Sammlung mit **einem einzigen Vers** zeigt Stufe 3 nur Titel und
Stelle. Sie ist damit automatisch eine Karte „Stelle → Text". Dafür muss am
Notiztyp nichts geändert werden.

### 4.2 Schrittweise Freischaltung (die App versteckt die Anki-Komplexität)

- Neue Abschnitte beginnen auf Stufe 1. Stufe *n+1* wird erst
  **freigeschaltet**, wenn die Stabilität der Karte auf Stufe *n* einen
  Schwellenwert erreicht (Vorschlag: ≥ 3 Tage; einstellbar).
  Im „Anki-Modus" sind alle Stufen sofort aktiv.
- Die Oberfläche zeigt pro Vers nur „Stufe 2 von 3" und eine
  Fortschrittsanzeige, keine einzelnen Karten.
- Bei Fehlern auf einer höheren Stufe wird die Karte nur neu geplant;
  es gibt kein automatisches Zurückstufen (hält das FSRS-Modell sauber).
- Karten derselben Abschnitts erscheinen nicht am selben Tag (wie das
  „Burying" von Geschwisterkarten in Anki).

### 4.3 FSRS

- Bibliothek: [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)
  (die offizielle TypeScript-Umsetzung).
- Startet mit Standardparametern; Zielquote (Desired Retention) einstellbar,
  Standard 0,9.
- Später: Parameter pro Nutzer optimieren (fsrs-rs als WASM), sobald
  genug Wiederholungen (≈ 400+) vorliegen.
- Tageslimit für neue Abschnitte (Standard: 5) und eine Vorschau, wie viele
  Wiederholungen in den nächsten 7 Tagen anstehen.

### 4.4 Antwortmodi

| Modus | MVP | Bewertung |
|-------|-----|-----------|
| **Aufdecken + selbst bewerten** | ✅ | Knöpfe: Standard 2 (Nochmal/Gut), optional 4 |
| **Anfangsbuchstaben tippen** | ✅ (Vorschlag) | automatisch: 0 Fehler → Gut, 1–2 → Schwer, mehr → Nochmal; Nutzer kann korrigieren |
| Wörter ordnen | später | automatisch |
| Laut aufsagen (Spracherkennung) | später | automatisch |

### 4.5 Recite-Modus

Wird aus dem Plugin übernommen: Der Abschnitt wird Vers für Vers aufgedeckt,
die Hilfestufe richtet sich nach dem Lernstand. **Kein Einfluss auf die
Planung** (wie bisher).

---

## 5. Bibeltexte

### 5.1 Mitgelieferte, frei verfügbare Übersetzungen (Kandidaten; **Lizenz jeweils prüfen**)

| Sprache | Übersetzung | Hinweis |
|---------|-------------|---------|
| DE | Luther 1912 | gemeinfrei |
| DE | Schlachter 1951 | gemeinfrei (nicht die Schlachter 2000!) |
| DE | Elberfelder 1905 | gemeinfrei (nicht die revidierte Fassung!) |
| DE | Menge 1939 | Status prüfen |
| EN | Berean Standard Bible (BSB) | seit 2023 gemeinfrei, modernes Englisch |
| EN | World English Bible (WEB) | gemeinfrei |
| EN | King James Version | in Großbritannien unter Crown Copyright, sonst gemeinfrei |
| EN | ASV 1901 | gemeinfrei |

Mögliche Quellen: eBible.org, Zefania-XML- oder SWORD-Module (Lizenz je
Modul prüfen). Übersetzungen werden **bei Bedarf heruntergeladen**
(≈ 1–2 MB komprimiert), nicht in die App eingebaut.

### 5.2 Sammlung anlegen

1. **Stelle eingeben:** „Joh 3,16", „Ps 23", „Röm 8,28-39". Dafür braucht es
   einen Parser für Stellenangaben mit deutschen und englischen Buchnamen und
   Abkürzungen.
2. **Eigenen Text einfügen:** Der vorhandene Auto-Formatter
   (`app/js/formatter.js`) erkennt die Versnummern.
3. **Lange Verse** schlägt die App zur Teilung an Satzzeichen vor; der Nutzer
   kann das anpassen.

### 5.3 Regeln

- Eigene Texte bleiben privat. Teilen nur als Datei, und der Nutzer ist
  verantwortlich für die Rechte.
- Öffentliches Teilen (später) nur für Sammlungen aus freien Übersetzungen.
- Wechsel der Übersetzung = neue Sammlung (bewusst einfach; die Versnummerierung
  unterscheidet sich teilweise zwischen Übersetzungen).

---

## 6. Anki-Export mit Lernverlauf

### 6.1 Abbildung

| App | Anki (`collection.anki2`, Schema v11) |
|-----|---------------------------------------|
| Sammlung | Deck `Bible Memorizer::<Titel>` |
| Abschnitt | Notiz vom Typ „Bible Memorizer" (10 Felder, unverändert) |
| Karte | Karte (ord 0–3 = Card 1–4) |
| FSRS-Zustand | `cards.type/queue/due/ivl/reps/lapses` + `cards.data` = `{"s":…, "d":…}` |
| Wiederholung | `revlog` (id = Zeitstempel in ms, ease 1–4, ivl, time in ms, type) |
| Noch nicht freigeschaltete Karte | neue Karte (type 0) |

Die HTML-Felder (`table`, `front`, `back`, `first_letters` …) werden **erst
beim Export** aus den Daten erzeugt. In der App liegen nur strukturierte Daten.

### 6.2 Regeln, damit wiederholter Export keine Duplikate erzeugt

- Jede Notiz bekommt beim Anlegen eine **stabile GUID**; Notiz- und Karten-IDs
  werden einmal vergeben und gespeichert.
- Der Notiztyp „Bible Memorizer" bekommt eine **feste ID**, damit Anki ihn
  wiedererkennt und keine Kopien wie „Bible Memorizer-1a2b" anlegt.
- **Grenze, die wir offen kommunizieren:** Anki überschreibt beim erneuten
  Import den Lernstand vorhandener Karten nicht. Der Export ist eine
  *Übergabe* („ab jetzt in Anki weiterlernen") oder ein Import in ein leeres
  Profil, kein fortlaufender Sync.

### 6.3 Muss vorab getestet werden (technischer Test 1)

- Liest das aktuelle Anki (Desktop, AnkiDroid, AnkiMobile) mit
  eingeschaltetem FSRS `cards.data` aus einem Legacy-apkg, oder rechnet es
  den Zustand aus dem revlog neu?
- Wie werden Fälligkeitsdaten von Review-Karten (`due` = Tage seit
  `col.crt`) beim Import umgerechnet?
- Welche Werte erwartet Anki im revlog für `factor` und `type` bei FSRS?
- Lernschritte: Die App plant rein mit FSRS, auch kurzfristig. Wie sieht ein
  importierter Lernstand in Anki aus, wenn dort Lernschritte eingestellt sind?

---

## 7. Datenmodell (Entwurf)

```
translation   (id, name, language, license, versification, source_url)
collection    (id, title, kind[verse|passage], translation_id?, source[bundled|custom],
               settings{context_lines, overview_table, unlock_threshold},
               anki_deck_id, owner_id, created_at, updated_at, deleted_at)
segment       (id, collection_id, position, verse_number, part_letter, text,
               anki_note_id, anki_guid, updated_at, deleted_at)
card          (id, segment_id, card_type[1..4], anki_card_id, unlocked_at,
               -- Cache, jederzeit aus review berechenbar:
               state, due, stability, difficulty, reps, lapses, last_review)
review        (id[ULID], card_id, reviewed_at, rating[1..4], answer_mode,
               duration_ms, device_id)            -- nur anhängen, nie ändern
fsrs_config   (version, params[], desired_retention, updated_at)
```

**Wichtig für die Architektur:** `review` ist ein Protokoll, an das nur
angehängt wird. Der Kartenzustand ist eine Ableitung davon. Daraus folgt:
- Anki-Export mit vollständigem Verlauf ist trivial.
- Sync zwischen Geräten (später) ist nahezu konfliktfrei: Wiederholungen
  zusammenführen und Zustand neu berechnen.
- Neue FSRS-Parameter oder ein Bugfix im Planer lassen sich durch Neuberechnung
  rückwirkend anwenden.
- `owner_id` ist von Anfang an vorhanden, damit Gruppen (E2) später ohne
  Umbau möglich sind.

---

## 8. Architektur (Empfehlung, Entscheidung offen)

```
monorepo (pnpm)
├── packages/core      TypeScript, ohne Abhängigkeit von UI oder Plattform
│   ├── parse/         Formatter, Segmentierung (Intl.Segmenter), Stellen-Parser
│   ├── cards/         Erzeugung der Kartentypen (Port von gen_notes)
│   ├── scheduler/     ts-fsrs + Freischaltregeln + Tageslimits
│   ├── store/         Repository-Schnittstelle (SQLite)
│   └── anki/          apkg-Export (Port von app/js/apkg.js, + revlog)
├── apps/client        eine Oberfläche für Web, iOS und Android
└── tools/bibles       Import der freien Übersetzungen in ein kompaktes Format
```

- **Offline zuerst**, lokale SQLite-Datenbank auf allen Plattformen.
- **Oberfläche, Option A:** Web-App (React oder Svelte) + **Capacitor**
  für iOS und Android. Der vorhandene Web-Code lässt sich am meisten
  wiederverwenden, und die App ist am schnellsten fertig.
- **Oberfläche, Option B:** **Expo / React Native** (+ Expo Web). Fühlt sich
  nativer an, das Web ist etwas schwächer.
- Version 1 ohne Server: Backup und Wiederherstellung als Datei.
  Sync als nächster Ausbauschritt (siehe offene Fragen).

---

## 9. Umfang

### MVP (v1.0)
- [ ] Sammlung anlegen: Stelle aus freier Übersetzung **oder** eigener Text
- [ ] Lernen mit Stufen 1–3 (+ Übersichtstabelle optional), schrittweise Freischaltung
- [ ] Antwortmodi: Aufdecken, Anfangsbuchstaben tippen
- [ ] FSRS mit Standardparametern, Zielquote und Tageslimit einstellbar
- [ ] Startseite „Heute": fällige Wiederholungen, neue Verse, Fortschritt
- [ ] Recite-Modus
- [ ] **Anki-Export mit Verlauf**
- [ ] Backup/Restore als Datei
- [ ] Oberfläche DE/EN, Dunkelmodus, Schriftgröße
- [ ] Lokale tägliche Erinnerung (iOS/Android)

### Später
Sync und Konten · Anki-Import (Plugin-Nutzer mitnehmen) · FSRS-Optimierung ·
Spracherkennung · Vorlesen (Audio) · Wörter ordnen · Sammlungen teilen ·
Gruppen und Klassen · weitere Sprachen · Homescreen-Widgets

---

## 10. Offene Fragen

**Runde 2 (als Nächstes zu klären):**
1. Antwortmodi im MVP: Aufdecken + Anfangsbuchstaben tippen in Ordnung?
2. Bewertung: 2 Knöpfe als Standard, 4 optional?
3. Sync zwischen Geräten schon in v1 oder erst v1.1?
4. Technik: Welche Vorkenntnisse sind da (Web/React/Svelte/TS)? Entscheidung
   zwischen Capacitor und Expo.
5. Sprachen der Oberfläche und der Bibeltexte im MVP: nur DE/EN?
6. Bibelstelle mitlernen: bei Einzelversen immer, bei Abschnitten optional?
7. Geschäftsmodell: kostenlos/Spenden? Open Source?
8. Lizenz: Das Repo steht unter **GPLv3**. GPL und die Bedingungen des
   App Store vertragen sich nicht gut (bekannter Fall: VLC). Wenn du alle
   Rechte am Code hast, kannst du die App doppelt lizenzieren oder eine andere
   Lizenz wählen. Wer hat zu `app/` beigetragen?
9. App-Name: Ist „Bible Memorizer" in den Stores noch frei?
10. Sollen Kinder und Jugendliche (unter 16) die App nutzen? (Datenschutz, Kategorie im Store)

---

## 11. Nächste Schritte

1. Runde 2 beantworten → Steckbrief v0.2
2. **Technischer Test 1:** apkg mit revlog und FSRS-Zustand erzeugen und in
   Anki Desktop, AnkiDroid und AnkiMobile importieren (siehe 6.3)
3. **Technischer Test 2:** Segmentierung und Anfangsbuchstaben für alle
   Zielsprachen (Intl.Segmenter)
4. Lizenzen der freien Übersetzungen prüfen, Quellformat festlegen
5. Nutzerabläufe und Wireframes: Einstieg, „Heute", Lernen, Sammlung anlegen, Export
6. Klickbarer Prototyp → Test mit 5 Personen aus der Zielgruppe
