import { describe, expect, test } from 'bun:test';

import { clientInfo } from '../auth/plugin.ts';
import { createTestContext } from '../testing/test-context.ts';

const request = new Request('http://localhost/', {
  headers: { 'cf-connecting-ip': '203.0.113.9' },
});

describe('clientInfo', () => {
  test('uses the Cloudflare header only behind a trusted proxy', () => {
    const trusted = createTestContext();
    const untrusted = { ...trusted, env: { ...trusted.env, TRUST_PROXY: false } };

    expect(clientInfo(trusted, request, null).ip).toBe('203.0.113.9');
    expect(clientInfo(untrusted, request, null).ip).toBe('unknown');
  });
});
