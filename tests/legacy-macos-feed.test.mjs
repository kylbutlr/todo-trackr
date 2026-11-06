import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { restoreLegacyMacFeed } from '../scripts/restore-legacy-macos-feed.mjs';

describe('Legacy Mac publication preservation', () => {
  it('restores the authentic previously published 2090 feed and archive', async () => {
    const output = await mkdtemp(join(tmpdir(), 'todo-feed-test-'));
    try {
      await restoreLegacyMacFeed({ output, production: true, liveFeed: async () => '<sparkle:version>2089</sparkle:version>' });
      const feed = await readFile(join(output, 'updates/appcast.xml'), 'utf8');
      expect(feed).toContain('<sparkle:version>2090</sparkle:version>');
      expect(feed).toContain('<sparkle:shortVersionString>0.2.90</sparkle:shortVersionString>');
      expect((await readFile(join(output, 'updates/Todo-Trackr-0.2.90.zip'))).length).toBe(3433829);
    } finally { await rm(output, { recursive: true, force: true }); }
  });
  it.each(['<sparkle:version>2091</sparkle:version>', 'invalid feed'])('blocks unsafe production replacement for %s', async xml => {
    await expect(restoreLegacyMacFeed({ production: true, liveFeed: async () => xml })).rejects.toThrow();
  });
  it('runs after every web workspace build and retains source-only distribution', async () => {
    const web = JSON.parse(await readFile(new URL('../apps/web/package.json', import.meta.url)));
    const release = JSON.parse(await readFile(new URL('../release.json', import.meta.url)));
    expect(web.scripts.postbuild).toBe('node ../../scripts/restore-legacy-macos-feed.mjs');
    expect(release.distribution.macos).toBe('source');
  });
});
