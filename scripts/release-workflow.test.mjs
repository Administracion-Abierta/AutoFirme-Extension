/**
 * Regression for the extension release pipeline: releases build and publish on
 * GitHub Actions; Forgejo stays CI-only and must not publish (publish jobs are
 * gated on github.server_url). Each assertion guards a shipped-scope
 * invariant, not wording.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const workflow = read('.github/workflows/release.yml');
const devWorkflow = read('.github/workflows/release-develop.yml');
const ciWorkflow = read('.github/workflows/ci.yml');
const rpWorkflow = read('.github/workflows/release-please.yml');
const pkg = JSON.parse(read('package.json'));
const rpConfig = JSON.parse(read('release-please-config.json'));

/** Body of one top-level job in a workflow file. */
function job(source, name) {
	const start = source.indexOf(`\n  ${name}:\n`);
	assert.ok(start >= 0, `job ${name} missing`);
	const rest = source.slice(start + 1);
	const next = rest.slice(1).search(/^ {2}\S/m);
	return next < 0 ? rest : rest.slice(0, next + 1);
}

test('release runs on the published release, never on a bare tag push', () => {
	const onStart = workflow.indexOf('\non:\n');
	assert.ok(onStart >= 0, 'on: block missing');
	const onEnd = workflow.indexOf('\npermissions:', onStart);
	assert.ok(onEnd > onStart, 'permissions: must follow on:');
	assert.equal(workflow.slice(onStart + 1, onEnd), 'on:\n  release:\n    types: [published]\n');
});

test('the artifacts job builds twice and diffs SHA256SUMS before uploading', () => {
	const artifacts = job(workflow, 'artifacts');
	assert.match(artifacts, /cp dist\/SHA256SUMS sums-a\.txt/);
	assert.match(artifacts, /rm -rf dist \.svelte-kit/);
	assert.match(artifacts, /diff sums-a\.txt dist\/SHA256SUMS/);
	const packs = artifacts.match(/pnpm package:extension/g);
	assert.ok(packs && packs.length === 2, `expected exactly 2 package:extension runs, got ${packs?.length}`);
	assert.ok(
		artifacts.indexOf('diff sums-a.txt') < artifacts.indexOf('scripts/release.sh'),
		'reproducibility diff must run before the release upload'
	);
});

test('the desktop-shell machinery stays out of this repo', () => {
	// The lazy @tauri-apps/api imports stay (shared lib probes __TAURI_INTERNALS__ at
	// runtime), but no build, job or source tree of the shell lives here.
	for (const source of [workflow, devWorkflow, ciWorkflow]) {
		assert.doesNotMatch(source, /src-tauri|tauri build|linux-packages/);
	}
	assert.doesNotMatch(ciWorkflow, /^\s+shell:\n/m, 'no tauri shell job');
});

test('the web deploy machinery stays out of this repo', () => {
	assert.doesNotMatch(ciWorkflow, /wrangler|Containerfile/);
	assert.doesNotMatch(workflow, /autofirme-web/);
	assert.doesNotMatch(devWorkflow, /autofirme-web|build\/$/m);
});

test('out-of-scope chrome-webstore and attestation stay out', () => {
	assert.doesNotMatch(workflow, /chrome-web-store|webstore/i);
	assert.doesNotMatch(workflow, /attest-build-provenance|id-token/, 'not in scope of this repo yet');
});

test('release uploads go through the host-detecting release.sh helper', () => {
	assert.match(job(workflow, 'artifacts'), /scripts\/release\.sh/);
	assert.match(job(devWorkflow, 'artifacts'), /scripts\/release\.sh/);
	assert.doesNotMatch(workflow, /forgejo-release\.sh/);
});

test('Forgejo never publishes: publish jobs are gated on the GitHub server URL', () => {
	// Both hosts share the workflow tree; the gate keeps the Forgejo side silent
	// (no release-please PRs, no dev pre-releases). release.yml is inherently
	// host-local: `on: release: published` fires only where the release lives.
	assert.match(rpWorkflow, /startsWith\(github\.server_url, 'https:\/\/github\.com'\)/);
	assert.match(job(devWorkflow, 'artifacts'), /startsWith\(github\.server_url, 'https:\/\/github\.com'\)/);
});

