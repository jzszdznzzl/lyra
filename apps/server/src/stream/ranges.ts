export interface ByteRange {
  start: number;
  end: number;
}

// googlevideo throttles or refuses large and open-ended ranges; 1 MiB pieces stay fast.
export const CHUNK_BYTES = 1024 * 1024;

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;
const HTTP_FORBIDDEN = 403;

/** Parses a single HTTP byte range against a known length; null when unsatisfiable. */
export function parseRange(header: string | null, length: number): ByteRange | null {
  if (!header) {
    return { start: 0, end: length - 1 };
  }

  const match = RANGE_PATTERN.exec(header.trim());

  if (!match) {
    return null;
  }

  const [, from = '', to = ''] = match;

  if (from === '' && to === '') {
    return null;
  }

  if (from === '') {
    const suffix = Math.min(Number(to), length);

    return suffix > 0 ? { start: length - suffix, end: length - 1 } : null;
  }

  const start = Number(from);
  const end = to === '' ? length - 1 : Math.min(Number(to), length - 1);

  return start <= end && start < length ? { start, end } : null;
}

/** Splits a range into upstream-sized pieces. */
export function chunksOf({ start, end }: ByteRange, size = CHUNK_BYTES): ByteRange[] {
  const chunks: ByteRange[] = [];

  for (let offset = start; offset <= end; offset += size) {
    chunks.push({ start: offset, end: Math.min(offset + size - 1, end) });
  }

  return chunks;
}

/**
 * One continuous body made of sequential bounded upstream requests. When googlevideo revokes the
 * URL partway (403), `refreshUrl` may supply a new one once; otherwise the player would see a
 * network error and skip the song a few seconds in.
 */
export function chunkedBody(
  url: string,
  range: ByteRange,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
  refreshUrl?: () => Promise<string | null>,
): ReadableStream<Uint8Array> {
  const pieces = chunksOf(range);
  let next = 0;
  let currentUrl = url;
  let hasRefreshed = false;

  const fetchPiece = async (piece: ByteRange) => {
    const request = () =>
      fetcher(currentUrl, { headers: { range: `bytes=${piece.start}-${piece.end}` }, signal });
    const response = await request();

    if (response.status !== HTTP_FORBIDDEN || hasRefreshed || !refreshUrl) {
      return response;
    }

    hasRefreshed = true;
    const fresh = await refreshUrl().catch(() => null);

    if (!fresh) {
      return response;
    }

    currentUrl = fresh;

    return request();
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const piece = pieces[next];

      if (!piece || signal.aborted) {
        controller.close();

        return;
      }

      next += 1;

      try {
        const response = await fetchPiece(piece);

        if (!response.ok) {
          console.warn(
            `[stream] upstream answered ${response.status} for bytes ${piece.start}-${piece.end}`,
          );
          controller.error(new Error(`upstream ${response.status}`));

          return;
        }

        controller.enqueue(new Uint8Array(await response.arrayBuffer()));
      } catch (error) {
        // The player dropped the request (seek, skip); there is nobody left to tell.
        if (signal.aborted) {
          controller.close();
        } else {
          controller.error(error);
        }
      }
    },
  });
}
