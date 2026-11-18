import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'legacy/macos/0.2.90');
export async function restoreLegacyMacFeed({ output = join(root, 'apps/web/dist'), production = process.env.CONTEXT === 'production', liveFeed = async () => {
  const response = await fetch('https://todotrackr.netlify.app/updates/appcast.xml', { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Cannot verify existing legacy feed: HTTP ${response.status}`);
  return response.text();
} } = {}) {
  const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
  const bytes = {};
  for (const [name, hash] of Object.entries(manifest.files)) {
    bytes[name] = await readFile(join(source, name));
    assert.equal(createHash('sha256').update(bytes[name]).digest('hex'), hash, `Legacy release checksum: ${name}`);
  }
  const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(manifest.publicKey, 'base64')]), format: 'der', type: 'spki' });
  const xml = bytes['appcast.xml'].toString();
  const footer = xml.match(/<!-- sparkle-signatures:\s*edSignature:\s*(\S+)\s*length:\s*(\d+)\s*-->/);
  assert.ok(footer, 'Signed legacy feed required');
  assert.ok(verify(null, bytes['appcast.xml'].subarray(0, Number(footer[2])), key, Buffer.from(footer[1], 'base64')), 'Legacy feed signature');
  const item = xml.match(/<item>[\s\S]*?<\/item>/)?.[0];
  assert.ok(item?.includes(`<sparkle:version>${manifest.build}</sparkle:version>`));
  assert.ok(item.includes(`<sparkle:shortVersionString>${manifest.version}</sparkle:shortVersionString>`));
  const attrs = Object.fromEntries([...item.match(/<enclosure\s+([^>]+)\/>/)[1].matchAll(/([\w:]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
  const archive = bytes[`Todo-Trackr-${manifest.version}.zip`];
  assert.equal(attrs.url, `https://todotrackr.netlify.app/updates/Todo-Trackr-${manifest.version}.zip`);
  assert.equal(Number(attrs.length), archive.length);
  assert.ok(verify(null, archive, key, Buffer.from(attrs['sparkle:edSignature'], 'base64')), 'Legacy archive signature');
  if (production) {
    const published = await liveFeed();
    const builds = [...published.matchAll(/<sparkle:version>(\d+)<\/sparkle:version>/g)].map(m => Number(m[1]));
    assert.ok(builds.length, 'Existing feed must expose its published build');
    assert.ok(Math.max(...builds) <= manifest.build, 'Refusing to replace a newer published legacy Mac release. Update the verified overlay first.');
  }
  const destination = join(output, 'updates');
  await mkdir(destination, { recursive: true });
  for (const name of Object.keys(manifest.files)) await copyFile(join(source, name), join(destination, name));
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await restoreLegacyMacFeed();
  console.log(`Preserved signed legacy Mac feed ${manifest.version} (${manifest.build}); public Mac distribution remains source-only.`);
}
