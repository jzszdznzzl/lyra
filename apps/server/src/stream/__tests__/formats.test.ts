import { describe, expect, test } from 'bun:test';

import { pickAudioFormat } from '../formats.ts';

const FORMATS = [
  { itag: 249, bitrate: 54_852, mimeType: 'audio/webm', isDrc: false },
  { itag: 250, bitrate: 73_196, mimeType: 'audio/webm', isDrc: false },
  { itag: 140, bitrate: 137_064, mimeType: 'audio/mp4', isDrc: false },
  { itag: 251, bitrate: 146_460, mimeType: 'audio/webm', isDrc: false },
  { itag: 141, bitrate: 262_000, mimeType: 'audio/mp4', isDrc: false },
  { itag: 251, bitrate: 150_000, mimeType: 'audio/webm', isDrc: true },
];

describe('pickAudioFormat', () => {
  test.each([
    ['low', 249],
    ['normal', 250],
    ['high', 251],
    ['max', 141],
  ] as const)('%s picks itag %i', (quality, itag) => {
    expect(pickAudioFormat(FORMATS, quality)?.itag).toBe(itag);
  });

  test('never picks a DRC variant while normal ones exist', () => {
    expect(pickAudioFormat(FORMATS, 'high')?.isDrc).toBe(false);
  });

  test('returns null without formats', () => {
    expect(pickAudioFormat([], 'max')).toBeNull();
  });
});
