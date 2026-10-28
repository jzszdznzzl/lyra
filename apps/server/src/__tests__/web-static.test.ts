import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { webStatic } from '../web-static.ts';

const dist = mkdtempSync(join(tmpdir(), 'lyra-dist-'));
mkdirSync(join(dist, 'assets'));
writeFileSync(join(dist, 'index.html'), '<p>app</p>');
writeFileSync(join(dist, 'assets', 'app-123.js'), 'console.log(1)');
writeFileSync(join(tmpdir(), 'lyra-secret.txt'), 'secret');

const app = webStatic(dist);
const get = (path: string) => app.handle(new Request(`http://localhost${path}`));

describe('webStatic', () => {
  test('serves assets with long caching', async () => {
    const response = await get('/assets/app-123.js');

    expect(await response.text()).toBe('console.log(1)');
    expect(response.headers.get('cache-control')).toContain('immutable');
  });

  test('falls back to index.html for client routes', async () => {
    expect(await (await get('/album/abc')).text()).toBe('<p>app</p>');
  });

  test('never serves files outside the folder', async () => {
    expect(await (await get('/..%2Flyra-secret.txt')).text()).toBe('<p>app</p>');
  });

  test('leaves unknown API paths as 404', async () => {
    expect((await get('/api/nope')).status).toBe(404);
  });
});
