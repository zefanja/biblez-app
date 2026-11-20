#!/usr/bin/env python3
"""Creates real Anki exports for the importer tests.

Uses the official `anki` package, the *original* note type and note generator
of the Bible Memorizer add-on (zefanja/bible-memorizer: src/model.py and
src/gen_notes.py), reviews cards with FSRS (again/hard/good/easy, one card
suspended, one reset) and exports the collection twice:

  packages/core/test/fixtures/anki-legacy.apkg   ("support older Anki versions": collection.anki2)
  packages/core/test/fixtures/anki-modern.apkg   (current format: zstd-compressed collection.anki21b)
  packages/core/test/fixtures/anki-expected.json (what the importer must find)

Usage: .venv/bin/python tools/make-anki-fixtures.py [path/to/bible-memorizer/src]
"""

import json
import re
import sys
import tempfile
from pathlib import Path

from anki.collection import Collection, ExportAnkiPackageOptions
from anki.notes import Note
from anki.scheduler.v3 import CardAnswer

ROOT = Path(__file__).resolve().parent.parent
ADDON = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT.parent / "bible-memorizer" / "src")
OUT = ROOT / "packages" / "core" / "test" / "fixtures"


def addon_model() -> dict:
    """Field names and templates straight from the add-on's model.py (without importing aqt)."""
    src = (ADDON / "model.py").read_text()
    block = src[src.index("_field_names") : src.index("_current_version")]
    ns: dict = {}
    exec(block, ns)  # plain string/list assignments
    return ns


def create_notetype(col: Collection, m: dict):
    mm = col.models
    nt = mm.new(m["_model_name"])
    for name in m["_field_names"]:
        mm.add_field(nt, mm.new_field(name))
    for i in range(1, 5):
        t = mm.new_template(f"Card {i}")
        t["qfmt"], t["afmt"] = m[f"_card{i}_front"], m[f"_card{i}_back"]
        mm.add_template(nt, t)
    nt["css"] = m["_styling"]
    nt["sortf"] = m["_field_names"].index("id")
    mm.add(nt)


def answer(col: Collection, rating) -> bool:
    card = col.sched.getCard()
    if not card:
        return False
    card.start_timer()
    states = col._backend.get_scheduling_states(card.id)
    col.sched.answer_card(col.sched.build_answer(card=card, states=states, rating=rating))
    return True


def main() -> None:
    sys.path.insert(0, str(ADDON))
    import gen_notes  # the add-on's own note generation

    m = addon_model()
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        col = Collection(str(Path(tmp) / "c.anki2"))
        col.set_config("fsrs", True)
        create_notetype(col, m)
        deck = col.decks.id("Bibelverse")

        john = (
            "16 Also hat Gott die Welt geliebt, daß er seinen eingebornen Sohn gab,\n"
            "auf daß alle, die an ihn glauben, nicht verloren werden, sondern das ewige Leben haben."
        )
        psalm = "\n".join(
            [
                "1 Ein Psalm Davids. Der HERR ist mein Hirte; mir wird nichts mangeln.",
                "2 Er weidet mich auf grüner Aue und führet mich zum frischen Wasser.",
                "3 Er erquicket meine Seele; er führet mich auf rechter Straße um seines Namens willen.",
                "4 Und ob ich schon wanderte im finstern Tal, fürchte ich kein Unglück;",
                "denn du bist bei mir, dein Stecken und Stab trösten mich.",
                "5 Du bereitest vor mir einen Tisch im Angesicht meiner Feinde.",
            ]
        )
        gen_notes.add_notes(col, Note, "Johannes 3,16", 2, john, deck, False)
        gen_notes.add_notes(col, Note, "Psalm 23 & mehr", 2, psalm, deck, True)  # with table cards (Card 3)

        # a note of another type must be ignored
        basic = col.new_note(col.models.by_name("Basic"))
        basic["Front"], basic["Back"] = "Hauptstadt von Frankreich?", "Paris"
        col.add_note(basic, deck)

        col.decks.select(deck)
        ratings = [CardAnswer.AGAIN, CardAnswer.GOOD, CardAnswer.HARD, CardAnswer.GOOD, CardAnswer.EASY]
        answered = 0
        for i in range(60):
            if not answer(col, ratings[i % len(ratings)]):
                break
            answered += 1

        cids = col.db.list("select id from cards where nid in (select id from notes where mid = ?) order by id",
                           col.models.by_name(m["_model_name"])["id"])
        reviewed = col.db.list("select distinct cid from revlog order by cid")
        col.sched.suspend_cards([reviewed[0]])
        col.sched.schedule_cards_as_new([reviewed[1]], restore_position=True, reset_counts=True)  # logs a "manual" entry

        notetype_id = col.models.by_name(m["_model_name"])["id"]
        notes = []
        for nid in col.db.list("select id from notes where mid = ? order by id", notetype_id):
            note = col.get_note(nid)
            cards = []
            for card in note.cards():
                revlog = col.db.all("select id, ease, type from revlog where cid = ? order by id", card.id)
                cards.append({"id": card.id, "ord": card.ord, "queue": card.queue,
                              "revlog": [{"id": r[0], "ease": r[1], "type": r[2]} for r in revlog]})
            notes.append({"id": nid, "guid": note.guid, "fields": dict(note.items()), "cards": cards})
        expected = {
            "anki": __import__("anki.buildinfo").buildinfo.version,
            "answered": answered,
            "notes": notes,
            "otherNotes": col.db.scalar("select count() from notes where mid != ?", notetype_id),
            "suspendedCard": reviewed[0],
            "resetCard": reviewed[1],
        }
        for legacy, name in [(True, "anki-legacy.apkg"), (False, "anki-modern.apkg")]:
            col.export_anki_package(
                out_path=str(OUT / name),
                options=ExportAnkiPackageOptions(with_scheduling=True, with_deck_configs=True, with_media=False, legacy=legacy),
                limit=None,
            )
        col.close()
    (OUT / "anki-expected.json").write_text(json.dumps(expected, ensure_ascii=False, indent=1))
    print(f"{len(notes)} Bible Memorizer notes, {answered} answers → {OUT}")


if __name__ == "__main__":
    main()
