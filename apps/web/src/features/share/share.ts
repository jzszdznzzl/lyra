export const ShareKind = Object.freeze({
  Track: 'track',
  Album: 'album',
  Playlist: 'playlist',
  Artist: 'artist',
} as const);

export type ShareKind = (typeof ShareKind)[keyof typeof ShareKind];

export const ShareOutcome = Object.freeze({
  Shared: 'shared',
  Copied: 'copied',
  Failed: 'failed',
} as const);

export type ShareOutcome = (typeof ShareOutcome)[keyof typeof ShareOutcome];

/** A lyra link (never a YouTube one); the server gives it a title and cover for previews. */
export function shareUrl(kind: ShareKind, id: string) {
  return `${location.origin}/${kind}/${encodeURIComponent(id)}`;
}

/** The phone's share sheet when there is one, the clipboard otherwise. */
export async function shareLink(kind: ShareKind, id: string, title: string): Promise<ShareOutcome> {
  const url = shareUrl(kind, id);

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });

      return ShareOutcome.Shared;
    } catch (error) {
      // Closing the sheet is a choice, not a failure; anything else falls back to copying.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return ShareOutcome.Shared;
      }
    }
  }

  try {
    await navigator.clipboard.writeText(url);

    return ShareOutcome.Copied;
  } catch {
    return ShareOutcome.Failed;
  }
}
