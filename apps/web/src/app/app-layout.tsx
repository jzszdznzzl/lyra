import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, Outlet } from '@tanstack/react-router';
import { Compass, Download, Home, Search } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { meQuery } from '../features/auth/api.ts';
import { changeLanguage } from '../i18n/index.ts';
import { Avatar } from '../ui/avatar.tsx';
import { Brand } from '../ui/brand.tsx';
import { LibrarySidebar } from './library-sidebar.tsx';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'nav.home' },
  { to: '/search', icon: Search, label: 'nav.search' },
  { to: '/explore', icon: Compass, label: 'nav.explore' },
  { to: '/downloads', icon: Download, label: 'nav.downloads' },
] as const;

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { data: me } = useSuspenseQuery(meQuery);

  // The account's language follows the user to every device.
  useEffect(() => {
    if (me && me.language !== i18n.language) {
      void changeLanguage(me.language);
    }
  }, [me, i18n.language]);

  if (!me) {
    return null;
  }

  return (
    <div className="grid min-h-dvh grid-rows-[1fr_auto] gap-2 p-2 md:h-dvh md:grid-cols-[260px_1fr] md:grid-rows-1">
      <aside className="hidden flex-col gap-1.5 rounded-2xl border border-line bg-panel p-4 backdrop-blur-2xl md:flex">
        <div className="px-2 pb-5">
          <Brand />
        </div>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition hover:text-text data-[status=active]:bg-surface-2 data-[status=active]:text-text"
          >
            <Icon className="size-[18px]" />
            {t(label)}
          </Link>
        ))}
        <p className="px-3 pt-6 pb-2 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
          {t('nav.library')}
        </p>
        <LibrarySidebar isGoogleLinked={me.isGoogleLinked} />
      </aside>
      <main className="flex min-h-0 flex-col overflow-y-auto rounded-2xl border border-line bg-panel backdrop-blur-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between px-4 pt-4 sm:px-7">
          <span className="md:hidden">
            <Brand />
          </span>
          <Link to="/profile" className="ml-auto" aria-label={t('nav.profile')}>
            <Avatar name={me.name} url={me.avatarUrl} />
          </Link>
        </header>
        <Outlet />
      </main>
      <nav className="flex justify-around rounded-2xl border border-line bg-panel py-2 backdrop-blur-2xl md:hidden">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1 px-3 py-1 text-[11px] font-semibold text-muted data-[status=active]:text-text"
          >
            <Icon className="size-5" />
            {t(label)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
