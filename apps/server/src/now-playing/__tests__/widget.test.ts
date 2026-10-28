import { describe, expect, test } from 'bun:test';

import type { NowPlaying } from '@lyra/shared';

import { renderWidget } from '../widget.ts';

const NOW = Date.UTC(2026, 9, 28, 12);
const HOUR_MS = 60 * 60 * 1000;

function nowPlaying(patch: Partial<NowPlaying> = {}): NowPlaying {
  return {
    isPlaying: true,
    track: {
      id: 'aaaaaaaaaaa',
      title: 'Rock & <Roll>',
      artists: [
        { id: null, name: 'Daft Punk' },
        { id: null, name: 'Pharrell Williams' },
      ],
      album: null,
      durationMs: 248_000,
      coverUrl: null,
      url: 'https://lyra.test/track/aaaaaaaaaaa',
      youtubeMusicUrl: 'https://music.youtube.com/watch?v=aaaaaaaaaaa',
    },
    progressMs: 0,
    updatedAt: NOW,
    device: null,
    ...patch,
  };
}

describe('renderWidget', () => {
  test('shows the playing song, escaped', () => {
    const svg = renderWidget({
      nowPlaying: nowPlaying(),
      cover: 'data:image/jpeg;base64,AAAA',
      language: 'en',
      theme: 'dark',
      now: NOW,
    });

    expect(svg).toContain('LISTENING NOW');
    expect(svg).toContain('Rock &amp; &lt;Roll&gt;');
    expect(svg).toContain('Daft Punk, Pharrell Williams');
    expect(svg).toContain('href="data:image/jpeg;base64,AAAA"');
    expect(svg).not.toContain('<Roll>');
  });

  test('says how long ago the last song played, in the owner language', () => {
    const svg = renderWidget({
      nowPlaying: nowPlaying({ isPlaying: false, updatedAt: NOW - 2 * HOUR_MS }),
      cover: null,
      language: 'es',
      theme: 'light',
      now: NOW,
    });

    expect(svg).toContain('ÚLTIMA CANCIÓN · HACE 2 HORAS');
    expect(svg).not.toContain('<image');
  });

  test('has a quiet card for someone who never played anything', () => {
    const svg = renderWidget({
      nowPlaying: null,
      cover: null,
      language: 'es',
      theme: 'dark',
      now: NOW,
    });

    expect(svg).toContain('NO ESTÁ ESCUCHANDO NADA');
  });

  test('cuts long titles', () => {
    const svg = renderWidget({
      nowPlaying: nowPlaying({
        track: { ...nowPlaying().track, title: 'A very long title that does not fit in the card' },
      }),
      cover: null,
      language: 'en',
      theme: 'dark',
      now: NOW,
    });

    expect(svg).toContain('A very long title that does n…');
  });
});
