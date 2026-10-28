export const PreviewType = Object.freeze({
  Website: 'website',
  Song: 'music.song',
  Album: 'music.album',
  Playlist: 'music.playlist',
  Profile: 'profile',
} as const);

export type PreviewType = (typeof PreviewType)[keyof typeof PreviewType];

export interface Preview {
  title: string;
  description: string;
  // Path on this server (an /api/images id or a static file).
  image: string;
  type: PreviewType;
}

export const HEAD_MARKER = '<!-- lyra:head -->';
const SITE_NAME = 'Lyra';
// Pages worth finding in a search engine; the rest of the app is personal.
const INDEXABLE_PATHS = new Set(['/', '/login', '/register']);

export const DEFAULT_PREVIEW: Preview = {
  title: SITE_NAME,
  description:
    'Your music, everywhere you are. YT Music with crossfade, an equalizer and control from any device.',
  image: '/og.png',
  type: PreviewType.Website,
};

function escape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** Fills index.html's head with the page's title, description and Open Graph card. */
export function renderHead(html: string, preview: Preview, publicUrl: string, pathname: string) {
  const origin = new URL(publicUrl).origin;
  const url = `${origin}${pathname}`;
  const title = preview === DEFAULT_PREVIEW ? SITE_NAME : `${preview.title} · ${SITE_NAME}`;
  const isWide = preview.image === DEFAULT_PREVIEW.image;
  const meta: [string, string, string][] = [
    ['name', 'description', preview.description],
    ['name', 'robots', INDEXABLE_PATHS.has(pathname) ? 'index, follow' : 'noindex'],
    ['property', 'og:site_name', SITE_NAME],
    ['property', 'og:type', preview.type],
    ['property', 'og:title', preview.title],
    ['property', 'og:description', preview.description],
    ['property', 'og:url', url],
    ['property', 'og:image', `${origin}${preview.image}`],
    ['property', 'og:image:alt', preview.title],
    // Covers are square: the small card shows them whole; the site banner gets the large one.
    ['name', 'twitter:card', isWide ? 'summary_large_image' : 'summary'],
    ['name', 'twitter:title', preview.title],
    ['name', 'twitter:description', preview.description],
    ['name', 'twitter:image', `${origin}${preview.image}`],
  ];
  const tags = [
    `<link rel="canonical" href="${escape(url)}" />`,
    ...meta.map(
      ([attribute, key, value]) => `<meta ${attribute}="${key}" content="${escape(value)}" />`,
    ),
  ].join('\n    ');

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`)
    .replace(HEAD_MARKER, tags);
}
