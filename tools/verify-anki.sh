#!/bin/sh
# Builds a sample export and checks it with the official Anki package.
# Uses .venv/bin/python when present (python3 -m venv .venv && .venv/bin/pip install anki).
set -e
PY=python3
[ -x .venv/bin/python ] && PY=.venv/bin/python
pnpm --filter @biblez/core export:sample
"$PY" tools/anki_verify.py packages/core/.out/sample.apkg
# Anki → BibleZ → Anki round trip with real add-on cards
pnpm --filter @biblez/core exec tsx scripts/export-roundtrip.ts
"$PY" tools/anki_verify_roundtrip.py packages/core/test/fixtures/anki-modern.apkg packages/core/.out/roundtrip.apkg
