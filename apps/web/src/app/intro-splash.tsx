import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LogoMark } from '../ui/brand.tsx';
import { isMotionReduced } from './motion.ts';

const IntroPhase = Object.freeze({ Playing: 'playing', Leaving: 'leaving', Done: 'done' } as const);

type IntroPhase = (typeof IntroPhase)[keyof typeof IntroPhase];

// Matches the keyframes in styles.css: the tagline finishes at about 2.6 s.
const LEAVE_AFTER_MS = 2800;
const LEAVE_MS = 350;
const LETTERS = ['l', 'y', 'r', 'a'] as const;

// Once per app load: navigating or remounting the layout must not replay it.
let hasPlayed = false;

/**
 * The opening animation after signing in: the logo's bars dance, it rises, then the name and
 * tagline appear. The app loads underneath; a tap skips it, and it never shows with motion off.
 */
export function IntroSplash() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<IntroPhase>(() =>
    hasPlayed || isMotionReduced() ? IntroPhase.Done : IntroPhase.Playing,
  );

  useEffect(() => {
    if (phase === IntroPhase.Done) {
      return;
    }

    hasPlayed = true;
    const timer =
      phase === IntroPhase.Playing
        ? setTimeout(() => setPhase(IntroPhase.Leaving), LEAVE_AFTER_MS)
        : setTimeout(() => setPhase(IntroPhase.Done), LEAVE_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === IntroPhase.Done) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      onClick={() => setPhase(IntroPhase.Leaving)}
      // Its own view-transition layer: arriving from the sign-in page, the page change would
      // otherwise be painted on top of it.
      className={`intro-splash fixed inset-0 z-[70] grid place-items-center bg-bg [view-transition-name:intro] ${phase === IntroPhase.Leaving ? 'intro-leaving' : ''}`}
    >
      <div className="intro-stage flex flex-col items-center text-center">
        <LogoMark className="intro-mark size-[104px]" />
        <p className="intro-name mt-[22px] text-[52px] leading-none font-extrabold tracking-[-0.04em]">
          {LETTERS.map((letter, index) => (
            <span key={letter} style={{ animationDelay: `${1.55 + index * 0.08}s` }}>
              {letter}
            </span>
          ))}
        </p>
        <p className="intro-tag mt-3 text-base font-medium text-muted">{t('app.tagline')}</p>
      </div>
    </div>
  );
}
