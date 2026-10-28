import { Elysia } from 'elysia';
import { resolve, sep } from 'node:path';

import { DEFAULT_PREVIEW, renderHead } from './previews/head.ts';
import { contentSecurityPolicy } from './security.ts';
import type { Preview } from './previews/head.ts';

const API_PREFIX = '/api/';
// Vite fingerprints everything under assets/, so those files never change behind a URL.
const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

/** Serves the built web app, falling back to index.html so client-side routes load. */
export interface PreviewSource {
  forPath: (pathname: string) => Promise<Preview>;
}

const staticPreviews: PreviewSource = { forPath: () => Promise.resolve(DEFAULT_PREVIEW) };

export function webStatic(
  distDir: string,
  publicUrl: string,
  previews: PreviewSource = staticPreviews,
) {
  const csp = contentSecurityPolicy(publicUrl);
  const root = resolve(distDir);
  const index = Bun.file(resolve(root, 'index.html'));
  let template: Promise<string> | null = null;

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

      return new Response(file, {
        headers: {
          'cache-control': isAsset ? IMMUTABLE : REVALIDATE,
          ...(path.endsWith('.html') ? { 'content-security-policy': csp } : {}),
        },
      });
    }

    // Every app page is index.html with its own title and link-preview card in the head.
    template ??= index.text();
    const html = renderHead(await template, await previews.forPath(pathname), publicUrl, pathname);

    return new Response(html, {
      headers: {
        'cache-control': REVALIDATE,
        'content-type': 'text/html',
        'content-security-policy': csp,
      },
    });
  });
}
