import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

import { InnertubePool } from '../innertube.ts';
import { PoTokenMinter } from '../po-token.ts';

const isLive = process.env['LYRA_LIVE'] === '1';
const VIDEO_ID = '4D7u5KF7SP8';
const MIB = 1024 * 1024;

describe.skipIf(!isLive)('PoTokenMinter (live)', () => {
  test('lets a YT Music web stream go past the first MiB', async () => {
    const pool = new InnertubePool(mkdtempSync(join(tmpdir(), 'lyra-pot-')));
    const yt = await pool.get({ userId: null, cookie: null, language: 'en' });
    const minter = new PoTokenMinter(Date.now);

    const poToken = await minter.mint(yt, VIDEO_ID);
    expect(poToken).not.toBeNull();

    const info = await yt.getBasicInfo(VIDEO_ID, {
      client: 'YTMUSIC',
      ...(poToken ? { po_token: poToken } : {}),
    });
    const format = info.streaming_data?.adaptive_formats.find(
      (candidate) => candidate.has_audio && !candidate.has_video,
    );
    expect(format).toBeDefined();

    const url = new URL((await format?.decipher(yt.session.player)) ?? '');
    url.searchParams.set('pot', poToken ?? '');
    // Past the first MiB is where googlevideo refuses web clients without a PO token.
    const response = await fetch(url, { headers: { range: `bytes=${MIB}-${MIB + 1023}` } });

    expect(response.status).toBe(206);
  }, 60_000);
});
