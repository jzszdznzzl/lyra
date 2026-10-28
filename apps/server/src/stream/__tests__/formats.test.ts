import { describe, expect, test } from 'bun:test';

import { pickAudioFormat, pickVideoFormat } from '../formats.ts';

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

describe('pickVideoFormat', () => {
  const VIDEO = [
    { itag: 137, height: 1080, codec: 'avc1.640028', isDrc: false },
    { itag: 248, height: 1080, codec: 'vp9', isDrc: false },
    { itag: 136, height: 720, codec: 'avc1.4d401f', isDrc: false },
    { itag: 398, height: 720, codec: 'av01.0.05M.08', isDrc: false },
    { itag: 247, height: 720, codec: 'vp9', isDrc: false },
    { itag: 134, height: 360, codec: 'avc1.4d401e', isDrc: false },
  ];

  test('prefers H.264 at the tallest allowed height', () => {
    expect(pickVideoFormat(VIDEO, 720)?.itag).toBe(136);
    expect(pickVideoFormat(VIDEO, 1080)?.itag).toBe(137);
    expect(pickVideoFormat(VIDEO, 480)?.itag).toBe(134);
  });

  test('falls back to the smallest when nothing fits', () => {
    expect(pickVideoFormat(VIDEO, 144)?.itag).toBe(134);
  });
});
