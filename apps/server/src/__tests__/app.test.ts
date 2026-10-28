import { describe, expect, test } from 'bun:test';

import { createApp } from '../app.ts';

describe('app', () => {
  test('health answers ok', async () => {
    const response = await createApp().handle(new Request('http://localhost/api/health'));

    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
