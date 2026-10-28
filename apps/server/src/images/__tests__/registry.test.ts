import { describe, expect, test } from 'bun:test';

import { createTestContext } from '../../testing/test-context.ts';
import { ImageRegistry, imageId } from '../registry.ts';

describe('ImageRegistry', () => {
  test('swaps nested image URLs for ids it can resolve back', async () => {
    const registry = new ImageRegistry(createTestContext());
    const cover = 'https://lh3.googleusercontent.com/abc=w544-h544-l90-rj';
    const page = {
      thumbnail: cover,
      tracks: [
        { title: 'A', thumbnail: cover },
        { title: 'B', thumbnail: null },
      ],
      account: { photo: 'https://yt3.ggpht.com/me' },
      link: 'https://example.com/not-an-image-field',
    };

    await registry.rewrite(page);

    expect(page.thumbnail).toBe(`/api/images/${imageId(cover)}`);
    expect(page.tracks[0]?.thumbnail).toBe(page.thumbnail);
    expect(page.tracks[1]?.thumbnail).toBeNull();
    expect(page.account.photo).toStartWith('/api/images/');
    expect(page.link).toBe('https://example.com/not-an-image-field');
    expect(await registry.urlOf(imageId(cover))).toBe(cover);
    expect(await registry.urlOf('unknown-id-0000000000')).toBeNull();
  });
});
