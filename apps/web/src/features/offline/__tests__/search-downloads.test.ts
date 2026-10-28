import { describe, expect, test } from 'vitest';

import type { Track } from '@lyra/shared';

import { searchDownloads } from '../search-downloads.ts';

function track(id: string, title: string, artist: string, album: string): Track {
  return {
    kind: 'song',
    id,
    title,
    artists: [{ id: null, name: artist }],
    album: { id: null, name: album },
    durationSeconds: 200,
    thumbnail: null,
    isExplicit: false,
  };
}

const TRACKS = [
  track('a', 'Get Lucky', 'Daft Punk', 'Random Access Memories'),
  track('b', 'Canción del Mariachi', 'Antonio Banderas', 'Desperado'),
  track('c', 'One More Time', 'Daft Punk', 'Discovery'),
];

describe('searchDownloads', () => {
  test('matches words across title, artist and album, ignoring accents and case', () => {
    expect(searchDownloads(TRACKS, 'daft lucky').map((item) => item.id)).toEqual(['a']);
    expect(searchDownloads(TRACKS, 'CANCION mariachi').map((item) => item.id)).toEqual(['b']);
    expect(searchDownloads(TRACKS, 'daft punk').map((item) => item.id)).toEqual(['a', 'c']);
  });

  test('returns nothing for an empty query', () => {
    expect(searchDownloads(TRACKS, '  ')).toEqual([]);
  });
});
