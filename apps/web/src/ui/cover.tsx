import { useState } from 'react';

import { imageUrl } from '../lib/image.ts';

interface CoverProps {
  src: string | null;
  alt: string;
  className?: string;
  isRound?: boolean;
}

export function Cover({ src, alt, className = '', isRound = false }: CoverProps) {
  const [hasFailed, setHasFailed] = useState(false);
  const shape = isRound ? 'rounded-full' : 'rounded-xl';
  const url = imageUrl(src);

  if (!url || hasFailed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`bg-gradient-to-br from-accent/70 to-accent-2/50 ${shape} ${className}`}
      />
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setHasFailed(true)}
      className={`bg-surface-2 object-cover ${shape} ${className}`}
    />
  );
}