test('no workflow references a Forgejo-prefixed action URL or the Forgejo API', () => {
	// On GitHub these fail resolution ("Unable to resolve action
	// https:/github.com"); on Forgejo DEFAULT_ACTIONS_URL resolves plain refs.
	for (const source of [workflow, devWorkflow, ciWorkflow, rpWorkflow]) {
		assert.doesNotMatch(source, /uses: https?:\/\//, 'fully qualified action URL must go');
	}
	assert.doesNotMatch(rpWorkflow, /github-api-url/, 'release-please must use the GitHub API');
});

test('workflows pin a supported upload-artifact (v3 is force-failed on GitHub)', () => {
	for (const source of [workflow, devWorkflow, ciWorkflow]) {
		assert.doesNotMatch(source, /upload-artifact@v3/);
	}
	const uses = [workflow, devWorkflow, ciWorkflow].join('\n').match(/upload-artifact@\S+/g) ?? [];
	assert.ok(uses.length >= 2 && uses.every((u) => /^upload-artifact@v[4-9]$/.test(u)), uses.join(' '));
});

test('every upload-artifact step is skipped on non-GitHub hosts (v4 = GHESNotSupportedError there)', () => {
	const sources = [workflow, devWorkflow, ciWorkflow];
	const blocks = sources.flatMap((s) => s.match(/- uses: actions\/upload-artifact@\S+[^-]*?if: startsWith\(github\.server_url, 'https:\/\/github\.com'\)/gs) ?? []);
	assert.ok(blocks.length >= 2, `found ${blocks.length} upload blocks`);
	for (const block of blocks) {
		assert.match(block, /if: startsWith\(github\.server_url, 'https:\/\/github\.com'\)/, block);
	}
});

// The develop pre-release channel: every push to develop ships a marked-unstable
// dev-<sha> pre-release (GitHub only).

test('develop release triggers only on develop pushes and manual dispatch', () => {
	const onEnd = devWorkflow.indexOf('\npermissions:');
	assert.ok(onEnd > 0, 'permissions must follow on:');
	assert.match(devWorkflow.slice(0, onEnd), /on:\n  push:\n    branches: \[develop\]\n  workflow_dispatch:\n/);
});

test('develop artifacts job publishes the pre-release with the extension zip and checksums', () => {
	const artifacts = job(devWorkflow, 'artifacts');
	assert.match(artifacts, /pnpm build:extension/);
	assert.match(artifacts, /pnpm package:extension/);
	// The tag is commit-pinned so a release always maps to exactly one tree.
	assert.match(artifacts, /TAG="dev-\$\{GITHUB_SHA::7\}"/);
	// bash-only substring expansion: container jobs default to sh (dash) — the
	// step must force bash (main-repo runs 40488400034/40489335673).
	assert.match(artifacts, /shell: bash\n/);
	// The helper derives tag/commit from the env GITHUB_TOKEN context: --sha pins the
	// release to the exact tree, --prerelease keeps it off the stable channel.
	assert.match(artifacts, /--sha "\$GITHUB_SHA"/);
	assert.match(artifacts, /--prerelease/);
	assert.match(artifacts, /--title "\[Development build\] \$TAG/);
	assert.match(artifacts, /--notes-file release-notes\.md/);
	assert.match(artifacts, /dist\/autofirme-extension-\*\.zip dist\/SHA256SUMS/);
});

test('develop releases are labelled as development builds', () => {
	const artifacts = job(devWorkflow, 'artifacts');
	assert.match(artifacts, /NOTES: \|-/);
	assert.match(artifacts, /not for production use/);
	// The label is a user-facing promise; the notes must also state the channel.
	assert.match(artifacts, /Rolling pre-release/);
});

test('release-develop and release container jobs set git safe.directory (dubious ownership)', () => {
	for (const source of [workflow, devWorkflow]) {
		assert.match(source, /git config --global --add safe\.directory "\$GITHUB_WORKSPACE"/);
	}
});

test('release-please bumps exactly package.json and extension/manifest.json', () => {
	const extras = rpConfig.packages['.']?.['extra-files'] ?? [];
	assert.equal(extras.length, 1, `manifest extra-files: ${JSON.stringify(extras)}`);
	assert.equal(extras[0].path, 'extension/manifest.json');
});

test('CI runs the version-drift check before packaging', () => {
	const checks = job(ciWorkflow, 'checks');
	assert.match(checks, /pnpm check:versions/);
	assert.ok(checks.indexOf('pnpm check:versions') < checks.indexOf('pnpm package:extension'));
});

test('the package script runs the extension pipeline from a clean install', () => {
	assert.match(pkg.scripts['build:extension'], /build-extension\.mjs/);
	assert.match(pkg.scripts['package:extension'], /package-extension\.py/);
	assert.match(pkg.scripts.test, /extension\/tests\/\*\.test\.js/);
});
