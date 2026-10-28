const IMAGE_PATH = '/api/images/';

/**
 * The server already hands out `/api/images/{id}` paths; anything else (an old download saved
 * with a remote URL) has no safe way to load and shows the placeholder instead.
 */
export function imageUrl(url: string | null) {
  return url?.startsWith(IMAGE_PATH) ? url : null;
}
