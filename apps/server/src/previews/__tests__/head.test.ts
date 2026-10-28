import { describe, expect, test } from 'bun:test';

import { DEFAULT_PREVIEW, HEAD_MARKER, PreviewType, renderHead } from '../head.ts';

const HTML = `<html><head><title>Lyra</title>${HEAD_MARKER}</head><body></body></html>`;

describe('renderHead', () => {
  test('builds an escaped card with absolute URLs for a shared album', () => {
    const html = renderHead(
      HTML,
      {
        type: PreviewType.Album,
        title: 'Rock & "Roll"',
        description: 'Band · 2020',
        image: '/api/images/AAAAAAAAAAAAAAAAAAAAAA',
      },
      'https://lyra.example.com',
      '/album/MPREb_x',
    );

    expect(html).toContain('<title>Rock &amp; &quot;Roll&quot; · Lyra</title>');
    expect(html).toContain(
      '<meta property="og:image" content="https://lyra.example.com/api/images/AAAAAAAAAAAAAAAAAAAAAA" />',
    );
    expect(html).toContain('<meta property="og:type" content="music.album" />');
    expect(html).toContain(
      '<link rel="canonical" href="https://lyra.example.com/album/MPREb_x" />',
    );
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).not.toContain(HEAD_MARKER);
  });

  test('the public pages are indexable and use the wide banner', () => {
    const html = renderHead(HTML, DEFAULT_PREVIEW, 'https://lyra.example.com', '/login');

    expect(html).toContain('<meta name="robots" content="index, follow" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain('content="https://lyra.example.com/og.png"');
  });
});
