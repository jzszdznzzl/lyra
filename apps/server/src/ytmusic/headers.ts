import { YTNodes } from 'youtubei.js';
import type { Helpers } from 'youtubei.js';

import { bestThumbnail } from './mappers.ts';

export interface PageHeader {
  title: string;
  subtitle: string;
  thumbnail: string | null;
}

const EMPTY_HEADER: PageHeader = { title: '', subtitle: '', thumbnail: null };

function join(...parts: string[]) {
  return parts.filter((part) => part.trim() !== '').join(' · ');
}

/** Reads title, subtitle and artwork from whichever header layout YouTube sent. */
export function describeHeader(header: Helpers.YTNode | undefined | null): PageHeader {
  if (!header) {
    return EMPTY_HEADER;
  }

  if (header.is(YTNodes.MusicResponsiveHeader)) {
    return {
      title: header.title.toString(),
      subtitle: join(
        header.strapline_text_one.toString(),
        header.subtitle.toString(),
        header.second_subtitle.toString(),
      ),
      thumbnail: bestThumbnail(header.thumbnail?.contents),
    };
  }

  if (header.is(YTNodes.MusicDetailHeader)) {
    return {
      title: header.title.toString(),
      subtitle: join(header.subtitle.toString(), header.second_subtitle.toString()),
      thumbnail: bestThumbnail(header.thumbnails),
    };
  }

  if (header.is(YTNodes.MusicImmersiveHeader)) {
    return {
      title: header.title.toString(),
      subtitle: '',
      thumbnail: bestThumbnail(header.thumbnail?.contents),
    };
  }

  if (header.is(YTNodes.MusicVisualHeader)) {
    return {
      title: header.title.toString(),
      subtitle: '',
      thumbnail: bestThumbnail(header.thumbnail),
    };
  }

  if (header.is(YTNodes.MusicEditablePlaylistDetailHeader)) {
    return describeHeader(header.header);
  }

  if (header.is(YTNodes.MusicHeader)) {
    return header.header
      ? describeHeader(header.header)
      : { ...EMPTY_HEADER, title: header.title?.toString() ?? '' };
  }

  return EMPTY_HEADER;
}
