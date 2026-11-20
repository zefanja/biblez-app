# BibleZ

Bibelverse auswendig lernen – ein paar Minuten am Tag, ganz in deinem Tempo.
Web-App (PWA) mit iOS- und Android-Version über Capacitor.

- **Kurze Abschnitte** (3–7 Wörter), automatisch geteilt und von Hand anpassbar
- **Drei Hilfestufen** – Wortenden ausgeblendet → Anfangsbuchstaben → nur die Stelle –
  eine Stufe nach der anderen
- **FSRS** als Wiederholungsplaner, zwei Knöpfe: *Nochmal* / *Gut*
- **Anki-Export jederzeit**, mit vollständigem Lernverlauf und FSRS-Zustand,
  kompatibel zum Anki-Add-on [Bible Memorizer](https://github.com/zefanja/bible-memorizer)
- **Freie Bibelübersetzungen**: Luther 1912, Schlachter 1951, Elberfelder 1905,
  King James Version, Berean Standard Bible, World English Bible – oder eigener Text
- **Keine Konten, kein Tracking** – alle Daten bleiben auf dem Gerät

## Entwicklung

```bash
pnpm install
```

```bash
pnpm bibles
```

```bash
pnpm dev
```

Details, Tests und Architektur: [docs/ENTWICKLUNG.md](docs/ENTWICKLUNG.md) ·
Produktplanung: [docs/planung/01-produkt-steckbrief.md](docs/planung/01-produkt-steckbrief.md)

## Lizenz

Code: [MIT](LICENSE). Die Namen „BibleZ“ und „Bible Memorizer“ sowie das Logo
sind von der Lizenz ausgenommen. Bibeltexte: siehe die jeweilige Übersetzung
(alle eingebundenen Übersetzungen sind gemeinfrei).
