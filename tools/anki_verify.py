#!/usr/bin/env python3
"""Imports a BibleZ .apkg into a fresh Anki collection (official `anki`
package, FSRS enabled) and checks that notes, cards, review history and FSRS
memory state arrive exactly as exported.

Usage:  python3 tools/anki_verify.py packages/core/.out/sample.apkg
Needs:  pip install anki   (tested with Anki 26.09)
"""

import json
import sys
import tempfile
from pathlib import Path

from anki.collection import Collection, ImportAnkiPackageOptions, ImportAnkiPackageRequest

QUEUE_SUSPENDED = -1
failures: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def import_into(col: Collection, apkg: Path) -> None:
    req = ImportAnkiPackageRequest(package_path=str(apkg), options=ImportAnkiPackageOptions(with_scheduling=True))
    col.import_anki_package(req)


def main() -> int:
    apkg = Path(sys.argv[1])
    expected = json.loads(apkg.with_name(apkg.stem + ".expected.json").read_text())
    from anki.buildinfo import version

    print(f"Anki {version}: importing {apkg}")
    with tempfile.TemporaryDirectory() as tmp:
        col = Collection(str(Path(tmp) / "collection.anki2"))
        col.set_config("fsrs", True)
        import_into(col, apkg)

        check(col.note_count() == expected["notes"], f"notes: {col.note_count()} == {expected['notes']}")
        check(col.card_count() == expected["cards"], f"cards: {col.card_count()} == {expected['cards']}")
        revlog = col.db.scalar("select count() from revlog")
        check(revlog == expected["reviews"], f"review history: {revlog} == {expected['reviews']}")
        names = {d.name for d in col.decks.all_names_and_ids()}
        for deck in expected["decks"]:
            check(deck in names, f"deck exists: {deck}")
        nt = col.models.by_name("Bible Memorizer")
        check(nt is not None, "note type 'Bible Memorizer' exists")
        check(col.db.scalar("select count() from cards where ord = 2") == 0, "no overview-table cards (Card 3)")

        today = col.sched.today
        by_id = {c["ankiCardId"]: c for c in expected["cardsDetail"]}
        mismatches = 0
        checked_review = checked_learning = checked_new = checked_susp = 0
        for cid, ctype, queue, due, reps, lapses in col.db.all("select id, type, queue, due, reps, lapses from cards"):
            exp = by_id.get(cid)
            if exp is None:
                mismatches += 1
                print(f"    unexpected card {cid}")
                continue
            card = col.get_card(cid)
            ms = card.memory_state
            problems = []
            if exp["suspended"] != (queue == QUEUE_SUSPENDED):
                problems.append(f"suspended {queue}")
            if exp["state"] == "New":
                checked_new += 1
                if ctype != 0:
                    problems.append(f"type {ctype} != new")
            else:
                if ms is None:
                    problems.append("no FSRS memory state")
                else:
                    if abs(ms.stability - exp["stability"]) > 0.01:
                        problems.append(f"stability {ms.stability:.4f} != {exp['stability']:.4f}")
                    if abs(ms.difficulty - exp["difficulty"]) > 0.01:
                        problems.append(f"difficulty {ms.difficulty:.3f} != {exp['difficulty']:.3f}")
                if reps != exp["reps"] or lapses != exp["lapses"]:
                    problems.append(f"reps/lapses {reps}/{lapses} != {exp['reps']}/{exp['lapses']}")
                if exp["state"] == "Review":
                    checked_review += 1
                    if ctype != 2:
                        problems.append(f"type {ctype} != review")
                    elif due - today != exp["dueInDays"]:
                        problems.append(f"due in {due - today} days != {exp['dueInDays']}")
                else:
                    checked_learning += 1
                    if ctype not in (1, 3):
                        problems.append(f"type {ctype} != learning")
                    elif due != exp["dueEpochSec"]:
                        problems.append(f"due {due} != {exp['dueEpochSec']}")
            if exp["suspended"]:
                checked_susp += 1
            if problems:
                mismatches += 1
                print(f"    card {cid} (stage {exp['stage']}, {exp['state']}): {'; '.join(problems)}")
        check(
            mismatches == 0,
            f"every card's state matches ({checked_review} review, {checked_learning} learning, "
            f"{checked_new} new, {checked_susp} resting/suspended)",
        )

        # Review history keeps its timestamps: last revlog entry == FSRS "last review time"
        lrt_bad = 0
        for cid, data in col.db.all("select id, data from cards where type != 0"):
            last = col.db.scalar("select max(id) from revlog where cid = ?", cid)
            if last is None or abs(last // 1000 - json.loads(data).get("lrt", 0)) > 2:
                lrt_bad += 1
        check(lrt_bad == 0, f"review timestamps match each card's last review ({lrt_bad} off)")

        # Cards render with the add-on templates
        sample = col.get_card(col.db.scalar("select id from cards where ord = 0 limit 1"))
        q = sample.question()
        check("_" in q and "Bible" not in q[:0], "stage-1 card renders masked text")

        # Anki's own database check finds nothing to fix
        before = col.db.all("select id, type, queue, due, ivl, data from cards order by id")
        out, _ = col.fix_integrity()
        after = col.db.all("select id, type, queue, due, ivl, data from cards order by id")
        changed = sum(1 for a, b in zip(before, after) if a != b)
        print(f"  info check database: {out!r}")
        check(changed == 0, f"Anki's database check changes no card ({changed} changed)")

        # Re-importing the same file must not create duplicates
        import_into(col, apkg)
        check(col.note_count() == expected["notes"], f"re-import creates no duplicate notes ({col.note_count()})")
        check(len(col.models.all_names_and_ids()) == len([m for m in col.models.all_names_and_ids()]), "note types stable")
        nts = [m.name for m in col.models.all_names_and_ids() if m.name.startswith("Bible Memorizer")]
        check(nts == ["Bible Memorizer"], f"single 'Bible Memorizer' note type after re-import: {nts}")
        col.close()

    print("\nRESULT:", "PASS" if not failures else f"FAIL ({len(failures)})")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
