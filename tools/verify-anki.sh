#!/bin/sh
# Builds a sample export and checks it with the official Anki package.
# Uses .venv/bin/python when present (python3 -m venv .venv && .venv/bin/pip install anki).
set -e
PY=python3
[ -x .venv/bin/python ] && PY=.venv/bin/python
pnpm --filter @biblez/core export:sample
exec "$PY" tools/anki_verify.py packages/core/.out/sample.apkg
