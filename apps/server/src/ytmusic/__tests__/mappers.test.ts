import { describe, expect, test } from 'bun:test';

import { bestThumbnail, parseDuration } from '../mappers.ts';

describe('bestThumbnail', () => {
  test('picks the widest and upsizes googleusercontent images', () => {
    expect(
      bestThumbnail([
        { url: 'https://lh3.googleusercontent.com/abc=w60-h60-l90-rj', width: 60, height: 60 },
        { url: 'https://lh3.googleusercontent.com/abc=w120-h120-l90-rj', width: 120, height: 120 },
      ]),
    ).toBe('https://lh3.googleusercontent.com/abc=w544-h544-l90-rj');
  });

  test('keeps other URLs and handles empty lists', () => {
    expect(bestThumbnail([{ url: '//i.ytimg.com/vi/x/hq.jpg', width: 480, height: 360 }])).toBe(
      'https://i.ytimg.com/vi/x/hq.jpg',
    );
    expect(bestThumbnail([])).toBeNull();
  });
});

describe('parseDuration', () => {
  test.each([
    ['3:45', 225],
    ['1:02:03', 3723],
    ['abc', null],
    [undefined, null],
  ])('%s', (text, seconds) => {
    expect(parseDuration(text)).toBe(seconds);
  });
});
