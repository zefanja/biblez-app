#!/usr/bin/env python3
"""Anki → BibleZ → Anki: the user's collection must recognise its notes again.

Imports the add-on fixture into a fresh Anki collection (= the user's
collection), then imports the BibleZ export of the same cards into it and
checks: no new notes, no extra note type, every note updated, no conflicts.

Usage: python3 tools/anki_verify_roundtrip.py packages/core/test/fixtures/anki-modern.apkg packages/core/.out/roundtrip.apkg
"""
import os
import sys
import tempfile

from anki.collection import Collection, ImportAnkiPackageOptions, ImportAnkiPackageRequest

original, roundtrip = sys.argv[1], sys.argv[2]
fails = []
with tempfile.TemporaryDirectory() as d:
    col = Collection(os.path.join(d, "user.anki2"))
    col.set_config("fsrs", True)
    imp = lambda p: col.import_anki_package(ImportAnkiPackageRequest(package_path=p, options=ImportAnkiPackageOptions(with_scheduling=True)))
    imp(original)
    notes, types = col.note_count(), sorted(m.name for m in col.models.all_names_and_ids())
    log = imp(roundtrip).log
    checks = [
        (col.note_count() == notes, f"no new notes ({notes} → {col.note_count()})"),
        (sorted(m.name for m in col.models.all_names_and_ids()) == types, "no extra note type"),
        (len(log.conflicting) == 0, f"no conflicting notes ({len(log.conflicting)})"),
        (len(log.updated) + len(log.duplicate) > 0 and len(log.new) == 0, f"notes recognised: {len(log.updated)} updated, {len(log.duplicate)} unchanged, {len(log.new)} new"),
    ]
    for ok, msg in checks:
        print(("  ok   " if ok else "  FAIL ") + msg)
        if not ok:
            fails.append(msg)
    col.close()
print("\nROUNDTRIP:", "PASS" if not fails else "FAIL")
sys.exit(1 if fails else 0)
