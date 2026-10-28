import { Link } from '@tanstack/react-router';
import { Fragment } from 'react';

import type { ArtistRef } from '@lyra/shared';

export function ArtistLinks({ artists }: { artists: ArtistRef[] }) {
  return (
    <>
      {artists.map((artist, index) => (
        <Fragment key={`${artist.id ?? artist.name}-${index}`}>
          {index > 0 ? ', ' : null}
          {artist.id ? (
            <Link
              to="/artist/$id"
              params={{ id: artist.id }}
              className="hover:text-text hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {artist.name}
            </Link>
          ) : (
            artist.name
          )}
        </Fragment>
      ))}
    </>
  );
}
