# Bible Memorizer App – Produkt-Steckbrief

Status: **v0.5** (Planung abgeschlossen, Umsetzung begonnen) · Stand: 2026-11-20

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
| E5 | Antwortmodus im MVP | **Aufdecken + selbst bewerten** |
| E6 | Bewertungsknöpfe | **Nur „Nochmal" / „Gut"** (in Anki: ease 1 / 3) |
| E7 | Sync zwischen Geräten | **Später** (v1: lokal + Backup als Datei) |
| E8 | Wer programmiert? | **LLM (Claude)** → Stack, der sich in der Cloud automatisch testen lässt |
| E9 | Sprachen im MVP | **Deutsch + Englisch** (Oberfläche und Bibeltexte) |
| E10 | Bibelstelle mitlernen | **Ja**: bei Einzelversen immer, bei Abschnitten optional |
| E11 | Lizenz | Code gehört komplett dem Autor; Empfehlung **MIT**, siehe Abschnitt 12 |
| E12 | Kinder unter 16 | **Ja** → Datenschutz nach Abschnitt 13 |
| E13 | Stil | **Ruhig und freundlich** (siehe Abschnitt 14) |
| E14 | Startseite | **„Heute"**; Tabs: Heute · Verse · Einstellungen |
| E15 | Erster Start | Sofort lernen mit **Johannes 3,16**, ohne Einstellungen |
| E16 | Motivation | **Kein Streak**; Kennzahl „Sicher im Gedächtnis" |
| E17 | Name | **BibleZ** |
| E18 | Geld | Vorerst **kostenlos**; Spenden ggf. später |
| E19 | Abschnittslänge | **Kurze Abschnitte**, 3–7 Wörter (4.2) |
| E20 | Stufen | **Eine Stufe nach der anderen**, keine Geschwister am selben Tag (4.3) |
| E21 | Lizenz | **MIT** bestätigt |
| E22 | Dunkelmodus, Schriftgröße | **In v1** |
| E23 | Übersichtstabelle | **Entfällt** (keine Option beim Anlegen; Card 3 wird nie erzeugt) |
| E24 | Noch gesperrte Stufen im Export | als **neue** Karten (Anki führt sie nach seinen eigenen Regeln ein) |

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
| **Anki-Umsteiger „Jonas"** | Nutzt das Plugin schon, will unterwegs am Handy lernen | Export (und später Import) mit Verlauf, FSRS-Einstellungen |
| **Schülerin „Mia" (12)** | Lernt Verse für Schule oder Jungschar | Große, klare Bedienung, keine Anmeldung, keine Daten, die das Gerät verlassen |

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

Bei einer Sammlung mit **einem einzigen Vers** zeigt Stufe 3 nur Titel und
Stelle. Sie ist damit automatisch eine Karte „Stelle → Text". Dafür muss am
Notiztyp nichts geändert werden.

### 4.2 Kurze Abschnitte (Chunks)

- Verse werden automatisch in **kurze Abschnitte** geteilt: an Satzzeichen
  (`,` `;` `:` `.`), Ziel **3–7 Wörter**, höchstens etwa 8. Ein Abschnitt
  mit weniger als 3 Wörtern wird mit dem Nachbarn zusammengelegt.
- Beispiel Joh 3,16 (Luther 1912), 5 Abschnitte:
  a „Also hat Gott die Welt geliebt," · b „daß er seinen eingebornen Sohn gab," ·
  c „auf daß alle, die an ihn glauben," · d „nicht verloren werden," ·
  e „sondern das ewige Leben haben."
- Der Nutzer kann die Teilung vor dem Anlegen anpassen (Abschnitte trennen oder zusammenlegen).
- Jeder Abschnitt ist eine Anki-Notiz (`verse_part` a, b, c …). Als Kontext
  zeigt die Vorderseite die bis zu 2 vorherigen Abschnitte, wie im Plugin.

### 4.3 Eine Stufe nach der anderen

- **Pro Abschnitt ist immer genau eine Stufe aktiv.** Geschwisterkarten
  (derselbe Abschnitt, andere Stufe) kommen nie am selben Tag.
- Neue Abschnitte beginnen auf Stufe 1. Am ersten Tag gibt es also nur
  Stufe 1. „Nochmal" holt die Karte in derselben Sitzung zurück.
- **Aufstieg:** Erreicht die Karte auf Stufe *n* eine Stabilität von
  **≥ 7 Tagen** (≈ 2–3 erfolgreiche Wiederholungen), wird Stufe *n+1*
  freigeschaltet und ab dem nächsten Tag fällig.
- **Die alte Stufe ruht** (wird in Anki als *ausgesetzt*/suspended
  exportiert). Das hält die Zahl der Wiederholungen niedrig. Jede Karte
  behält ihren eigenen FSRS-Verlauf, das Modell bleibt also sauber.
- **Kein automatisches Zurückstufen.** Wenn auf der höheren Stufe zweimal
  hintereinander „Nochmal" gedrückt wird, bietet die App an, die vorherige
  Stufe als Hilfe zurückzuholen.
