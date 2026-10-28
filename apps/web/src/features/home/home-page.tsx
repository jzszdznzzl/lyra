import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { greetingKey } from './greeting.ts';

export function HomePage() {
  const { t } = useTranslation();
  // Read once on mount: the greeting must not flicker on re-renders.
  const [hour] = useState(() => new Date().getHours());

  return (
    <main className="p-7">
      <h1 className="text-4xl font-extrabold tracking-tight">{t(greetingKey(hour))}</h1>
    </main>
  );
}
