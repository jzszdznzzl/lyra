import { describe, expect, test } from 'vitest';

import { MediaKind } from '@lyra/shared';
import type { Track } from '@lyra/shared';

import { groupByAlbum, groupByArtist } from '../download-groups.ts';

function track(id: string, album: Track['album'], artists: string[]): Track {
  return {
    kind: MediaKind.Song,
    id,
    title: id,
    artists: artists.map((name) => ({ id: name.startsWith('?') ? null : `UC${name}`, name })),
    album,
    durationSeconds: 200,
    thumbnail: `${id}.jpg`,
    isExplicit: false,
  };
}

const tracks = [
  track('a', { id: 'MPb', name: 'Bravo' }, ['Zoe']),
  track('b', { id: 'MPa', name: 'Alpha' }, ['Zoe', 'Ana']),
  track('c', { id: 'MPb', name: 'Bravo' }, ['Ana']),
  track('d', null, ['?Unknown']),
  track('e', { id: null, name: 'Loose' }, ['?Unknown']),
];

describe('groupByAlbum', () => {
  test('groups by album, sorted by name, leaving songs without an album out', () => {
    const groups = groupByAlbum(tracks);

    expect(groups.map((group) => group.name)).toEqual(['Alpha', 'Bravo', 'Loose']);
    expect(groups[1]?.tracks.map((item) => item.id)).toEqual(['a', 'c']);
    expect(groups[1]?.thumbnail).toBe('a.jpg');
  });

  test('keys albums without an id by name', () => {
    expect(groupByAlbum(tracks)[2]?.key).toBe('name:Loose');
  });
});

describe('groupByArtist', () => {
  test('puts a song with several artists under each of them', () => {
    const groups = groupByArtist(tracks);

    expect(groups.map((group) => group.name)).toEqual(['?Unknown', 'Ana', 'Zoe']);
    expect(groups.find((group) => group.name === 'Ana')?.tracks.map((item) => item.id)).toEqual([
      'b',
      'c',
    ]);
  });
});
