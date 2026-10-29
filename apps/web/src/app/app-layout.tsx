import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, Outlet, useCanGoBack, useRouter, useRouterState } from '@tanstack/react-router';
import {
  ChevronLeft,
  Compass,
  Download,
  Home,
  MonitorDown,
  Plus,
  Search,
  Users,
  WifiOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnnouncementBanner } from '../features/announcements/announcement-banner.tsx';
import { announcementsQuery } from '../features/announcements/api.ts';
import { meQuery } from '../features/auth/api.ts';
import { startConnect } from '../features/connect/connect-client.ts';
import { CreatePlaylistDialog } from '../features/library/playlist-dialogs.tsx';
import { useDownloads } from '../features/offline/downloads.ts';
import { friendsQuery } from '../features/social/api.ts';
import { MobilePlayer } from '../features/player/mobile-player.tsx';
import { NowPlayingPanel } from '../features/player/now-playing-panel.tsx';
import { GoogleRequiredDialog } from '../features/player/google-required-dialog.tsx';
import { ImmersiveView } from '../features/player/immersive-view.tsx';
import { PlayerBar } from '../features/player/player-bar.tsx';
import { useCoverTheme } from '../features/player/use-cover-theme.ts';
import { useMediaSession } from '../features/player/use-media-session.ts';
import { changeLanguage } from '../i18n/index.ts';
import { Avatar } from '../ui/avatar.tsx';
import { Brand } from '../ui/brand.tsx';
import { useInstallPrompt } from '../lib/use-install-prompt.ts';
import { useOnline } from '../lib/use-online.ts';
import { Toaster } from '../ui/toast.tsx';
import { handleShortcut } from './shortcuts.ts';
import { LibrarySidebar } from './library-sidebar.tsx';
import { UpdateBanner } from './update-banner.tsx';

// Past this, the page has scrolled under the header.
const SCROLLED_PX = 4;

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'nav.home' },
  { to: '/search', icon: Search, label: 'nav.search' },
  { to: '/explore', icon: Compass, label: 'nav.explore' },
  { to: '/downloads', icon: Download, label: 'nav.downloads' },
  { to: '/friends', icon: Users, label: 'nav.friends' },
] as const;

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { data: me } = useSuspenseQuery(meQuery);

  const [isCreating, setIsCreating] = useState(false);
  const isOnline = useOnline();
  const install = useInstallPrompt();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const isHome = useRouterState({ select: (state) => state.location.pathname === '/' });
  const queryClient = useQueryClient();
  const [isScrolled, setIsScrolled] = useState(false);
  const friends = useQuery(friendsQuery);
  // Requests and playlist invitations waiting for an answer.
  const pendingCount = (friends.data?.incoming.length ?? 0) + (friends.data?.invites.length ?? 0);

  useMediaSession();
  useCoverTheme();
  useEffect(
    () =>
      startConnect({
        onAnnouncements: () =>
          void queryClient.invalidateQueries({ queryKey: announcementsQuery.queryKey }),
      }),
    [queryClient],
  );
  useEffect(() => {
    void useDownloads.getState().load();
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => handleShortcut(event);

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
    <div
      data-app-frame
      className="fixed inset-0 grid grid-rows-[minmax(0,1fr)_auto_auto] gap-2 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:grid-cols-[260px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_auto] xl:grid-cols-[260px_minmax(0,1fr)_320px]"
    >
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
            {to === '/friends' && pendingCount > 0 ? (
              <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                {pendingCount}
              </span>
            ) : null}
          </Link>
        ))}
        <div className="flex items-center justify-between px-3 pt-6 pb-2">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
            {t('nav.library')}
          </p>
          {me.isGoogleLinked ? (
            <button
              type="button"
              aria-label={t('library.createTitle')}
              onClick={() => setIsCreating(true)}
              className="rounded-full p-1 text-muted hover:bg-surface hover:text-text"
            >
              <Plus className="size-4" />
            </button>
          ) : null}
        </div>
        <LibrarySidebar isGoogleLinked={me.isGoogleLinked} />
        {install ? (
          <button
            type="button"
            onClick={install}
            title={t('offline.installHint')}
            className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted hover:bg-surface hover:text-text"
          >
            <MonitorDown className="size-[18px]" />
            {t('offline.install')}
          </button>
        ) : null}
      </aside>
      <main
        data-scroll-restoration-id="main"
        onScroll={(event) => setIsScrolled(event.currentTarget.scrollTop > SCROLLED_PX)}
        // The whole panel is the animated part: it clips its own scroll, so the snapshot can never
        // spill over the tab bar or the player the way a long page inside it would.
        className="flex min-h-0 flex-col overflow-y-auto overscroll-contain rounded-2xl border border-line bg-panel backdrop-blur-2xl [view-transition-name:page]"
      >
        {/* Transparent at the top; once the page scrolls under it, it gets its own backdrop so
            the logo and avatar never sit on top of the content. */}
        <header
          data-scrolled={isScrolled}
          className="sticky top-0 z-10 -mb-3 flex items-center justify-between border-b border-transparent px-4 pt-4 pb-3 transition-[background-color,border-color] duration-200 data-[scrolled=true]:border-line data-[scrolled=true]:bg-bg/85 data-[scrolled=true]:backdrop-blur-xl sm:px-7"
        >
          {canGoBack && !isHome ? (
            <button
              type="button"
              aria-label={t('nav.back')}
              onClick={() => router.history.back()}
              className="grid size-9 place-items-center rounded-full bg-bg/50 text-text backdrop-blur hover:bg-surface-2"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : (
            <span className="md:hidden">
              <Brand />
            </span>
          )}
          <Link to="/profile" className="ml-auto" aria-label={t('nav.profile')}>
            <Avatar name={me.name} url={me.avatarUrl} />
          </Link>
        </header>
        {isOnline ? null : (
          <p className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning sm:mx-7">
            <WifiOff className="size-4 shrink-0" />
            {t('offline.banner')}
          </p>
        )}
        <AnnouncementBanner />
        <Outlet />
      </main>
      <NowPlayingPanel />
      <PlayerBar />
      <MobilePlayer />
      <Toaster />
      <UpdateBanner />
      <ImmersiveView />
      <GoogleRequiredDialog />
      {isCreating ? <CreatePlaylistDialog onClose={() => setIsCreating(false)} /> : null}
      <nav className="flex justify-around rounded-2xl border border-line bg-panel py-2 backdrop-blur-2xl md:hidden">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="relative flex flex-col items-center gap-1 px-2 py-1 text-[11px] font-semibold text-muted data-[status=active]:text-text"
          >
            <Icon className="size-5" />
            {t(label)}
            {to === '/friends' && pendingCount > 0 ? (
              <span className="absolute top-0 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
