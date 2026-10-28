import { describe, expect, test } from 'bun:test';

import type { Track } from '@lyra/shared';

import { videoScore } from '../catalog.ts';

function video(title: string, artist: string): Track {
  return {
    kind: 'video',
    id: 'xxxxxxxxxxx',
    title,
    artists: [{ id: null, name: artist }],
    album: null,
    durationSeconds: 200,
    thumbnail: null,
    isExplicit: false,
  };
}

describe('videoScore', () => {
  test('ranks the artist channel and official videos above fan uploads', () => {
    const official = videoScore(
      video('Blinding Lights (Official Video)', 'The Weeknd'),
      'blinding lights',
      'the weeknd',
    );
    const audio = videoScore(
      video('Blinding Lights (Official Audio)', 'The Weeknd'),
      'blinding lights',
      'the weeknd',
    );
    const fan = videoScore(
      video('Blinding Lights - Letra Traducida', 'Fan Channel'),
      'blinding lights',
      'the weeknd',
    );

    expect(official).toBeGreaterThan(audio);
    expect(audio).toBeGreaterThan(fan);
  });
});
