// Single source of truth for the product version.
//
//   node scripts/check-versions.mjs            # files agree with each other
//   node scripts/check-versions.mjs v0.1.3     # ...and with a release tag
//
// Two files carry the version: `package.json` and `extension/manifest.json` (Chrome reads
// that one). release-please updates both through the `extra-files` entry in
// `release-please-config.json`; this script is what makes a drift loud instead of silent.
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = (path) => JSON.parse(read(path));

const { version: appVersion } = readJson('package.json');
const { version: manifestVersion } = readJson('extension/manifest.json');

const problems = [];
for (const [path, version] of [
	['extension/manifest.json', manifestVersion],
]) {
	if (version !== appVersion) problems.push(`package.json ${appVersion} != ${path} ${version ?? '(missing version)'}`);
}

const tag = process.argv[2];
if (tag) {
	const expected = tag.replace(/^v/, '');
	if (appVersion !== expected) problems.push(`package.json ${appVersion} != release tag ${expected}`);
}

if (problems.length) {
	console.error(`version drift:\n${problems.join('\n')}`);
	process.exit(1);
}
console.log(`versions agree: ${appVersion}`);
