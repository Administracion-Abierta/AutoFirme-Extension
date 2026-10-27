# AGENTS.md — AutoFirme Extension

Split from the main repo (AutoFirme/AutoFirme) on 2026-10-27: the Chrome MV3
extension is its own product here. Full UI fork by design — the extension page
mounts the same Svelte UI as the web app, so `src/` is copied, not shared. Keep
the two trees intentionally similar; drift in the signing core is a known,
accepted cost (extracting a shared package was rejected as too much machinery).

## Hard rules

1. `src-tauri/`, `mcp/`, PWA/deploy machinery and their tests belong to the main
   repo. If a change needs them, it belongs there; this tree stays extension-only.
2. Conventional commits; PRs target `develop`, `main` only receives merges from
   `develop`; `Refs #N` only in commits.
3. Versions: release-please bumps `package.json` **and** `extension/manifest.json`.
   Never edit either by hand; `pnpm check:versions` (CI) fails on drift.
4. Crypto code MUST ship with a verification check before review
   (`scripts/check-extension.mjs` artifact assertions + the core protocol tests).
5. Commit but do not push unless the user asks.

## Layout

extension/            # chrome shell: manifest.json, background/content/page scripts, core/ protocol
src/                  # shared Svelte UI + signing core (forked from the main repo)
scripts/              # build/check/package-extension, browser test, release.sh
static/               # assets the extension package actually references
test/                 # extension-site.html fixture
demo/                 # registradores live-portal fixtures (used by protocol tests)
docs/                 # CHROME-EXTENSION*.md, STORE-LISTING, PRIVACY
.github/workflows/    # ci, release-develop (dev pre-releases), release, release-please

Build/test from the repo root (pnpm is canonical):
`pnpm install && pnpm check && pnpm test && pnpm build:extension && pnpm package:extension`.
