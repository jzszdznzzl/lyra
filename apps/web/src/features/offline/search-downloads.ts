import type { Track } from '@lyra/shared';

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Offline search: every word of the query must appear in the title, artists or album. */
export function searchDownloads(tracks: Track[], query: string) {
  const words = normalize(query).split(' ').filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  return tracks.filter((track) => {
    const haystack = normalize(
      [track.title, ...track.artists.map((artist) => artist.name), track.album?.name ?? ''].join(
        ' ',
      ),
    );

    return words.every((word) => haystack.includes(word));
  });
}
