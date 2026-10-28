import { describe, expect, test } from 'bun:test';

import { describeUserAgent } from '../user-agent.ts';

describe('describeUserAgent', () => {
  test.each([
    [
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
      'Chrome on Android',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0', 'Firefox on Linux'],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0',
      'Edge on Windows',
    ],
    ['curl/8.0', 'Unknown device'],
  ])('%s', (userAgent, label) => {
    expect(describeUserAgent(userAgent)).toBe(label);
  });
});
