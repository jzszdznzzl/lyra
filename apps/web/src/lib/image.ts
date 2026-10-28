/** Routes cover art through the server, so it is same-origin for canvases and the offline cache. */
export function imageUrl(url: string | null) {
  return url ? `/api/images?url=${encodeURIComponent(url)}` : null;
}
