import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { Track } from '@lyra/shared';

import { LyricsView } from '../lyrics-view.tsx';
import { usePlayerStore } from '../player-store.ts';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const TRACK: Track = {
  kind: 'song',
  id: 'aaaaaaaaaaa',
  title: 'Song',
  artists: [],
  album: null,
  durationSeconds: 200,
  thumbnail: null,
  isExplicit: false,
};

function show() {
  const client = new QueryClient();
  client.setQueryData(['lyrics', TRACK.id], {
    lyrics: {
      source: 'lrclib',
      isSynced: true,
      lines: [
        { timeMs: 0, text: 'first line' },
        { timeMs: 10_000, text: 'second line' },
      ],
    },
  });
  // Halfway through the second line.
  usePlayerStore.setState({ position: 12 });

  return render(
    <QueryClientProvider client={client}>
      <LyricsView track={TRACK} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  act(() => usePlayerStore.getState().updateSettings({ isLyricsSyncEnabled: true }));
});

describe('LyricsView', () => {
  test('highlights the sung line while syncing is on', () => {
    const view = show();

    expect(view.getByText('second line').className).toContain('text-text ');
    expect(view.getByText('first line').className).toContain('text-text/35');
  });

  test('turned off, every line reads the same and the setting can be switched back', () => {
    const view = show();
    act(() => view.getByText('lyrics.turnSyncOff').click());

    expect(view.getByText('second line').className).toContain('text-text/80');
    expect(view.getByText('first line').className).toContain('text-text/80');
    expect(usePlayerStore.getState().settings.isLyricsSyncEnabled).toBe(false);
    expect(view.getByText('lyrics.turnSyncOn')).toBeTruthy();
  });
});