- **„Sicher im Gedächtnis":** Der Vers ist auf Stufe 3 angekommen, und alle
  seine Abschnitte haben dort eine Stabilität ≥ 21 Tage (wie die Schwelle
  „mature" im Plugin).
- Die Oberfläche zeigt pro Vers nur „Stufe 2 von 3" und eine
  Fortschrittsanzeige, keine einzelnen Karten.
- Im „Anki-Modus" (Einstellung für Fortgeschrittene) sind alle Stufen sofort aktiv.

### 4.4 FSRS

- Bibliothek: [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)
  (die offizielle TypeScript-Umsetzung).
- Startet mit Standardparametern; Zielquote (Desired Retention) einstellbar,
  Standard 0,9.
- Später: Parameter pro Nutzer optimieren (fsrs-rs als WASM), sobald
  genug Wiederholungen (≈ 400+) vorliegen.
- Tageslimit für neue Abschnitte (Standard: 5) und eine Vorschau, wie viele
  Wiederholungen in den nächsten 7 Tagen anstehen.

### 4.5 Antwortmodi

| Modus | MVP | Bewertung |
|-------|-----|-----------|
| **Aufdecken + selbst bewerten** | ✅ | Zwei Knöpfe: **Nochmal** / **Gut** |
| Anfangsbuchstaben tippen | später | Nutzer bewertet weiterhin selbst; das Tippen ist nur eine Hilfe |
| Wörter ordnen | später | Nutzer bewertet selbst |
| Laut aufsagen (Spracherkennung) | später | offen |

Mit nur zwei Knöpfen bleibt FSRS voll funktionsfähig. Im Anki-Export
erscheinen die Bewertungen als ease 1 (Again) und 3 (Good).

### 4.6 Recite-Modus

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

### 6.3 Technischer Test 1: Ergebnis ✅ (Anki 26.09.4)

Geprüft mit `tools/anki_verify.py`: Export von 25 Abschnitten mit 30 Tagen
simuliertem Lernverlauf (392 Wiederholungen), Import in eine frische
Sammlung mit FSRS.

- Alle Notizen, Karten und Wiederholungen kommen an; Decks `BibleZ::<Titel>`.
- FSRS-Zustand wird aus `cards.data` übernommen (`s`, `d`, `dr`, `decay`, `lrt`),
  Stabilität und Schwierigkeit stimmen auf 0,01 genau.
- Fälligkeiten: Review-Karten als Tag relativ zu `col.crt`; der Importer
  rechnet sie korrekt auf die Ziel-Sammlung um. Lernkarten als Unix-Zeit.
- Ruhende Stufen kommen als *ausgesetzt* an; keine Card-3-Karten.
- Anki's Datenbank-Check ändert keine Karte.
- Erneuter Import erzeugt keine Duplikate und keinen zweiten Notiztyp.
- Gefundener und behobener Fehler: revlog-IDs müssen chronologisch vergeben
  werden (sonst verschieben sich Zeitstempel).

Ursprüngliche Fragen:

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
               learn_reference,
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

## 8. Architektur (entschieden)

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

- **TypeScript + React + Vite**, als Web-App/PWA, mit **Capacitor** für
  iOS und Android. Eine Codebasis, ein DOM.
- **Begründung (E8):** Claude kann die Web-Version in der Cloud-Umgebung
  bauen und mit Playwright automatisch testen. Native Simulatoren gibt es dort
  nicht. Je dünner die native Schicht, desto mehr lässt sich automatisch
  prüfen. React und Capacitor sind außerdem sehr verbreitet und gut dokumentiert.
- **Offline zuerst**, lokale SQLite-Datenbank: im Web per wa-sqlite/OPFS,
  auf dem Handy per Capacitor-SQLite-Plugin, hinter derselben
  Repository-Schnittstelle.
- Native Funktionen über Capacitor: lokale Benachrichtigungen,
  Teilen-Menü (Export an AnkiDroid/AnkiMobile), Dateizugriff für Backups.
- Tests: `core` mit Vitest (Logik, FSRS, Export), Oberfläche mit Playwright,
  Anki-Kompatibilität mit dem Python-Paket `anki` (Import ohne Oberfläche in CI).
- Version 1 ohne Server.

---

## 9. Umfang

### MVP (v1.0)
- [ ] Sammlung anlegen: Stelle aus freier Übersetzung **oder** eigener Text
- [ ] Lernen mit Stufen 1–3, eine Stufe nach der anderen
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

Erledigt in Runde 4: Look passt; kurze Abschnitte und eine Stufe nach der
anderen (4.2, 4.3); Lizenz MIT; Dunkelmodus und Schriftgröße in v1.

Noch offen: Schwellenwerte (7 Tage für den Aufstieg, 21 Tage für „sicher")
mit echten Lerndaten überprüfen.

---

## 11. Stand und nächste Schritte

**Erledigt (Stand 2026-11-20):**
- [x] Technischer Test 1: Anki-Export mit Lernverlauf (siehe 6.3)
- [x] `packages/core`: Abschnitte, Stufen-Engine, FSRS, Export, SQLite-Store, Backup (24 Tests)
- [x] `apps/client`: erste lauffähige Web-Version – erster Start mit Joh 3,16,
      Lernen (Nochmal/Gut), Heute, Meine Verse, Vers hinzufügen (Vorschläge +
      eigener Text), Rezitieren, Einstellungen, Anki-Export, Backup,
      Dunkelmodus, Schriftgröße, DE/EN; Browser-Test grün
- [x] Abschnitte vor dem Anlegen anpassen (teilen per Wort, verbinden)
- Lernschritte für neue Karten: **1 Min. → 10 Min.** (wie Anki). Karten im
  10-Minuten-Schritt kommen am Ende der Runde wieder.
- Reihenfolge: **Wiederholungen gemischt** (für den Tag stabil), neue
  Abschnitte in Textreihenfolge.

**Als Nächstes:**
1. Freie Übersetzungen importieren (Lizenzen prüfen) + Stellenangaben-Parser
2. Capacitor: iOS/Android-Projekte, SQLite-Plugin, lokale Erinnerung, Teilen-Menü für den Export
3. PWA: Offline-Cache (Service Worker), installierbar
4. Test mit 5 Personen aus der Zielgruppe

## 12. Lizenz (Empfehlung)

- **Code: MIT.** Einfach, keine Konflikte mit den App Stores, Beiträge von
  anderen sind unkompliziert, ts-fsrs und sql.js sind ebenfalls MIT.
- Copyleft (GPL/AGPL) verhindert **keine** Kopien in den Stores. Es
  verlangt nur, dass der Quellcode offengelegt wird. Für Store-Apps
  erschwert es dagegen Beiträge von anderen: Ohne Zustimmung aller
  Beitragenden (CLA) oder eine App-Store-Ausnahme darfst du deren Code nicht
  selbst im App Store veröffentlichen.
- **Den Namen und das Logo schützen** (nicht unter die Code-Lizenz stellen,
  Markenhinweis im README). Das verhindert verwechselbare Kopien wirksamer als
  jede Code-Lizenz.
- Falls später ein Sync-Server dazukommt und kein geschlossener gehosteter
  Klon entstehen soll: nur den Server unter **AGPLv3** stellen.
- Bibeltexte haben ihre eigenen Lizenzen; sie sind von der Code-Lizenz
  getrennt (eigene `LICENSE`-Datei pro Übersetzung).
- Frühere Versionen bleiben unter GPLv3; ab dem Wechsel gilt die neue Lizenz.
  (Keine Rechtsberatung.)

## 13. Datenschutz und Kinder (E12)

- **v1 erhebt keine personenbezogenen Daten:** keine Konten, kein Tracking,
  keine Analyse- oder Werbe-SDKs, alles bleibt lokal auf dem Gerät.
  Damit sind DSGVO Art. 8 und COPPA praktisch erledigt.
- Absturzberichte höchstens per Opt-in, ohne Drittanbieter-SDK.
- Externe Links (Lizenzen, Spenden) hinter einer einfachen „Eltern-Hürde"
  oder ganz weglassen.
- Store: Altersfreigabe 4+ bzw. „Jeder". Die Apple-Kategorie „Kinder" erst
  einmal **nicht** wählen (strengere Prüfung, Einschränkungen bei Links),
  aber die Regeln trotzdem einhalten.
- **Sync später:** Konten für Kinder brauchen die Zustimmung der Eltern
  (Deutschland: unter 16; USA: unter 13). Alternative ohne personenbezogene
  Daten: anonymer Sync-Code oder QR-Code statt E-Mail-Konto.

## 14. Gestaltung (Prototyp v0.1)

Prototyp: Design-Canvas „BibleZ Prototyp" (6 Screens, der erste Start ist klickbar).

| Token | Wert | Verwendung |
|-------|------|------------|
| Grund | `#F6F5F1` | Hintergrund |
| Fläche | `#FFFFFF`, Rand `#E4E2DB` | Karten |
| Akzent | `#2C6A63` (tiefes Petrol) | Hauptknöpfe, Fortschritt, Antworttext |
| Akzent hell | `#E3EFEC` | Hinweise, Zweitknöpfe |
| Text | `#1E2321`, gedämpft `#5E6662` | |
| Warnung | `#FBEBDD` / `#8A4B12` | „fällig", Export-Hinweis |
| Oberflächenschrift | Figtree | freundlich, gut lesbar |
| Bibeltext | Literata (Serif) | für langes Lesen gemacht, ruhig |

Grundsätze: große Touch-Flächen (≥ 44 px, Hauptknöpfe 56 px), eine
Hauptaktion pro Screen, keine Emojis, kein Druck (kein Streak, keine roten
Zähler), Bibeltext immer in Serifenschrift.
