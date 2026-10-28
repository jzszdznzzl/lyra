import { Elysia } from 'elysia';
import { resolve, sep } from 'node:path';

const API_PREFIX = '/api/';
// Vite fingerprints everything under assets/, so those files never change behind a URL.
const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

/** Serves the built web app, falling back to index.html so client-side routes load. */
export function webStatic(distDir: string) {
  const root = resolve(distDir);
  const index = Bun.file(resolve(root, 'index.html'));

  return new Elysia().get('/*', async ({ request, status }) => {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith(API_PREFIX)) {
      return status(404, { error: 'not_found' });
    }

    const path = resolve(root, `.${decodeURIComponent(pathname)}`);
    // `resolve` collapses "..", so anything outside the folder is a traversal attempt.
    const isInside = path.startsWith(`${root}${sep}`);
    const file = Bun.file(path);

    if (isInside && (await file.exists())) {
      const isAsset = pathname.startsWith('/assets/');

      return new Response(file, { headers: { 'cache-control': isAsset ? IMMUTABLE : REVALIDATE } });
    }

    return new Response(index, {
      headers: { 'cache-control': REVALIDATE, 'content-type': 'text/html' },
    });
  });
}
