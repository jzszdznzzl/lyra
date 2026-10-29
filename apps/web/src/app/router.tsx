import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  redirect,
} from '@tanstack/react-router';
import { z } from 'zod';

import { SearchFilter } from '@lyra/shared';
import type { QueryClient } from '@tanstack/react-query';

import { configQuery, meQuery } from '../features/auth/api.ts';
import { AuthLayout } from '../features/auth/auth-layout.tsx';
import { CheckEmailPage } from '../features/auth/check-email-page.tsx';
import { ForgotPasswordPage } from '../features/auth/forgot-password-page.tsx';
import { LoginPage } from '../features/auth/login-page.tsx';
import { RegisterPage } from '../features/auth/register-page.tsx';
import { ResetPasswordPage } from '../features/auth/reset-password-page.tsx';
import { VerifyEmailPage } from '../features/auth/verify-email-page.tsx';
import { HomePage } from '../features/home/home-page.tsx';
import { AlbumPage } from '../features/music/album-page.tsx';
import { ArtistPage } from '../features/music/artist-page.tsx';
import { ExplorePage } from '../features/music/explore-page.tsx';
import { HistoryPage } from '../features/music/history-page.tsx';
import { LikedPage, PlaylistPage } from '../features/music/playlist-page.tsx';
import { SearchPage } from '../features/music/search-page.tsx';
import { TrackPage } from '../features/music/track-page.tsx';
import { DownloadsPage } from '../features/offline/downloads-page.tsx';
import { ProfilePage } from '../features/profile/profile-page.tsx';
import { AppLayout } from './app-layout.tsx';
import { pageTransition } from './page-transitions.ts';
import { CrashPage, NotFoundPage } from './route-states.tsx';

interface RouterContext {
  queryClient: QueryClient;
}

const TokenSearch = z.object({ token: z.string().catch('') });
const EmailSearch = z.object({ email: z.string().catch('') });
// Only paths inside the app ("/track/…"), never "//evil.example" or full URLs.
const SafeRedirect = z.string().regex(/^\/(?!\/)/);
const MusicSearch = z.object({
  q: z.string().catch(''),
  filter: z.enum(SearchFilter).catch(SearchFilter.All),
});

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Outlet });

async function redirectIfSignedIn({ context }: { context: RouterContext }) {
  if (await context.queryClient.ensureQueryData(meQuery)) {
    throw redirect({ to: '/' });
  }
}

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  component: AuthLayout,
});

const registerRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/register',
  beforeLoad: async ({ context }) => {
    await redirectIfSignedIn({ context });

    if (!(await context.queryClient.ensureQueryData(configQuery)).isRegistrationEnabled) {
      throw redirect({ to: '/login' });
    }
  },
  component: RegisterPage,
});

const loginRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/login',
  validateSearch: (search): { redirect?: string } => {
    const target = SafeRedirect.safeParse(search['redirect']);

    return target.success ? { redirect: target.data } : {};
  },
  beforeLoad: redirectIfSignedIn,
  component: LoginPage,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/forgot-password',
  beforeLoad: redirectIfSignedIn,
  component: ForgotPasswordPage,
});

const checkEmailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/check-email',
  validateSearch: (search) => EmailSearch.parse(search),
  component: CheckEmailPage,
});

const verifyEmailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/verify-email',
  validateSearch: (search) => TokenSearch.parse(search),
  component: VerifyEmailPage,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/reset-password',
  validateSearch: (search) => TokenSearch.parse(search),
  component: ResetPasswordPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context, location }) => {
    // The first page asks for an account; signing in is one link away from there.
    if (!(await context.queryClient.ensureQueryData(meQuery))) {
      const config = await context.queryClient.ensureQueryData(configQuery);
      const target = location.href;

      // A shared link opened while signed out comes back after signing in.
      if (config.isRegistrationEnabled && target === '/') {
        throw redirect({ to: '/register' });
      }

      throw redirect({ to: '/login', search: { redirect: target } });
    }
  },
  component: AppLayout,
});

const homeRoute = createRoute({ getParentRoute: () => appRoute, path: '/', component: HomePage });

const searchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/search',
  validateSearch: (search) => MusicSearch.parse(search),
  component: SearchPage,
});

const trackRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/track/$id',
  component: TrackPage,
});

const albumRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/album/$id',
  component: AlbumPage,
});

const artistRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/artist/$id',
  component: ArtistPage,
});

const playlistRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/playlist/$id',
  component: PlaylistPage,
});

const likedRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/liked',
  component: LikedPage,
});

const historyRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/history',
  component: HistoryPage,
});

const exploreRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/explore',
  component: ExplorePage,
});

const downloadsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/downloads',
  component: DownloadsPage,
});

const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/profile',
  component: ProfilePage,
});

// For anyone who is not an admin this is just a page that does not exist. The panel's code is a
// separate chunk, downloaded only by admins.
const adminRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/admin',
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery))?.isAdmin) {
      throw notFound();
    }
  },
  component: lazyRouteComponent(() => import('../features/admin/admin-page.tsx'), 'AdminPage'),
});

const routeTree = rootRoute.addChildren([
  authRoute.addChildren([
    registerRoute,
    loginRoute,
    forgotPasswordRoute,
    checkEmailRoute,
    verifyEmailRoute,
    resetPasswordRoute,
  ]),
  appRoute.addChildren([
    homeRoute,
    searchRoute,
    trackRoute,
    albumRoute,
    artistRoute,
    playlistRoute,
    likedRoute,
    historyRoute,
    exploreRoute,
    downloadsRoute,
    profileRoute,
    adminRoute,
  ]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    // Page changes fade the content in (styles.css); see pageTransition for when they do not.
    defaultViewTransition: { types: pageTransition },
    // Going back returns to the same scroll position; the app scrolls inside <main>.
    scrollRestoration: true,
    defaultNotFoundComponent: NotFoundPage,
    defaultErrorComponent: CrashPage,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
