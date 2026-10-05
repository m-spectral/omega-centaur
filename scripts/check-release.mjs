import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const version = process.argv[2] ?? manifest.version;
assert.match(version, /^\d+\.\d+\.\d+$/, 'Release tag must be x.y.z');
assert.equal(manifest.version, version, 'Release tag must match manifest version');
assert.equal(manifest.id, 'omega-centaur');
assert.equal(manifest.name, 'Omega Centaur');
assert.equal(manifest.author, 'b. munoz');
assert.equal(typeof manifest.isDesktopOnly, 'boolean');
assert.match(manifest.minAppVersion, /^\d+\.\d+\.\d+$/);
assert.ok(manifest.description.length > 0 && manifest.description.length <= 250);
assert.ok(manifest.description.endsWith('.'));
for (const file of ['main.js', 'styles.css']) {
  assert.ok(readFileSync(file).length > 0, `${file} must not be empty`);
}
console.log(`Release assets and manifest are valid for ${version}.`);
