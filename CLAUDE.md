# BibleZ – notes for coding agents

pnpm monorepo: `packages/core` (domain logic, no UI) and `apps/client`
(React + Vite, Capacitor). Planning and decisions: `docs/planung/01-produkt-steckbrief.md`
(German); developer guide: `docs/ENTWICKLUNG.md`.

## Commands

- `pnpm install` – dependencies
- `pnpm bibles` – generate Bible data into `apps/client/public/bibles/` (needed by the app and by some core tests)
- `pnpm --filter @biblez/core test` – unit tests (Vitest)
- `pnpm --filter @biblez/core typecheck` / `pnpm --filter @biblez/client typecheck`
- `pnpm e2e` – builds the client and runs the browser E2E (Chromium via Playwright)
- `pnpm check` – typecheck + unit tests + E2E in one go
- `pnpm verify:anki` – checks the .apkg export with the real Anki package (`.venv` with `anki`)

Run `pnpm check` before every commit; add `pnpm verify:anki` for changes to
scheduling, storage or export.

## Rules

- Every scheduled card maps 1:1 to an Anki card (stage 1/2/3 → Card 1/2/4). New
  exercise types are answer modes, never new cards.
- Reviews are append-only; card state is always derived via `replay()`.
- Anki ids (note, card, GUID, deck) are assigned once and never changed.
- One stage at a time; no sibling stages on the same day.
- UI copy in German and English (`apps/client/src/i18n.ts`); keep both in sync.
- Bible texts: only public-domain or licensed translations (see brief §5.1).
