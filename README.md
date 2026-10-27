# AutoFirme Extension

Chrome MV3 extension that intercepts a portal's `AutoFirma`/`AutoScript` call and
signs with X.509 certificates in the browser (WebCrypto, private keys never leave
the client). Part of the [AutoFirma Web](https://github.com/Administracion-Abierta/AutoFirme)
family — this repo ships the extension surface only; the web app, desktop shell
and MCP server live in the main repo.

## Install (from a release)

1. Download `autofirme-extension-<version>.zip` from
   [Releases](https://github.com/Administracion-Abierta/AutoFirme-Extension/releases).
2. Verify: `sha256sum -c SHA256SUMS` (Linux/macOS) or `certutil -hashfile <zip> SHA256` (Windows).
3. Unzip, open `chrome://extensions`, enable **Developer mode**, **Load unpacked**,
   pick the extracted folder. The extension is unsigned, so developer mode is required.

Development pre-releases roll on every push to `develop` (tagged `dev-<sha>`,
marked *not for production use*).

## What it does

- **Interception** — content scripts watch for `AutoFirma`/`AutoScript` invocations
  (`afirma://` deep links and JS `invokeAutoScript`), show a consent chooser per
  request, and answer the portal with a real signature instead of launching the
  desktop app.
- **Signing UI** — the extension page mounts the same UI as the web app:
  CAdES, XAdES, PAdES, ODF/Office signing with PKCS#12 certificates.
- **MCP bridge** — an outbound WebSocket (`autofirme-bridge.v1`) lets the main
  repo's MCP server ask the extension to sign, with the same consent window.

## Development

```sh
pnpm install
pnpm build:extension     # dist/extension/ + dist/autofirme-extension-*.zip
pnpm check               # svelte-check + tsc (extension project)
pnpm check:extension     # artifact assertions (MV3 CSP, local assets, no PWA)
pnpm test                # vitest (UI) + node:test (extension core, artifacts, workflows)
pnpm package:extension   # reproducible zip from dist/extension/
pnpm demo:registradores  # live portal test page (needs pnpm demo:chromium first)
```

Layout mirrors the main repo: `extension/` (chrome shell: manifest, background,
content, core protocol), `src/` (shared Svelte UI + signing core), `scripts/`,
`test/`, `docs/`, `.github/workflows/`.

## Versioning

Release Please keeps `package.json` and `extension/manifest.json` (the one Chrome
reads) in step. Conventional commits merged into `main` produce a release PR;
merging it tags `vX.Y.Z` and GitHub Actions attaches the zip + `SHA256SUMS`.
`pnpm check:versions` fails loudly on drift.

## Docs

- [`docs/CHROME-EXTENSION.md`](docs/CHROME-EXTENSION.md) — architecture
- [`docs/CHROME-EXTENSION-DESIGN.md`](docs/CHROME-EXTENSION-DESIGN.md) — protocol design
- [`docs/CHROME-EXTENSION-VERIFICATION.md`](docs/CHROME-EXTENSION-VERIFICATION.md) — how it is tested
- [`docs/STORE-LISTING.md`](docs/STORE-LISTING.md) — Web Store listing draft
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — data handling
